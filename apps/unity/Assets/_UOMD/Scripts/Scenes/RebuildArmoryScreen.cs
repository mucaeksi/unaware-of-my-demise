using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine.UIElements;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>Instance selection and explicit cost review over the authoritative gear provider.</summary>
    public abstract class RebuildArmoryScreen : RebuildHubScreen
    {
        private long _selected;
        private string _scope = "", _origin = "", _originAccount = "";
#if UNITY_EDITOR
        public long ReviewSelectedId => _selected;
#endif
        protected RebuildArmoryScreen(UomdSceneRouter router) : base(router) { }
        protected override string Heading => "ARMORY";
        protected override void Entered() { _origin = Router.Session.GearCharacterId ?? ""; _originAccount = Router.Api.AccountKey; _selected = 0; _scope = ""; }
        protected override void Back()
        {
            if (Actions.Busy) return;
            if (OverlayOpen) { base.Back(); return; }
            Router.Session.GearCharacterId = Router.Session.GearSlot = "";
            bool companion = _origin.Length > 0 && _originAccount == Router.Api.AccountKey;
            if (companion) Router.Session.SelectedUnitId = _origin;
            Navigate(companion ? UomdScreenId.Character : UomdScreenId.Roster);
        }
        private VisualElement Card(VisualElement parent, string heading)
        { var card = new VisualElement(); card.AddToClassList("system-card"); parent.Add(card); Text(card, heading, "hub-card-title"); return card; }
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            if (!snapshot.SignedIn) { Text(Panel(Body, "hub-main"), "Sign in to view your equipment.", "hub-copy"); return; }
            var model = snapshot.Equipment;
            if (model == null) { Text(Panel(Body, "hub-main"), "Equipment rules are unavailable. Refresh to retry.", "hub-copy"); return; }
            string scope = snapshot.PlayerId + ":" + Router.Api.AuthRevision + ":" + snapshot.Release;
            if (_scope != scope) { _scope = scope; _selected = 0; }
            string slot = Router.Session.GearSlot ?? "", target = Router.Session.GearCharacterId ?? "";
            var equipment = model.Items.Where(g => slot.Length == 0 || g.Slot == slot).ToList();
            if (!equipment.Any(g => g.Id == _selected)) _selected = equipment.FirstOrDefault()?.Id ?? 0;
            var aside = Panel(Body, "hub-aside"); Text(aside, slot.Length > 0 ? slot.ToUpperInvariant() : "ALL EQUIPMENT", "hub-card-title");
            Button(aside, "FILTER: " + (slot.Length == 0 ? "ALL" : slot.ToUpperInvariant()), "gearFilter", () => ChooseSlot());
            Text(aside, equipment.Count + " items · choose to inspect", "hub-small");
            var choices = Scroll(aside);
            foreach (var gear in equipment)
            {
                long id = gear.Id;
                var b = Button(choices, gear.Name + " · Lv " + gear.Level + (gear.Locked ? " · LOCKED" : "") + (gear.EquippedBy.Length > 0 ? " · EQUIPPED" : ""), "gearItem_" + id, () => { _selected = id; Draw(); });
                if (id == _selected) b.AddToClassList("hub-selected");
            }
            var main = Panel(Body, "hub-main"); var list = Scroll(main);
            var item = equipment.FirstOrDefault(g => g.Id == _selected);
            if (item == null) { Text(list, "NO EQUIPMENT YET", "hub-card-title"); Text(list, "Stages, errands and the shop bring weapons and relics.", "hub-copy"); return; }
            Text(list, item.Name, "hub-card-title");
            Text(list, item.Slot.ToUpperInvariant() + " · " + new string('★', item.Rarity) + " · Level " + item.Level + "/" + item.Cap + " · Ascension " + item.Ascension, "hub-copy");
            Text(list, "Instance #" + item.Id + (item.Levelable ? " · Stored XP " + item.Xp : ""), "hub-small");
            Text(list, item.EquippedBy.Length == 0 ? "Unequipped" : "Equipped by " + Companion(snapshot, item.EquippedBy), "hub-copy");
            if (item.Stats != null)
                Text(list, string.Join(" · ", new[] { JsonRead.Obj(item.Stats, "main") }.Concat(JsonRead.Objects(item.Stats, "subs")).Select(s => ArmoryScreen.GearStat(JsonRead.Str(s, "stat"), JsonRead.Num(s, "value")))), "hub-copy");
            if (item.Unavailable.Length > 0) Text(list, "Unavailable in this content version. Ownership is preserved.", "hub-copy");
            else if (!item.Supported) Text(list, "This passive is not available yet.", "hub-copy");
            else if (item.Passive.Length > 0) Text(list, item.Passive, "hub-small");
            var lockButton = Button(list, item.Locked ? "UNLOCK ITEM" : "LOCK ITEM", "gearLock", () => _ = Actions.PlainAsync("POST", Path(item) + "/lock", new Dictionary<string, object> { ["releaseId"] = snapshot.Release, ["locked"] = !item.Locked })); lockButton.SetEnabled(CanWrite);
            var assignment = Card(list, "ASSIGNMENT");
            Button(assignment, target.Length == 0 ? "CHOOSE COMPANION" : "COMPANION: " + Companion(snapshot, target), "gearTarget", () => ChooseCompanion(snapshot));
            if (target.Length > 0)
            {
                bool mine = item.EquippedBy == target;
                var equip = Button(assignment, mine ? "REMOVE" : item.EquippedBy.Length > 0 ? "MOVE & EQUIP" : "EQUIP", "gearAction_" + item.Id, () => _ = Actions.PlainAsync("POST", Path(item) + (mine ? "/unequip" : "/equip"), mine ? new Dictionary<string, object> { ["releaseId"] = snapshot.Release } : new Dictionary<string, object> { ["releaseId"] = snapshot.Release, ["characterId"] = target }));
                equip.SetEnabled(CanWrite && (mine || item.Unavailable.Length == 0 && item.Supported && snapshot.Companions.Any(c => c.Id == target && c.Available)));
            }
            else if (item.EquippedBy.Length > 0)
            { var remove = Button(assignment, "REMOVE", "gearRemove", () => _ = Actions.PlainAsync("POST", Path(item) + "/unequip", new Dictionary<string, object> { ["releaseId"] = snapshot.Release })); remove.SetEnabled(CanWrite); }
            Text(list, "MATERIALS", "hub-card-title");
            Text(list, string.Join(" · ", new[] { model.XpItem, model.RivetItem, model.RerollItem }.Distinct().Select(id => model.Material(id) + " ×" + model.Stock(id))), "hub-copy");
            if (!model.Bound) Text(list, "Spending is paused until the service and selected content supply matching upgrade rules. Assignment and item locks remain available.", "hub-copy");
            foreach (string kind in item.Levelable ? new[] { "level-up", "ascend", "dismantle" } : new[] { "reroll", "dismantle" })
            {
                var plan = model.Preview(item, kind, snapshot.Balance ?? 0);
                var card = Card(list, Label(kind));
                Text(card, Description(model, item, plan), "hub-copy");
                if (!plan.Ready) Text(card, plan.Reason, "hub-small");
                var review = Button(card, "REVIEW " + Label(kind), "gearReview_" + kind, () => Review(model, item, plan), "hub-primary"); review.SetEnabled(CanWrite && plan.Ready);
            }
        }
        private void ChooseSlot()
        {
            var list = OpenPicker(); Text(list, "EQUIPMENT FILTER", "hub-card-title");
            foreach (string slot in new[] { "", "weapon", "armor", "necklace", "ring" })
            { string selected = slot; Button(list, slot.Length == 0 ? "ALL EQUIPMENT" : slot.ToUpperInvariant(), "gearFilter_" + (slot.Length == 0 ? "all" : slot), () => { Router.Session.GearSlot = selected; _selected = 0; CloseRoutes(); Draw(); }); }
        }
        private void ChooseCompanion(UomdHubSnapshot snapshot)
        {
            var list = OpenPicker(); Text(list, "CHOOSE A COMPANION", "hub-card-title");
            foreach (var c in snapshot.Companions.Where(c => c.Available))
            { string id = c.Id; Button(list, c.Name, "gearSelect_" + id, () => { Router.Session.GearCharacterId = id; CloseRoutes(); Draw(); }); }
            Button(list, "NO COMPANION", "gearAllCompanions", () => { Router.Session.GearCharacterId = ""; CloseRoutes(); Draw(); });
        }
        private void Review(UomdGearProgression model, UomdGearProgression.Item item, UomdGearProgression.Plan plan)
        {
            if (!CanWrite || !plan.Ready) return;
            var list = OpenPicker(); Text(list, "REVIEW " + Label(plan.Kind), "hub-card-title");
            Text(list, item.Name + " · Instance #" + item.Id + " · Level " + item.Level + "/" + item.Cap, "hub-copy");
            Text(list, Description(model, item, plan), "hub-copy");
            if (plan.Kind == "dismantle") Text(list, "This permanently destroys this equipment instance. Listed returns are before inventory caps; amounts above a stack cap are lost.", "hub-copy");
            Text(list, "The service confirms the result. A changed item requires a fresh review.", "hub-small");
            string summary = Label(plan.Kind) + " · " + item.Name + " #" + item.Id + " · " + Description(model, item, plan);
            Button(list, plan.Kind == "dismantle" ? "DESTROY THIS ITEM" : "CONFIRM " + Label(plan.Kind), "gearConfirm", () => { CloseRoutes(); _ = Actions.ExecuteAsync(Path(item) + "/" + plan.Kind, plan.Fields, summary); }, "hub-primary");
            Button(list, "CANCEL", "gearCancel", CloseRoutes);
        }
        private static string Companion(UomdHubSnapshot snapshot, string id) => snapshot.Companions.FirstOrDefault(c => c.Id == id)?.Name ?? "Unavailable companion";
        private static string Path(UomdGearProgression.Item item) => "/api/v1/gear/" + item.Id.ToString(CultureInfo.InvariantCulture);
        private static string Label(string kind) => kind == "level-up" ? "TEMPER" : kind == "ascend" ? "UNLOCK MILESTONE" : kind == "reroll" ? "RE-ROLL SUB STATS" : "DISMANTLE";
        private static string Description(UomdGearProgression model, UomdGearProgression.Item item, UomdGearProgression.Plan p)
        {
            string cost = model.Amounts(p.Costs) + (p.Fee > 0 ? " · " + p.Fee + " Bell's Remains" : "");
            if (p.Kind == "level-up") return cost + " · Level " + item.Level + " → " + p.Level + " · Stored XP " + p.Xp;
            if (p.Kind == "ascend") return cost + " · Level cap " + item.Cap + " → " + p.NextCap;
            if (p.Kind == "reroll") return cost + " · Random sub stats. The main stat, rarity, slot and set stay the same.";
            return p.Returns.Count == 0 ? "No material return." : "Returns before stack caps: " + model.Amounts(p.Returns);
        }
    }
}
