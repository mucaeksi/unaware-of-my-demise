using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Core.Growth;

namespace Uomd.Scenes
{
    /// <summary>Native companion, formation and equipment screens over the existing provider contracts.</summary>
    public abstract class RebuildCompanyScreen : RebuildHubScreen
    {
        private readonly string[] _cells = new string[5];
        private string _draftScope = "", _expression = "composed", _portraitCharacter = "";
        private int _preset = 1;
        private bool _dirty;
        protected RebuildCompanyScreen(UomdSceneRouter router) : base(router) { }
        protected override string Heading => ScreenId == UomdScreenId.Character ? "COMPANION" : ScreenId == UomdScreenId.Team ? "TEAM" : "ARMORY";
        protected override void Navigate(UomdScreenId target)
        {
            if (_dirty && ScreenId == UomdScreenId.Team && target != UomdScreenId.Team)
            { ConfirmDiscard(() => { _dirty = false; base.Navigate(target); }); return; }
            base.Navigate(target);
        }
        protected override void Back()
        {
            if (Actions.Busy) return;
            if (OverlayOpen) { base.Back(); return; }
            if (ScreenId == UomdScreenId.Gear)
            {
                bool companion = !string.IsNullOrEmpty(Router.Session.GearCharacterId);
                Router.Session.GearCharacterId = Router.Session.GearSlot = "";
                Navigate(companion ? UomdScreenId.Character : UomdScreenId.Roster); return;
            }
            if (_dirty) { ConfirmDiscard(() => { _dirty = false; Navigate(UomdScreenId.Roster); }); return; }
            Navigate(UomdScreenId.Roster);
        }
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            if (!snapshot.SignedIn) { Text(Panel(Body, "hub-main"), "Sign in to load your company.", "hub-copy"); return; }
            if (ScreenId == UomdScreenId.Character) Companion(snapshot);
            else if (ScreenId == UomdScreenId.Team) Team(snapshot);
            else Armory(snapshot);
        }
        private VisualElement Card(VisualElement parent, string heading)
        { var card = new VisualElement(); card.AddToClassList("system-card"); parent.Add(card); Text(card, heading, "hub-card-title"); return card; }
        private void Spend(VisualElement parent, string label, string name, string cost, string result, bool eligible, string path, Dictionary<string, object> input)
        {
            var card = Card(parent, label); Text(card, cost, "hub-copy"); Text(card, result, "hub-small");
            var button = Button(card, label, name, () => _ = Actions.ExecuteAsync(path, input, label + " · " + cost), "hub-primary"); button.SetEnabled(CanWrite && eligible);
        }
        private HubData.Catalog Catalog(UomdHubSnapshot snapshot)
        {
            var catalog = new HubData.Catalog();
            foreach (var item in JsonRead.Objects(snapshot.Catalog, "items"))
            {
                string id = JsonRead.Str(item, "item_id"); catalog.Names[id] = JsonRead.Str(item, "name_en", id);
                if (JsonRead.Str(item, "kind") == "character_xp" && JsonRead.Int(item, "xp_value") > 0) catalog.XpItems.Add((id, (int)JsonRead.Int(item, "xp_value")));
            }
            catalog.XpItems.Sort((a,b) => a.Xp.CompareTo(b.Xp));
            catalog.Progression = ProgressionConfig.From(JsonRead.Get(JsonRead.Obj(JsonRead.Obj(snapshot.Catalog, "config"), "progression"), "character"));
            return catalog;
        }
        private void Companion(UomdHubSnapshot snapshot)
        {
            string id = Router.Session.SelectedUnitId ?? "";
            if (_portraitCharacter != id) { _portraitCharacter = id; _expression = "composed"; }
            var owned = snapshot.Companions.FirstOrDefault(c => c.Id == id);
            var aside = Panel(Body, "hub-aside");
            Text(aside, owned?.Name ?? "COMPANION", "hub-card-title");
            if (owned?.Available != true)
            { Text(aside, owned == null ? "You do not own this companion." : "This companion is unavailable in this content version. Your ownership is preserved.", "hub-copy"); return; }
            Text(aside, new string('★', owned.Rarity) + " · " + owned.Element + " · " + owned.Role, "hub-copy");
            if (id == "fadyme" || id == "mahmut")
            {
                var image = new VisualElement { pickingMode = PickingMode.Ignore }; image.AddToClassList("hub-portrait"); aside.Add(image);
                string portrait = Router.Media.Catalog.SolPortrait(id, _expression);
                RegisterPortrait(image, portrait);
                if (portrait == null) Text(aside, "This expression is unavailable. Choose another expression.", "hub-small");
                Button(aside, "EXPRESSION: " + _expression.Replace('_', ' ').ToUpperInvariant(), "companionExpression", () => { _expression = UomdCompanionAttachment.NextExpression(id, _expression); Draw(); });
            }
            else Text(aside, "Portrait unavailable.", "hub-small");
            Button(aside, "TEAM", "companionTeam", () => Navigate(UomdScreenId.Team));
            var main = Panel(Body, "hub-main"); var list = Scroll(main);
            var raw = JsonRead.Objects(snapshot.Mine, "characters").First(c => JsonRead.Str(c, "id") == id); var character = CharacterView.From(raw);
            var catalog = Catalog(snapshot);
            var have = JsonRead.Objects(snapshot.Stacks, "stacks").ToDictionary(i => JsonRead.Str(i, "item_id"), i => (int)JsonRead.Int(i, "qty"));
            Text(list, "Level " + character.Level + "/" + character.Cap + " · Ascension " + character.Ascension, "hub-card-title");
            Text(list, character.XpToNext == null ? "Maximum level" : "XP " + character.Xp + "/" + character.XpToNext, "hub-copy");
            if (snapshot.Stats == null) Text(list, "Stats are unavailable. Refresh to retry.", "hub-copy");
            else
            {
                var attrs = JsonRead.Get(snapshot.Stats, "attributes") as Dictionary<string, object>; var stats = JsonRead.Obj(snapshot.Stats, "stats");
                if (attrs != null) Text(list, string.Join(" · ", new[] { "str", "int", "vit", "agi" }.Select(k => k.ToUpperInvariant() + " " + JsonRead.Int(attrs, k) + (k == JsonRead.Str(snapshot.Stats, "power") ? " ◆" : ""))), "hub-copy");
                Text(list, string.Join(" · ", new[] { "hp", "atk", "def", "spd" }.Select(k => k.ToUpperInvariant() + " " + Math.Round(JsonRead.Num(stats, k)).ToString(CultureInfo.InvariantCulture))), "hub-copy");
                Text(list, JsonRead.Get(stats, "crit_rate") == null ? "CRIT unavailable" : "CRIT " + (JsonRead.Num(stats, "crit_rate") * 100).ToString("0.#", CultureInfo.InvariantCulture) + "%", "hub-small");
            }
            int balance = (int)Math.Min(int.MaxValue, snapshot.Balance ?? 0);
            string path = "/api/v1/characters/" + Uri.EscapeDataString(id);
            var level = UomdGrowth.PlanLevelUp(character, snapshot.AccountLevel, balance, have, catalog.XpItems, catalog.Progression, "Bell's Remains", catalog.Name);
            var xp = new Dictionary<string, object>();
            if (level.XpItem != null) xp["items"] = new object[] { new Dictionary<string, object> { ["itemId"] = level.XpItem.Value.ItemId, ["quantity"] = 1L } };
            Spend(list, "LEVEL UP", "companionLevel", level.CostSummary, level.CanExecute ? level.ResultSummary : level.Reason, level.CanExecute, path + "/level-up", xp);
            var cleared = new HashSet<string>(snapshot.Progress.Where(p => p.Value.Stars > 0).Select(p => p.Key));
            var ascend = UomdGrowth.PlanAscension(character, snapshot.AccountLevel, balance, have, cleared, "Bell's Remains", catalog.Name);
            Spend(list, "ASCEND", "companionAscend", ascend.CostSummary, ascend.CanExecute ? ascend.ResultSummary : ascend.Reason, ascend.CanExecute, path + "/ascend", new Dictionary<string, object>());
            foreach (var skill in character.Skills)
            {
                var plan = UomdGrowth.PlanSkillUpgrade(skill, character.Level, balance, have, "Bell's Remains", catalog.Name);
                Spend(list, skill.Name + " · RANK UP", "companionSkill_" + skill.SkillId, plan.CostSummary, plan.CanExecute ? plan.ResultSummary : plan.Reason, plan.CanExecute, path + "/skills/" + Uri.EscapeDataString(skill.SkillId) + "/upgrade", new Dictionary<string, object>());
            }
            if (character.Resonance != null)
            {
                var res = character.Resonance;
                Text(list, "Memory Shards " + character.Shards + " · Resonance " + res.Tier + "/" + res.MaxTier, "hub-card-title");
                if (JsonRead.Get(snapshot.Stats, "attributes") is Dictionary<string, object>) Text(list, "+" + ((res.Tier + 1) / 2) + " VIT · +" + (res.Tier / 2) + " POWER", "hub-copy");
                else if (snapshot.Stats != null) Text(list, "+" + res.BonusPct.ToString(CultureInfo.InvariantCulture) + "% HP/ATK/DEF", "hub-copy");
                Spend(list, "ATTUNE", "companionAttune", res.NextShardCost == null ? "Maximum resonance" : res.NextShardCost + " Memory Shards", "Optional keepsake · no additional currency fee", res.NextShardCost != null && character.Shards >= res.NextShardCost, path + "/shards/attune", new Dictionary<string, object>());
                if (res.ExcessShards > 0) Spend(list, "EXCHANGE EXCESS", "companionConvert", res.ExcessShards + " excess Memory Shards", res.ExcessShards + " " + catalog.Name(res.ExcessItemId), true, path + "/shards/convert", new Dictionary<string, object> { ["shards"] = (long)res.ExcessShards });
            }
            foreach (string slot in new[] { "weapon", "armor", "necklace", "ring" })
            {
                var gear = JsonRead.Objects(snapshot.Gear, "gear").FirstOrDefault(g => JsonRead.Str(g, "slot") == slot && JsonRead.Str(g, "equippedBy") == id);
                string selectedSlot = slot; var card = Card(list, slot.ToUpperInvariant());
                Text(card, gear == null ? "Empty" : JsonRead.Str(gear, "name") + " · Level " + JsonRead.Int(gear, "level"), "hub-copy");
                Button(card, "CHANGE", "companionGear_" + slot, () => { Router.Session.GearCharacterId = id; Router.Session.GearSlot = selectedSlot; Navigate(UomdScreenId.Gear); });
            }
        }
        private void LoadPreset(UomdHubSnapshot snapshot, int preset)
        {
            _preset = preset; Array.Clear(_cells, 0, _cells.Length);
            var saved = JsonRead.Objects(snapshot.Teams, "teams").FirstOrDefault(t => JsonRead.Int(t, "slot") == preset);
            if (saved != null) foreach (var member in JsonRead.Objects(saved, "members"))
            { int slot = (int)JsonRead.Int(member, "slot", -1); if (slot >= 0 && slot < 5) _cells[slot] = JsonRead.Str(member, "characterId"); }
            _dirty = false;
        }
        private void ConfirmDiscard(Action next)
        { var picker = OpenPicker(); Text(picker, "Discard unsaved formation changes?", "hub-copy"); Button(picker, "DISCARD CHANGES", "teamDiscard", () => { CloseRoutes(); next(); }); }
        private void Team(UomdHubSnapshot snapshot)
        {
            string scope = snapshot.PlayerId + ":" + Router.Api.AuthRevision + ":" + snapshot.Release;
            if (_draftScope != scope)
            {
                _draftScope = scope; var active = JsonRead.Objects(snapshot.Teams, "teams").FirstOrDefault(t => JsonRead.Bool(t, "active"));
                LoadPreset(snapshot, active == null ? 1 : (int)JsonRead.Int(active, "slot", 1));
            }
            else if (!_dirty) LoadPreset(snapshot, _preset);
            var aside = Panel(Body, "hub-aside"); Text(aside, "PRESETS", "hub-card-title");
            foreach (int number in Enumerable.Range(1, 5))
            {
                int chosen = number; bool active = JsonRead.Objects(snapshot.Teams, "teams").Any(t => JsonRead.Int(t, "slot") == number && JsonRead.Bool(t, "active"));
                string presetName = JsonRead.Str(JsonRead.Objects(snapshot.Teams, "teams").FirstOrDefault(t => JsonRead.Int(t, "slot") == number), "name");
                var b = Button(aside, "TEAM " + number + (presetName.Length > 0 && presetName != "Team " + number ? " · " + presetName : "") + (active ? " · ACTIVE" : ""), "teamPreset_" + number, () =>
                { void Switch() { LoadPreset(snapshot, chosen); Draw(); } if (_dirty) ConfirmDiscard(Switch); else Switch(); });
                b.SetEnabled(!Actions.Busy); if (_preset == number) b.AddToClassList("hub-selected");
            }
            var main = Panel(Body, "hub-main"); var list = Scroll(main);
            Text(list, "2 FRONT · 3 REAR", "hub-card-title");
            Text(list, _dirty ? "Unsaved changes · Save before activating." : "The active preset is used for owned-hero battles.", "hub-copy");
            for (int i = 0; i < 5; i++)
            {
                int at = i; var companion = snapshot.Companions.FirstOrDefault(c => c.Id == _cells[at]);
                var b = Button(list, (at < 2 ? "FRONT " : "REAR ") + (at + 1) + " · " + (companion?.Name ?? (_cells[at] == null ? "Empty — tap to choose" : "Unavailable companion")), "teamCell_" + at, () => Choose(snapshot, at), "hub-nav"); b.SetEnabled(CanWrite);
            }
            bool valid = _cells.Any(c => c != null) && _cells.Where(c => c != null).All(id => snapshot.Companions.Any(c => c.Id == id && c.Available));
            var save = Button(list, "SAVE TEAM " + _preset, "teamSave", () => _ = SaveTeam(false), "hub-primary"); save.SetEnabled(CanWrite && valid);
            var activate = Button(list, "SAVE & SET ACTIVE", "teamActivate", () => _ = SaveTeam(true)); activate.SetEnabled(CanWrite && valid);
            var clear = Button(list, "CLEAR PRESET", "teamClear", () => { int selected = _preset; var picker = OpenPicker(); Text(picker, "Clear Team " + selected + "?", "hub-copy"); Button(picker, "CONFIRM CLEAR", "teamConfirmClear", () => { CloseRoutes(); _ = ClearTeam(selected); }); }); clear.SetEnabled(CanWrite);
        }
        private void Choose(UomdHubSnapshot snapshot, int at)
        {
            var picker = OpenPicker(); Text(picker, "CHOOSE A COMPANION", "hub-card-title");
            foreach (var c in snapshot.Companions.Where(c => c.Available && !_cells.Where((_,i) => i != at).Contains(c.Id)))
            { string id = c.Id; Button(picker, c.Name + " · Level " + c.Level, "teamChoose_" + id, () => { _cells[at] = id; _dirty = true; CloseRoutes(); Draw(); }); }
            Button(picker, "EMPTY SLOT", "teamEmpty", () => { _cells[at] = null; _dirty = true; CloseRoutes(); Draw(); });
        }
        private async Awaitable SaveTeam(bool activate)
        {
            if (!CanWrite) return;
            int preset = _preset; string account = Router.Api.AccountKey; int revision = Router.Api.AuthRevision; string release = Router.Patch.ActiveReleaseId;
            string name = JsonRead.Str(JsonRead.Objects(Data.Snapshot.Teams, "teams").FirstOrDefault(t => JsonRead.Int(t, "slot") == preset), "name", "Team " + preset);
            var members = _cells.Select((id,i) => new {id,i}).Where(x => x.id != null).Select(x => (object)new Dictionary<string, object> { ["characterId"] = x.id, ["slot"] = (long)x.i, ["row"] = x.i < 2 ? "front" : "rear" }).ToArray();
            bool saved = await Actions.PlainAsync("PUT", "/api/v1/teams/" + preset, new Dictionary<string, object> { ["name"] = name, ["members"] = members, ["releaseId"] = release });
            if (!saved || account != Router.Api.AccountKey || revision != Router.Api.AuthRevision || release != Router.Patch.ActiveReleaseId) return;
            _dirty = false;
            if (activate) await Actions.PlainAsync("POST", "/api/v1/teams/" + preset + "/activate", new Dictionary<string, object> { ["releaseId"] = release });
            if (Data.ContextCurrent) Draw();
        }
        private async Awaitable ClearTeam(int preset)
        {
            if (!CanWrite) return;
            bool saved = await Actions.PlainAsync("DELETE", "/api/v1/teams/" + preset + "?releaseId=" + Uri.EscapeDataString(Data.Snapshot.Release), null);
            if (saved) { if (_preset == preset) _dirty = false; if (Data.ContextCurrent) Draw(); }
        }
        private void Armory(UomdHubSnapshot snapshot)
        {
            string character = Router.Session.GearCharacterId ?? "", slot = Router.Session.GearSlot ?? "";
            var aside = Panel(Body, "hub-aside"); Text(aside, slot.Length > 0 ? slot.ToUpperInvariant() : "ALL EQUIPMENT", "hub-card-title");
            Text(aside, character.Length > 0 ? snapshot.Companions.FirstOrDefault(c => c.Id == character)?.Name ?? "Unavailable companion" : "Choose a companion to change their equipment.", "hub-copy");
            if (character.Length == 0)
            {
                var choices = Scroll(aside);
                foreach (var c in snapshot.Companions.Where(c => c.Available))
                { string id = c.Id; Button(choices, c.Name, "gearSelect_" + id, () => { Router.Session.GearCharacterId = id; Draw(); }); }
            }
            else Button(aside, "ALL COMPANIONS", "gearAllCompanions", () => { Router.Session.GearCharacterId = Router.Session.GearSlot = ""; Draw(); });
            var main = Panel(Body, "hub-main"); var list = Scroll(main);
            var equipment = JsonRead.Objects(snapshot.Gear, "gear").Where(g => slot.Length == 0 || JsonRead.Str(g, "slot") == slot).ToList();
            Text(list, equipment.Count + " ITEMS", "hub-card-title"); if (equipment.Count == 0) Text(list, "No gear yet. Stages, errands and the shop bring weapons and relics.", "hub-copy");
            foreach (var gear in equipment)
            {
                long id = JsonRead.Int(gear, "id"); string equipped = JsonRead.Str(gear, "equippedBy"), unavailable = JsonRead.Str(gear, "unavailableReason");
                bool mine = character.Length > 0 && equipped == character, supported = !(JsonRead.Get(JsonRead.Get(gear, "passive"), "supported") is bool s && !s);
                var card = Card(list, JsonRead.Str(gear, "name", "Unavailable equipment"));
                Text(card, JsonRead.Str(gear, "slot") + " · Level " + JsonRead.Int(gear, "level") + "/" + JsonRead.Int(gear, "levelCap") + (equipped.Length > 0 ? " · on " + equipped : ""), "hub-copy");
                if (JsonRead.Get(gear, "stats") is Dictionary<string, object> stats)
                    Text(card, string.Join(" · ", new[] { JsonRead.Obj(stats, "main") }.Concat(JsonRead.Objects(stats, "subs")).Select(s => ArmoryScreen.GearStat(JsonRead.Str(s, "stat"), JsonRead.Num(s, "value")))), "hub-small");
                Text(card, unavailable.Length > 0 ? unavailable : !supported ? "Passive not available yet" : JsonRead.Str(JsonRead.Get(gear, "passive"), "name"), "hub-small");
                if (character.Length == 0) continue;
                var b = Button(card, mine ? "REMOVE" : equipped.Length > 0 ? "MOVE & EQUIP" : "EQUIP", "gearAction_" + id, () => _ = Actions.PlainAsync("POST", "/api/v1/gear/" + id + (mine ? "/unequip" : "/equip"), mine ? new Dictionary<string, object> { ["releaseId"] = snapshot.Release } : new Dictionary<string, object> { ["releaseId"] = snapshot.Release, ["characterId"] = character }));
                b.SetEnabled(CanWrite && (mine || unavailable.Length == 0 && supported && snapshot.Companions.Any(c => c.Id == character && c.Available)));
            }
        }
    }
}
