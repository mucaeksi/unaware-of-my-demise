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
    /// <summary>
    /// Team builder (port of TeamScene.ts): five presets, a two-front / three-rear formation, owned heroes only. The active
    /// preset is what the server uses to compose the party of every owned-hero stage.
    /// </summary>
    public sealed class TeamScreen : UomdHubScreen
    {
        private static readonly (string Label, float X, float Y)[] Positions =
        {
            ("FRONT", 520f, 400f), ("FRONT", 520f, 600f), ("REAR", 1000f, 330f), ("REAR", 1000f, 500f), ("REAR", 1000f, 670f)
        };
        private const int PerPage = 8;

        private readonly List<(string Id, string Name, int Level, string Role)> _heroes = new List<(string, string, int, string)>();
        private readonly Dictionary<int, (bool Active, List<(string CharacterId, int Slot)> Members)> _presets =
            new Dictionary<int, (bool, List<(string, int)>)>();
        private readonly string?[] _cells = new string?[5];
        private int _slot = 1;
        private int? _picking;
        private int _page;
        private bool _dirty;

        public TeamScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Team;
        protected override string Heading => "TEAM";

        protected override async Awaitable BuildAsync(int generation)
        {
            var api = Router.Api;
            var mine = await api.GetJsonAsync($"/api/v1/characters/mine?releaseId={HubData.Release(Router)}");
            var roster = await HubData.RosterAsync(Router);
            var teams = await api.GetJsonAsync("/api/v1/teams");
            if (!IsCurrent(generation)) return;
            _heroes.Clear();
            foreach (var c in JsonRead.Objects(mine, "characters"))
            {
                string id = JsonRead.Str(c, "id");
                roster.TryGetValue(id, out var meta);
                _heroes.Add((id, meta != null ? JsonRead.Str(meta, "name_en", id) : id, (int)JsonRead.Int(c, "level"), JsonRead.Str(meta, "role").Replace('_', ' ')));
            }
            _heroes.Sort((a, b) => b.Level != a.Level ? b.Level.CompareTo(a.Level) : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
            _presets.Clear();
            int activeSlot = 0;
            foreach (var t in JsonRead.Objects(teams, "teams"))
            {
                int slot = (int)JsonRead.Int(t, "slot");
                bool active = JsonRead.Bool(t, "active");
                if (active) activeSlot = slot;
                _presets[slot] = (active, JsonRead.Objects(t, "members").Select(m => (JsonRead.Str(m, "characterId"), (int)JsonRead.Int(m, "slot"))).ToList());
            }
            if (!_dirty) _slot = activeSlot > 0 ? activeSlot : 1;
            LoadPreset();
            Draw();
        }

        private void LoadPreset()
        {
            Array.Clear(_cells, 0, _cells.Length);
            if (_presets.TryGetValue(_slot, out var preset))
                foreach (var (characterId, slot) in preset.Members) if (slot >= 0 && slot < 5) _cells[slot] = characterId;
            _dirty = false;
            _picking = null;
        }

        private void Draw()
        {
            CloseModal();
            Body.Clear();
            for (int s = 1; s <= 5; s++)
            {
                int slot = s;
                bool has = _presets.TryGetValue(s, out var p);
                Button(330f + (s - 1) * 300f, 175f, $"{(has && p.Active ? "★ " : "")}TEAM {s}", has ? $"{p.Members.Count} heroes" : "empty", 270, 96, 30,
                    s == _slot ? UomdPanelVariant.Hot : UomdPanelVariant.Normal, () => { _slot = slot; LoadPreset(); Draw(); });
            }
            for (int i = 0; i < Positions.Length; i++)
            {
                var pos = Positions[i];
                int at = i;
                var hero = _heroes.FirstOrDefault(h => h.Id == _cells[i]);
                bool filled = _cells[i] != null && hero.Id != null;
                Card(pos.X, pos.Y, 400f, 150f, filled ? UomdPanelVariant.Normal : UomdPanelVariant.Dim, onTap: () => { _picking = at; _page = 0; Draw(); });
                Text(pos.X, pos.Y - 46f, pos.Label, 22, UomdThemeTokens.TextDim, 0.5f, 0.5f, display: true);
                Fit(Text(pos.X, pos.Y - 6f, filled ? hero.Name : "Empty — tap to choose", 34, filled ? UomdThemeTokens.TextPrimary : UomdThemeTokens.TextDim, 0.5f, 0.5f, display: true), 370f);
                if (filled) Fit(Text(pos.X, pos.Y + 40f, $"Lv {hero.Level} · {hero.Role}", 26, UomdThemeTokens.TextDim, 0.5f, 0.5f), 370f);
            }
            int count = _cells.Count(c => c != null);
            Text(RefW / 2f, 790f, count == 0 ? "Without a saved team the server picks your strongest heroes." : $"{count} of 5 slots filled{(_dirty ? " · unsaved changes" : "")}", 30, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            Button(640f, 900f, "SAVE", null, 340, 110, 32, UomdPanelVariant.Hot, () => _ = SaveAsync());
            Button(1010f, 900f, "SET ACTIVE", null, 380, 110, 32, UomdPanelVariant.Normal, () => _ = ActivateAsync());
            Button(1380f, 900f, "CLEAR", null, 340, 110, 32, UomdPanelVariant.Danger, () => _ = ClearAsync());
            if (_picking != null) DrawPicker(_picking.Value);
        }

        private void DrawPicker(int at)
        {
            var used = new HashSet<string>(_cells.Where((c, i) => c != null && i != at).Select(c => c!));
            var free = _heroes.Where(h => !used.Contains(h.Id)).ToList();
            var m = OpenModal(0.86f);
            Text(RefW / 2f, 150f, $"{Positions[at].Label} SLOT — CHOOSE A HERO", 44, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true, into: m);
            if (free.Count == 0) Text(RefW / 2f, 420f, "No free companions. Your roster fills this list.", 32, UomdThemeTokens.TextDim, 0.5f, 0.5f, into: m);
            var items = free.Skip(_page * PerPage).Take(PerPage).ToList();
            for (int i = 0; i < items.Count; i++)
            {
                var h = items[i];
                float x = 400f + (i % 4) * 370f, y = 330f + (i / 4) * 210f;
                Card(x, y, 340f, 180f, UomdPanelVariant.Normal, m, () => { _cells[at] = h.Id; _dirty = true; _picking = null; Draw(); });
                Fit(Text(x, y - 30f, h.Name, 30, UomdThemeTokens.TextPrimary, 0.5f, 0.5f, display: true, into: m), 310f);
                Fit(Text(x, y + 20f, $"Lv {h.Level} · {h.Role}", 24, UomdThemeTokens.TextDim, 0.5f, 0.5f, into: m), 310f);
            }
            int pages = Math.Max(1, (int)Math.Ceiling(free.Count / (double)PerPage));
            if (pages > 1)
            {
                Button(RefW / 2f - 220f, 800f, "‹", null, 150, 96, 52, UomdPanelVariant.Normal, () => { _page = (_page + pages - 1) % pages; Draw(); }, m);
                Button(RefW / 2f + 220f, 800f, "›", null, 150, 96, 52, UomdPanelVariant.Normal, () => { _page = (_page + 1) % pages; Draw(); }, m);
            }
            Button(RefW / 2f - 280f, 930f, "EMPTY SLOT", null, 420, 100, 30, UomdPanelVariant.Normal, () => { _cells[at] = null; _dirty = true; _picking = null; Draw(); }, m);
            Button(RefW / 2f + 280f, 930f, "CANCEL", null, 420, 100, 30, UomdPanelVariant.Normal, () => { _picking = null; Draw(); }, m);
        }

        private List<object?> Members()
        {
            var list = new List<object?>();
            for (int i = 0; i < _cells.Length; i++)
                if (_cells[i] != null)
                    list.Add(new Dictionary<string, object?> { ["characterId"] = _cells[i], ["slot"] = (long)i, ["row"] = i < 2 ? "front" : "rear" });
            return list;
        }

        private async Awaitable<bool> SaveAsync()
        {
            var members = Members();
            if (members.Count == 0)
            {
                Say("Choose at least one hero first.");
                return false;
            }
            try
            {
                await Router.Api.SendJsonAsync("PUT", $"/api/v1/teams/{_slot}", new Dictionary<string, object?>
                {
                    ["name"] = $"Team {_slot}", ["members"] = members, ["releaseId"] = Router.Patch.ActiveReleaseId
                }, idempotent: false);
                Say("Team saved.");
                _dirty = false;
                await RefreshAsync();
                return true;
            }
            catch (Exception e)
            {
                Say(ErrText(e));
                return false;
            }
        }

        private async Awaitable ActivateAsync()
        {
            if (_dirty && !await SaveAsync()) return;
            try
            {
                await Router.Api.SendJsonAsync("POST", $"/api/v1/teams/{_slot}/activate", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId }, idempotent: false);
                Say($"Team {_slot} is now the one that goes into battle.");
                await RefreshAsync();
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        private async Awaitable ClearAsync()
        {
            try
            {
                if (_presets.ContainsKey(_slot))
                    await Router.Api.SendJsonAsync("DELETE", $"/api/v1/teams/{_slot}?releaseId={HubData.Release(Router)}", idempotent: false);
                Array.Clear(_cells, 0, _cells.Length);
                _dirty = false;
                await RefreshAsync();
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }
    }

    /// <summary>
    /// Gear list (port of GearScene.ts). Opened from a companion slot it filters to that slot and offers Equip/Remove;
    /// opened from the hub it lists everything.
    /// </summary>
    public sealed class ArmoryScreen : UomdHubScreen
    {
        private const int PerPage = 6;
        private static readonly Dictionary<string, string> StatName = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["str"] = "STR", ["int"] = "INT", ["vit"] = "VIT", ["agi"] = "AGI", ["power"] = "POWER", ["def"] = "DEF", ["hp"] = "HP", ["atk"] = "ATK",
            ["spd"] = "SPD", ["heal_bonus"] = "HEAL", ["focus_gain"] = "FOCUS", ["effect_res"] = "EFFECT RES", ["element_res"] = "ELEMENT RES"
        };
        private readonly List<Dictionary<string, object?>> _list = new List<Dictionary<string, object?>>();
        private string _characterId = "", _slot = "";
        private int _page;

        public ArmoryScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Gear;
        protected override string Heading => "ARMORY";

        protected override void GoBack()
        {
            bool fromCompanion = _characterId.Length > 0;
            Router.Session.GearCharacterId = "";
            Router.Session.GearSlot = "";
            _ = Router.NavigateToAsync(fromCompanion ? UomdScreenId.Character : UomdScreenId.Home);
        }

        protected override async Awaitable BuildAsync(int generation)
        {
            if (_characterId != Router.Session.GearCharacterId || _slot != Router.Session.GearSlot) _page = 0;
            _characterId = Router.Session.GearCharacterId;
            _slot = Router.Session.GearSlot;
            var all = await HubData.GearAsync(Router);
            if (!IsCurrent(generation)) return;
            _list.Clear();
            _list.AddRange(all.Where(g => _slot.Length == 0 || JsonRead.Str(g, "slot") == _slot));
            Draw();
        }

        /// <summary>format.ts gearStat: whole points read `+1 VIT`, percentages `HEAL +5%`.</summary>
        public static string GearStat(string id, double value)
        {
            var m = System.Text.RegularExpressions.Regex.Match(id, "^(.+)_(flat|pct)$");
            string name = m.Success && StatName.TryGetValue(m.Groups[1].Value, out string n) ? n : id.ToUpperInvariant();
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            if (m.Success && m.Groups[2].Value == "pct") return $"{name} +{(Math.Round(value * 1000) / 10).ToString(inv)}%";
            return $"+{(Math.Round(value * 10) / 10).ToString(inv)} {name}";
        }

        private static string StatLine(Dictionary<string, object?> g)
        {
            if (JsonRead.Get(g, "stats") is Dictionary<string, object?> stats)
            {
                var all = new[] { JsonRead.Obj(stats, "main") }.Concat(JsonRead.Objects(stats, "subs"));
                return string.Join(" · ", all.Select(s => GearStat(JsonRead.Str(s, "stat"), JsonRead.Num(s, "value"))));
            }
            if (JsonRead.Get(g, "passive") is Dictionary<string, object?> passive)
                return JsonRead.Str(passive, "name") + (JsonRead.Get(passive, "supported") is bool supported && !supported ? " · Passive not available yet" : "");
            return "";
        }

        private void Draw()
        {
            Body.Clear();
            Text(RefW / 2f, 160f, _slot.Length > 0 ? $"{_slot} · {_list.Count} owned" : $"{_list.Count} items", 36, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            if (_list.Count == 0) Text(RefW / 2f, 480f, "No gear yet. Stages, errands and the shop bring weapons and relics.", 32, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            var page = _list.Skip(_page * PerPage).Take(PerPage).ToList();
            for (int i = 0; i < page.Count; i++)
            {
                var g = page[i];
                float y = 260f + i * 120f;
                string equippedBy = JsonRead.Str(g, "equippedBy");
                bool mine = _characterId.Length > 0 && equippedBy == _characterId;
                Card(RefW / 2f - 100f, y, 1500f, 108f, mine ? UomdPanelVariant.Hot : UomdPanelVariant.Normal);
                Fit(Text(190f, y - 24f, $"{JsonRead.Str(g, "name")}  {HubData.Stars(JsonRead.Int(g, "rarity"))}", 28, UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true), 1100f);
                string unavailable = JsonRead.Str(g, "unavailableReason");
                Fit(Text(190f, y + 22f, $"{(unavailable.Length > 0 ? unavailable + " · " : "")}{JsonRead.Str(g, "slot")} · Lv {JsonRead.Int(g, "level")}/{JsonRead.Int(g, "levelCap")}{(equippedBy.Length > 0 ? $" · on {equippedBy}" : "")}   {StatLine(g)}", 22, UomdThemeTokens.TextDim, 0f, 0.5f), 1100f);
                if (_characterId.Length == 0) continue;
                long gearId = JsonRead.Int(g, "id");
                bool supported = !(JsonRead.Get(JsonRead.Get(g, "passive"), "supported") is bool s && !s);
                var button = Button(RefW - 250f, y, mine ? "REMOVE" : "EQUIP", null, 280, 90, 28, mine ? UomdPanelVariant.Normal : UomdPanelVariant.Hot, () => _ = ActAsync(async () =>
                {
                    if (mine) await Router.Api.SendJsonAsync("POST", $"/api/v1/gear/{gearId}/unequip", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId }, idempotent: false);
                    else await Router.Api.SendJsonAsync("POST", $"/api/v1/gear/{gearId}/equip", new Dictionary<string, object?> { ["characterId"] = _characterId, ["releaseId"] = Router.Patch.ActiveReleaseId }, idempotent: false);
                    Say(mine ? "Removed" : "Equipped");
                }));
                UomdScreenKit.SetEnabled(button, mine || (unavailable.Length == 0 && supported), mine ? UomdPanelVariant.Normal : UomdPanelVariant.Hot);
            }
            int pages = Math.Max(1, (int)Math.Ceiling(_list.Count / (double)PerPage));
            if (pages > 1)
            {
                Button(RefW / 2f - 220f, 980f, "‹", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _page = (_page + pages - 1) % pages; Draw(); });
                Text(RefW / 2f, 980f, $"{_page + 1} / {pages}", 36, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                Button(RefW / 2f + 220f, 980f, "›", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _page = (_page + 1) % pages; Draw(); });
            }
        }
    }
}
