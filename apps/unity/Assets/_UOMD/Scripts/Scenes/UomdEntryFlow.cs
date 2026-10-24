using System;
using System.IO;
using UnityEngine;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>
    /// The first-install entry flow (port of apps/game/src/entry/flow.ts + tutorial.ts): prologue, then tutorial stages
    /// T-1..T-3 from entry/entry_index.json, each pre_story → battle → post_story, then the Finish page. A stage counts as
    /// done only after its post_story; progress goes to the account (PUT /api/v1/entry) when signed in.
    /// </summary>
    public sealed class UomdEntryFlow
    {
        public enum Phase { None, PreStory, Battle, PostStory }

        private readonly UomdSceneRouter _router;
        private string _preStory = "";
        private string _postStory = "";

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
            await _router.NavigateToAsync(UomdScreenId.Home);
        }

        /// <summary>Starts tutorial stage <paramref name="index"/> (1-based) at its pre_story.</summary>
        public async Awaitable StartStageAsync(int index)
        {
            try
            {
                var entry = UomdJson.ParseObject(await _router.Patch.ReadTextAsync("entry/entry_index.json"));
                var stages = entry.TryGetValue("tutorial", out object list) ? list as System.Collections.Generic.List<object> : null;
                if (stages == null || index < 1 || index > stages.Count) throw new InvalidDataException($"entry index has no tutorial stage {index}");
                var stage = (System.Collections.Generic.Dictionary<string, object>)stages[index - 1];
                string encounterPath = (string)stage["encounter"];
                var encounter = UomdJson.ParseObject(await _router.Patch.ReadTextAsync(encounterPath));
                _preStory = encounter.TryGetValue("pre_story", out object pre) ? pre as string ?? "" : "";
                _postStory = encounter.TryGetValue("post_story", out object post) ? post as string ?? "" : "";
                StageIndex = index;
                _router.Session.ActiveBattleEncounterId = Path.GetFileNameWithoutExtension(encounterPath);
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

        /// <summary>The story screen calls this when its scene completes.</summary>
        public async Awaitable StoryFinishedAsync()
        {
            if (Current == Phase.PreStory) await StartBattleAsync();
            else if (Current == Phase.PostStory) await CompleteStageAsync();
            else await _router.NavigateToAsync(UomdScreenId.Home);
        }

        /// <summary>The battle screen calls this after the result. A loss replays the stage from its pre_story.</summary>
        public async Awaitable BattleFinishedAsync(bool won)
        {
            if (Current != Phase.Battle) return;
            if (!won)
            {
                await StartStageAsync(StageIndex);
                return;
            }
            if (!string.IsNullOrEmpty(_postStory)) await PlayStoryAsync(Phase.PostStory, _postStory);
            else await CompleteStageAsync();
        }

        public bool InEntryBattle => Current == Phase.Battle && StageIndex > 0;

        private async Awaitable PlayStoryAsync(Phase phase, string path)
        {
            Current = phase;
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
