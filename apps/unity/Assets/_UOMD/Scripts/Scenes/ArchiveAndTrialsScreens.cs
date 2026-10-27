#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    public sealed class ArchiveScreen : RebuildArchiveScreen
    { public ArchiveScreen(UomdSceneRouter router) : base(router) { } }

    /// <summary>
    /// Asynchronous Arena and the Endless Corridor (port of TrialsScene.ts). Both battles are resolved by the server from the
    /// player's team; the screen shows the outcome. Ratings, limits, waves and rewards are server state.
    /// </summary>
    public sealed class TrialsScreen : UomdHubScreen
    {
        private const float ArenaX = 500f, EndlessX = 1420f, ColW = 820f;
        private IReadOnlyDictionary<string, string> _names = new Dictionary<string, string>();
        /// <summary>An endless session whose wave was lost: the server keeps it, but the same team replays the same loss.</summary>
        private string? _fallenSession;

        public TrialsScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Trials;
        protected override string Heading => "TRIALS";

        protected override async Awaitable BuildAsync(int generation)
        {
            string release = HubData.Release(Router);
            var arena = await Router.Api.GetJsonAsync($"/api/v1/arena?releaseId={release}");
            var endless = await Router.Api.GetJsonAsync($"/api/v1/endless?releaseId={release}");
            var catalog = await HubData.CatalogAsync(Router);
            if (!IsCurrent(generation)) return;
            _names = catalog.Names;
            DrawArena(arena);
            DrawEndless(endless);
        }

        private string Rewards(Dictionary<string, object?> node, string key) => HubText.Attachments(JsonRead.Objects(node, key), _names);

        private void ColumnHead(float x, string title, string line)
        {
            Text(x, 190f, title, 34, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true);
            Fit(Text(x, 245f, line, 24, UomdThemeTokens.TextDim, 0.5f, 0.5f), ColW);
        }

        private void DrawArena(Dictionary<string, object?> a)
        {
            int defense = JsonRead.Arr(a, "defense").Count;
            string tier = HubText.IdLabel(JsonRead.Str(a, "tier"));
            var season = JsonRead.Obj(a, "season");
            long used = JsonRead.Int(a, "dailyUsed"), limit = JsonRead.Int(a, "dailyLimit");
            ColumnHead(ArenaX, "ARENA", $"{tier} · rating {JsonRead.Int(a, "rating")} · matches {used}/{limit} · season ends {HubText.Day(JsonRead.Num(season, "endsAtMs"))}");
            if (!JsonRead.Bool(a, "unlocked"))
            {
                Text(ArenaX, 450f, "Clear a campaign battle to enter the Arena.", 30, UomdThemeTokens.TextDim, 0.5f, 0.5f);
                return;
            }
            bool canFight = used < limit;
            var opponents = JsonRead.Objects(a, "opponents").ToList();
            for (int i = 0; i < opponents.Count; i++)
            {
                var o = opponents[i];
                float y = 350f + i * 115f;
                string id = JsonRead.Str(o, "opponentId"), name = JsonRead.Str(o, "displayName");
                Card(ArenaX, y, ColW, 100f);
                Fit(Text(ArenaX - ColW / 2f + 30f, y - 18f, name, 28, UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true), 520f);
                Text(ArenaX - ColW / 2f + 30f, y + 22f, $"Lv {JsonRead.Int(o, "level")} · rating {JsonRead.Int(o, "rating")}", 22, UomdThemeTokens.TextDim, 0f, 0.5f);
                var fight = Button(ArenaX + ColW / 2f - 130f, y, "FIGHT", null, 220, 80, 26, canFight ? UomdPanelVariant.Hot : UomdPanelVariant.Dim, () => _ = TrialAsync(async () =>
                {
                    var r = await Router.Api.SendJsonAsync("POST", "/api/v1/arena/match", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId, ["opponentId"] = id });
                    long delta = JsonRead.Int(r, "ratingDelta");
                    return $"{(JsonRead.Bool(r, "won") ? "Victory" : "Defeat")} against {name} in {JsonRead.Int(r, "turns")} turns · rating {(delta >= 0 ? "+" : "")}{delta} → {JsonRead.Int(r, "ratingAfter")} · {Rewards(r, "rewards")}";
                }));
                UomdScreenKit.SetEnabled(fight, canFight, UomdPanelVariant.Hot);
            }
            bool claimed = JsonRead.Bool(a, "seasonClaimed");
            bool claimable = JsonRead.Int(a, "wins") >= 1 && !claimed;
            Fit(Text(ArenaX, 720f, $"Season reward ({tier}): {Rewards(a, "seasonRewards")}", 22, UomdThemeTokens.TextDim, 0.5f, 0.5f), ColW);
            Button(ArenaX - 210f, 810f, defense > 0 ? "UPDATE DEFENSE" : "SET DEFENSE", defense > 0 ? $"{defense} guard{(defense == 1 ? "" : "s")} active" : "Use active team",
                380, 100, 24, defense > 0 ? UomdPanelVariant.Normal : UomdPanelVariant.Hot, () => _ = TrialAsync(SaveDefenseAsync));
            string seasonId = JsonRead.Str(season, "seasonId");
            var claim = Button(ArenaX + 210f, 810f, claimed ? "SEASON CLAIMED" : "CLAIM SEASON", claimable || claimed ? null : "Win a match first", 380, 100, 24,
                claimable ? UomdPanelVariant.Hot : UomdPanelVariant.Dim, () => _ = TrialAsync(async () =>
                {
                    var r = await Router.Api.SendJsonAsync("POST", "/api/v1/arena/season/claim", new Dictionary<string, object?> { ["seasonId"] = seasonId, ["releaseId"] = Router.Patch.ActiveReleaseId });
                    return $"Season reward ({HubText.IdLabel(JsonRead.Str(r, "tier"))}): {Rewards(r, "rewards")}";
                }));
            UomdScreenKit.SetEnabled(claim, claimable, UomdPanelVariant.Hot);
        }

        private void DrawEndless(Dictionary<string, object?> s)
        {
            ColumnHead(EndlessX, "ENDLESS CORRIDOR", $"Best wave {JsonRead.Int(s, "bestWave")}");
            if (!JsonRead.Bool(s, "unlocked"))
            {
                Text(EndlessX, 450f, "Clear a campaign battle to enter the corridor.", 30, UomdThemeTokens.TextDim, 0.5f, 0.5f);
                return;
            }
            var run = JsonRead.Get(s, "activeRun") as Dictionary<string, object?>;
            if (run != null && (JsonRead.Str(run, "releaseId") != Router.Patch.ActiveReleaseId || JsonRead.Str(run, "sessionId") == _fallenSession)) run = null;
            if (run != null)
            {
                string session = JsonRead.Str(run, "sessionId");
                long wave = JsonRead.Int(run, "wave");
                Text(EndlessX, 330f, $"Run in progress · {HubText.IdLabel(JsonRead.Str(run, "modifier"))}", 26, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                Button(EndlessX, 430f, $"FIGHT WAVE {wave}", null, 560, 110, 30, UomdPanelVariant.Hot, () => _ = TrialAsync(async () =>
                {
                    try
                    {
                        var r = await Router.Api.SendJsonAsync("POST", "/api/v1/endless/wave", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId, ["sessionId"] = session });
                        return $"Wave {JsonRead.Int(r, "clearedWave")} cleared in {JsonRead.Int(r, "turns")} turns · {Rewards(r, "rewards")}";
                    }
                    catch (UomdApiException e) when (e.Code == "wave_not_won")
                    {
                        _fallenSession = session;
                        return $"The corridor held at wave {wave}. Start a new run.";
                    }
                }));
            }
            else
            {
                Text(EndlessX, 320f, "Start a run with one blessing:", 26, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                var mods = JsonRead.Objects(s, "availableModifiers").ToList();
                for (int i = 0; i < mods.Count; i++)
                {
                    string modifier = JsonRead.Str(mods[i], "id");
                    Button(EndlessX, 400f + i * 100f, HubText.IdLabel(modifier).ToUpperInvariant(), JsonRead.Str(mods[i], "description"), 600, 90, 24, UomdPanelVariant.Normal, () => _ = TrialAsync(async () =>
                    {
                        _fallenSession = null;
                        await Router.Api.SendJsonAsync("POST", "/api/v1/endless/start", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId, ["modifier"] = modifier });
                        return $"Run started · {HubText.IdLabel(modifier)}";
                    }));
                }
            }
            var milestones = JsonRead.Objects(s, "milestones").ToList();
            for (int i = 0; i < milestones.Count; i++)
            {
                var ms = milestones[i];
                float y = 720f + i * 95f;
                bool claimed = JsonRead.Bool(ms, "claimed"), ready = JsonRead.Bool(ms, "ready");
                long wave = JsonRead.Int(ms, "wave");
                Card(EndlessX, y, ColW, 82f, claimed ? UomdPanelVariant.Dim : ready ? UomdPanelVariant.Hot : UomdPanelVariant.Normal);
                Fit(Text(EndlessX - ColW / 2f + 30f, y, $"Wave {wave}: {Rewards(ms, "rewards")}", 22, claimed ? UomdThemeTokens.TextDim : UomdThemeTokens.TextPrimary, 0f, 0.5f), 540f);
                var b = Button(EndlessX + ColW / 2f - 120f, y, claimed ? "CLAIMED" : "CLAIM", null, 200, 70, 22, ready && !claimed ? UomdPanelVariant.Hot : UomdPanelVariant.Dim, () => _ = TrialAsync(async () =>
                {
                    var r = await Router.Api.SendJsonAsync("POST", "/api/v1/endless/milestone/claim", new Dictionary<string, object?> { ["wave"] = wave, ["releaseId"] = Router.Patch.ActiveReleaseId });
                    return $"Wave {JsonRead.Int(r, "wave")} milestone: {Rewards(r, "rewards")}";
                }));
                UomdScreenKit.SetEnabled(b, ready && !claimed, UomdPanelVariant.Hot);
            }
        }

        /// <summary>The active team, or the five strongest heroes (two front-role heroes in front) when none is saved.</summary>
        private async Awaitable<string> SaveDefenseAsync()
        {
            var teams = await Router.Api.GetJsonAsync("/api/v1/teams");
            var active = JsonRead.Objects(teams, "teams").FirstOrDefault(t => JsonRead.Bool(t, "active"));
            var members = new List<object?>();
            if (active != null)
                foreach (var m in JsonRead.Objects(active, "members"))
                    members.Add(new Dictionary<string, object?> { ["characterId"] = JsonRead.Str(m, "characterId"), ["slot"] = JsonRead.Int(m, "slot"), ["row"] = JsonRead.Str(m, "row") });
            if (members.Count == 0)
            {
                var mine = await Router.Api.GetJsonAsync($"/api/v1/characters/mine?releaseId={HubData.Release(Router)}");
                var roster = await HubData.RosterAsync(Router);
                var top = JsonRead.Objects(mine, "characters").OrderByDescending(c => JsonRead.Int(c, "level")).ThenBy(c => JsonRead.Str(c, "id"), StringComparer.Ordinal).Take(5).ToList();
                var frontRole = new System.Text.RegularExpressions.Regex("tank|bruiser|vanguard|knight|defender|shield|warden|front", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                int front = 0, rear = 0;
                for (int slot = 0; slot < top.Count; slot++)
                {
                    string id = JsonRead.Str(top[slot], "id");
                    bool wantFront = frontRole.IsMatch(roster.TryGetValue(id, out var meta) ? JsonRead.Str(meta, "role") : "");
                    string row;
                    if (wantFront && front < 2) { front++; row = "front"; }
                    else if (rear < 3) { rear++; row = "rear"; }
                    else { front++; row = "front"; }
                    members.Add(new Dictionary<string, object?> { ["characterId"] = id, ["slot"] = (long)slot, ["row"] = row });
                }
            }
            await Router.Api.SendJsonAsync("PUT", "/api/v1/arena/defense", new Dictionary<string, object?> { ["members"] = members, ["releaseId"] = Router.Patch.ActiveReleaseId });
            return $"Arena defense set ({members.Count} guard{(members.Count == 1 ? "" : "s")})";
        }

        /// <summary>One server action at a time; the screen re-reads server state afterwards, success or not.</summary>
        private async Awaitable TrialAsync(Func<Awaitable<string>> run)
        {
            await ActAsync(async () =>
            {
                try
                {
                    Say(await run());
                    await UpdateWalletAsync();
                }
                catch (Exception e)
                {
                    Say(ErrText(e));
                }
            });
        }
    }
}
