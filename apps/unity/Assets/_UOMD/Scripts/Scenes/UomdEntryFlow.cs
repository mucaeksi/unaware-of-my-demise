using System;
using System.IO;
using UnityEngine;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>
    /// Story/battle routing. The first-install entry flow (port of apps/game/src/entry/flow.ts + tutorial.ts): prologue, then
    /// tutorial stages T-1..T-3 from entry/entry_index.json, each pre_story → battle → post_story, then the Finish page. A
    /// stage counts as done only after its post_story; progress goes to the account (PUT /api/v1/entry) when signed in.
    /// Campaign nodes picked on the Chapters screen (port of flow.ts playNode) run the same pre_story → battle → post_story
    /// and return to Chapters.
    /// </summary>
    public sealed class UomdEntryFlow
    {
        public enum Phase { None, PreStory, Battle, PostStory }

        private readonly UomdSceneRouter _router;
        private string _preStory = "";
        private string _postStory = "";
        private string _campaignNode = "";
        private string _readingEntry = "";
        private System.Collections.Generic.List<string> _readingScenes = new System.Collections.Generic.List<string>();
        private int _readingIndex;
        private int _generation;
        internal void ResetForIdentity()
        {
            ++_generation; StageIndex = 0; Current = Phase.None; _preStory = _postStory = _campaignNode = _readingEntry = "";
            _readingScenes = new System.Collections.Generic.List<string>(); _readingIndex = 0;
        }
        private bool Owns(string scope) => string.IsNullOrEmpty(scope) || Continuity.IsCurrent && Continuity.State.Scope == scope;

        public UomdEntryContinuity Continuity { get; }
        public UomdEntryFlow(UomdSceneRouter router)
        {
            _router = router;
            bool isolated = UomdCaptureRunner.Requested(out _);
#if UNITY_EDITOR
            isolated |= UomdEditorPreviewIsolation.Active;
#endif
            Continuity = new UomdEntryContinuity(router, isolated);
        }

        /// <summary>Tutorial stage being played (1..3), 0 outside the entry flow.</summary>
        public int StageIndex { get; private set; }
        public Phase Current { get; private set; } = Phase.None;

        /// <summary>Goes to the first unfinished entry step (TitleScene tap, Continue).</summary>
        public async Awaitable ContinueAsync()
        {
            await Continuity.PrepareAsync();
            await ResumePreparedAsync();
        }

        private async Awaitable ResumePreparedAsync()
        {
            if (!Continuity.IsCurrent) { await _router.NavigateToAsync(UomdScreenId.Title); return; }
            var saved = Continuity.State;
            if (!saved.PrologueDone)
            {
                await _router.NavigateToAsync(UomdScreenId.Prologue);
                return;
            }
            int done = saved.Tutorials;
            if (done < 3)
            {
                if (saved.Stage == done + 1 && (saved.Phase == "battle" || saved.Phase == "post_story"))
                {
                    int stage = saved.Stage; string phase = saved.Phase;
                    await LoadStageAsync(stage);
                    if (phase == "post_story" && !string.IsNullOrEmpty(_postStory)) await PlayStoryAsync(Phase.PostStory, _postStory);
                    else await StartBattleAsync();
                    return;
                }
                await StartStageAsync(done + 1);
                return;
            }
            StageIndex = 0; Current = Phase.None;
            if (!saved.Completed || saved.Phase == "finish" || !Continuity.MemoryOnly && !_router.Patch.EntryCompleted)
            { await _router.NavigateToAsync(UomdScreenId.Finish); return; }
            await _router.NavigateToAsync(UomdScreenId.Home);
        }

        public async Awaitable PrologueFinishedAsync(string expectedScope = null)
        {
            if (!Owns(expectedScope)) { await _router.NavigateToAsync(UomdScreenId.Title); return; }
            Continuity.PrologueFinished();
            _ = Continuity.SyncAsync();
            await ResumePreparedAsync();
        }

        public void BattleWon(string expectedScope = null)
        {
            if (!Owns(expectedScope)) return;
            if (InEntryBattle && !string.IsNullOrEmpty(_postStory)) Continuity.Phase("post_story", StageIndex, _postStory);
        }

        private async Awaitable LoadStageAsync(int index)
        {
            int generation = _generation;
            var entry = UomdJson.ParseObject(await _router.Patch.ReadTextAsync("entry/entry_index.json"));
            if (generation != _generation || !Continuity.IsCurrent) throw new OperationCanceledException("Account changed.");
            var stages = entry.TryGetValue("tutorial", out object list) ? list as System.Collections.Generic.List<object> : null;
            if (stages == null || index < 1 || index > stages.Count) throw new InvalidDataException($"entry index has no tutorial stage {index}");
            var stage = (System.Collections.Generic.Dictionary<string, object>)stages[index - 1];
            await LoadEncounterAsync((string)stage["encounter"], generation);
            if (generation != _generation || !Continuity.IsCurrent) throw new OperationCanceledException("Account changed.");
            StageIndex = index;
        }

        /// <summary>Starts tutorial stage <paramref name="index"/> (1-based) at its pre_story.</summary>
        public async Awaitable StartStageAsync(int index)
        {
            _campaignNode = "";
            try
            {
                if (!Continuity.IsCurrent) await Continuity.PrepareAsync();
                await LoadStageAsync(index);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception e)
            {
                Debug.LogError($"[EntryFlow] tutorial {index} could not start: {e.Message}");
                StageIndex = 0;
                Current = Phase.None;
                await _router.NavigateToAsync(UomdScreenId.Title);
                return;
            }
            if (!string.IsNullOrEmpty(_preStory)) await PlayStoryAsync(Phase.PreStory, _preStory);
            else await StartBattleAsync();
        }

        /// <summary>
        /// Plays a chapter node (flow.ts playNode): a story node shows its scene, a battle node its pre_story → battle →
        /// post_story; both return to Chapters. Server-sessioned campaign battles (POST /progress/battle/start + submit) arrive
        /// with the first chapter patch; the base tutorial chapter is a fixed-party replay with one-time rewards already claimed.
        /// </summary>
        /// <returns>False when the node's content could not be loaded (the caller stays and tells the player).</returns>
        public async Awaitable<bool> PlayNodeAsync(string nodeId, string kind, string storyPath, string encounterPath)
        {
            StageIndex = 0;
            _campaignNode = nodeId;
            if (kind == "story" && !string.IsNullOrEmpty(storyPath))
            {
                _preStory = "";
                _postStory = "";
                await PlayStoryAsync(Phase.PostStory, storyPath); // its end completes the node
                return true;
            }
            try
            {
                if (string.IsNullOrEmpty(encounterPath)) throw new InvalidDataException("the node has no encounter");
                await LoadEncounterAsync(encounterPath);
            }
            catch (Exception e)
            {
                Debug.LogError($"[EntryFlow] node {nodeId} could not start: {e.Message}");
                _campaignNode = "";
                Current = Phase.None;
                return false;
            }
            if (!string.IsNullOrEmpty(_preStory)) await PlayStoryAsync(Phase.PreStory, _preStory);
            else await StartBattleAsync();
            return true;
        }

        private async Awaitable LoadEncounterAsync(string encounterPath, int generation = -1)
        {
            var encounter = UomdJson.ParseObject(await _router.Patch.ReadTextAsync(encounterPath));
            if (generation >= 0 && (generation != _generation || !Continuity.IsCurrent)) throw new OperationCanceledException("Account changed.");
            _preStory = encounter.TryGetValue("pre_story", out object pre) ? pre as string ?? "" : "";
            _postStory = encounter.TryGetValue("post_story", out object post) ? post as string ?? "" : "";
            _router.Session.ActiveBattleEncounterId = Path.GetFileNameWithoutExtension(encounterPath);
        }

        /// <summary>
        /// Plays an Archive reading (LibraryScene.reading): the server-delivered scenes in order, then records the reading
        /// (POST /api/v1/progress/story) and returns to the Archive.
        /// </summary>
        public async Awaitable PlayReadingAsync(string entryId, System.Collections.Generic.List<string> sceneJsons)
        {
            StageIndex = 0;
            _campaignNode = "";
            _readingEntry = entryId;
            _readingScenes = sceneJsons;
            _readingIndex = 0;
            await ShowReadingSceneAsync();
        }

        public bool InReading => _readingEntry.Length > 0;

        private async Awaitable ShowReadingSceneAsync()
        {
            Current = Phase.PostStory;
            _router.Session.ActiveStoryJson = _readingScenes[_readingIndex];
            _router.Session.ActiveStoryPath = _readingEntry;
            await _router.NavigateToAsync(UomdScreenId.Story);
        }

        private async Awaitable FinishReadingAsync()
        {
            if (_readingIndex + 1 < _readingScenes.Count)
            {
                _readingIndex++;
                await ShowReadingSceneAsync();
                return;
            }
            string entry = _readingEntry;
            _readingEntry = "";
            _router.Session.ActiveStoryJson = null;
            Current = Phase.None;
            try
            {
                await _router.Api.SendJsonAsync("POST", "/api/v1/progress/story", new System.Collections.Generic.Dictionary<string, object>
                {
                    ["releaseId"] = _router.Patch.ActiveReleaseId, ["nodeId"] = entry
                });
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[EntryFlow] reading {entry} not recorded: {e.Message}");
            }
            await _router.NavigateToAsync(UomdScreenId.Library);
        }

        /// <summary>The story screen calls this when its scene completes.</summary>
        public async Awaitable StoryFinishedAsync(string expectedScope = null)
        {
            if (!Owns(expectedScope)) { await _router.NavigateToAsync(UomdScreenId.Title); return; }
            if (StageIndex > 0 && !Continuity.IsCurrent) { await _router.NavigateToAsync(UomdScreenId.Title); return; }
            if (InReading) await FinishReadingAsync();
            else if (Current == Phase.PreStory) await StartBattleAsync();
            else if (Current == Phase.PostStory) await CompleteStageAsync();
            else await _router.NavigateToAsync(UomdScreenId.Home);
        }

        /// <summary>The battle screen calls this after the result. A lost tutorial replays from its pre_story, a lost campaign battle restarts.</summary>
        public async Awaitable BattleFinishedAsync(bool won, int stars = 0, string expectedScope = null)
        {
            if (!Owns(expectedScope)) { await _router.NavigateToAsync(UomdScreenId.Title); return; }
            if (Current != Phase.Battle) return;
            if (StageIndex > 0 && !Continuity.IsCurrent) { await _router.NavigateToAsync(UomdScreenId.Title); return; }
            if (!won)
            {
                if (InCampaignBattle) await StartBattleAsync();
                else await StartStageAsync(StageIndex);
                return;
            }
            if (InCampaign) UomdLocalProgress.Complete(_campaignNode, stars);
            if (!string.IsNullOrEmpty(_postStory)) await PlayStoryAsync(Phase.PostStory, _postStory);
            else await CompleteStageAsync();
        }

        /// <summary>Leaves a campaign node for the Chapters list (the battle result's CHAPTERS button).</summary>
        public async Awaitable AbandonNodeAsync()
        {
            _campaignNode = "";
            Current = Phase.None;
            await _router.NavigateToAsync(UomdScreenId.Chapters);
        }

        public bool InEntryBattle => Current == Phase.Battle && StageIndex > 0;
        public bool InCampaign => _campaignNode.Length > 0;
        public bool InCampaignBattle => Current == Phase.Battle && InCampaign;

        private async Awaitable PlayStoryAsync(Phase phase, string path)
        {
            Current = phase;
            if (StageIndex > 0) Continuity.Phase(phase == Phase.PreStory ? "pre_story" : "post_story", StageIndex, path);
            _readingEntry = "";
            _router.Session.ActiveStoryJson = null;
            _router.Session.ActiveStoryPath = path;
            await _router.NavigateToAsync(UomdScreenId.Story);
        }

        private async Awaitable StartBattleAsync()
        {
            Current = Phase.Battle;
            if (StageIndex > 0) Continuity.Phase("battle", StageIndex);
            await _router.NavigateToAsync(UomdScreenId.Battle);
        }

        private async Awaitable CompleteStageAsync()
        {
            if (InCampaign)
            {
                string node = _campaignNode;
                _campaignNode = "";
                Current = Phase.None;
                if (!UomdLocalProgress.IsCleared(node)) UomdLocalProgress.Complete(node, 0); // a story node
                await _router.NavigateToAsync(UomdScreenId.Chapters);
                return;
            }
            int index = StageIndex;
            Continuity.TutorialFinished(index);
            _ = Continuity.SyncAsync();
            if (index < 3)
            {
                await StartStageAsync(index + 1);
                return;
            }
            StageIndex = 0;
            Current = Phase.None;
            await _router.NavigateToAsync(UomdScreenId.Finish);
        }

    }
}
