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

        public UomdEntryFlow(UomdSceneRouter router) => _router = router;

        /// <summary>Tutorial stage being played (1..3), 0 outside the entry flow.</summary>
        public int StageIndex { get; private set; }
        public Phase Current { get; private set; } = Phase.None;

        /// <summary>Goes to the first unfinished entry step (TitleScene tap, Continue).</summary>
        public async Awaitable ContinueAsync()
        {
            var account = _router.Session.Account;
            if (account?.storyProgress == null || !account.storyProgress.prologueDone)
            {
                await _router.NavigateToAsync(UomdScreenId.Prologue);
                return;
            }
            int done = Math.Max(0, account.tutorialStep);
            if (done < 3)
            {
                await StartStageAsync(done + 1);
                return;
            }
            _router.Patch.EntryCompleted = true;
            await _router.NavigateToAsync(UomdScreenId.Home);
        }

        /// <summary>Starts tutorial stage <paramref name="index"/> (1-based) at its pre_story.</summary>
        public async Awaitable StartStageAsync(int index)
        {
            _campaignNode = "";
            try
            {
                var entry = UomdJson.ParseObject(await _router.Patch.ReadTextAsync("entry/entry_index.json"));
                var stages = entry.TryGetValue("tutorial", out object list) ? list as System.Collections.Generic.List<object> : null;
                if (stages == null || index < 1 || index > stages.Count) throw new InvalidDataException($"entry index has no tutorial stage {index}");
                var stage = (System.Collections.Generic.Dictionary<string, object>)stages[index - 1];
                await LoadEncounterAsync((string)stage["encounter"]);
                StageIndex = index;
            }
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

        private async Awaitable LoadEncounterAsync(string encounterPath)
        {
            var encounter = UomdJson.ParseObject(await _router.Patch.ReadTextAsync(encounterPath));
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
        public async Awaitable StoryFinishedAsync()
        {
            if (InReading) await FinishReadingAsync();
            else if (Current == Phase.PreStory) await StartBattleAsync();
            else if (Current == Phase.PostStory) await CompleteStageAsync();
            else await _router.NavigateToAsync(UomdScreenId.Home);
        }

        /// <summary>The battle screen calls this after the result. A lost tutorial replays from its pre_story, a lost campaign battle restarts.</summary>
        public async Awaitable BattleFinishedAsync(bool won, int stars = 0)
        {
            if (Current != Phase.Battle) return;
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
            _readingEntry = "";
            _router.Session.ActiveStoryJson = null;
            _router.Session.ActiveStoryPath = path;
            await _router.NavigateToAsync(UomdScreenId.Story);
        }

        private async Awaitable StartBattleAsync()
        {
            Current = Phase.Battle;
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
            var account = _router.Session.Account;
            if (account != null) account.tutorialStep = Math.Max(account.tutorialStep, index);
            if (_router.Api.IsSignedIn) _ = RecordAsync(index);
            if (index < 3)
            {
                await StartStageAsync(index + 1);
                return;
            }
            StageIndex = 0;
            Current = Phase.None;
            await _router.NavigateToAsync(UomdScreenId.Finish);
        }

        private async Awaitable RecordAsync(int tutorials)
        {
            try
            {
                await _router.Api.PutEntryAsync(true, tutorials, tutorials >= 3);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[EntryFlow] entry checkpoint not saved: {e.Message}");
            }
        }
    }
}
