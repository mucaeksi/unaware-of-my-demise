#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Uomd.Core
{
    /// <summary>Read-only cost plans from the provider's selected catalog. Results and random rolls stay server-authoritative.</summary>
    public sealed class UomdGearProgression
    {
        public const long SafeMax = 9007199254740991L;
        public sealed class Amount { public string Id = ""; public long Quantity; }
        public sealed class Definition
        {
            public string Id = "", Slot = ""; public int MaxLevel;
            public bool DismantlePreview, DismantleAllowed;
            public readonly List<Amount> Returns = new List<Amount>();
        }
        public sealed class Item
        {
            public long Id, Xp, Version; public int Level, Cap, Ascension, Rarity;
            public string GearId = "", Name = "", Slot = "", EquippedBy = "", Unavailable = "", Passive = "";
            public bool Locked, CanDismantle, Supported = true;
            public Definition? Definition;
            public Dictionary<string, object?>? Stats;
            public bool Levelable => Slot == "weapon" || Slot == "armor";
        }
        public sealed class Plan
        {
            public string Kind = "", Reason = "";
            public long RequestXp, UsedXp, Fee, Xp, Version;
            public int Level, NextCap;
            public readonly List<Amount> Costs = new List<Amount>(), Returns = new List<Amount>();
            public bool Ready => Reason.Length == 0;
            public Dictionary<string, object?> Fields
            { get { var fields = new Dictionary<string, object?> { ["expectedVersion"] = Version }; if (Kind == "level-up") fields["xp"] = RequestXp; return fields; } }
        }
        private sealed class Milestone { public int Level; public long Rivets; }
        public bool Bound;
        public string CatalogHash = "", XpItem = "", RivetItem = "", RerollItem = "";
        public int MaxLevel;
        public readonly List<Item> Items = new List<Item>();
        public readonly Dictionary<string, long> Stocks = new Dictionary<string, long>(StringComparer.Ordinal);
        public readonly Dictionary<string, string> Names = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly List<Milestone> _milestones = new List<Milestone>();
        private readonly Dictionary<int, long> _reroll = new Dictionary<int, long>();
        private readonly long[] _xp = new long[21], _fees = new long[21];
        public static long Integer(object value, string field, long min = 0, long max = SafeMax)
        { if (!(JsonRead.Get(value, field) is long n) || n < min || n > max) throw new InvalidDataException("Invalid gear number: " + field); return n; }
        private static double Number(object value, string field)
        { object? v = JsonRead.Get(value, field); double n = v is long i ? i : v is double d ? d : double.NaN; if (double.IsNaN(n) || double.IsInfinity(n)) throw new InvalidDataException("Invalid gear rule."); return n; }
        private static long Whole(double n)
        { if (n < 0 || n > SafeMax || n != Math.Floor(n)) throw new InvalidDataException("Unsafe gear rule."); return (long)n; }
        public static long InstanceId(string text)
        { if (!Regex.IsMatch(text, "^[1-9][0-9]{0,15}$") || !long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out long id) || id > SafeMax) throw new InvalidDataException("Invalid gear instance."); return id; }
        public static bool ActionPath(string path) => Regex.IsMatch(path, "^/api/v1/gear/[1-9][0-9]{0,15}/(level-up|ascend|reroll|dismantle)$");
        public static void ValidateStats(object value)
        {
            var main = JsonRead.Get(value, "main") ?? throw new InvalidDataException("Missing main stat.");
            void Stat(object stat) { UomdErrandsSnapshot.Id(stat, "stat"); if (Number(stat, "value") < 0) throw new InvalidDataException("Negative gear stat."); }
            Stat(main); var ids = new HashSet<string> { JsonRead.Str(main, "stat") };
            foreach (var stat in UomdErrandsSnapshot.Array(value, "subs", 8))
            { Stat(stat!); if (!ids.Add(JsonRead.Str(stat, "stat"))) throw new InvalidDataException("Duplicate accessory stat."); }
        }
        public static UomdGearProgression Parse(object catalog, object stacks, object owned, string release)
        {
            string declared = JsonRead.Str(catalog, "releaseId"), hash = JsonRead.Str(catalog, "catalogSha256");
            if (declared.Length > 0 && declared != release || hash.Length > 0 && !UomdEntryCheckpoint.IsHash(hash)) throw new InvalidDataException("Gear catalog binding differs.");
            bool versionBound = JsonRead.Get(owned, "versionBound") != null && UomdErrandsSnapshot.Bool(owned, "versionBound");
            string ownedRelease = JsonRead.Str(owned, "releaseId"), ownedHash = JsonRead.Str(owned, "catalogSha256");
            if (ownedRelease.Length > 0 && ownedRelease != release || ownedHash.Length > 0 && ownedHash != hash) throw new InvalidDataException("Owned gear terms differ.");
            var r = new UomdGearProgression { Bound = versionBound && declared == release && ownedRelease == release && UomdEntryCheckpoint.IsHash(hash) && ownedHash == hash, CatalogHash = hash };
            foreach (var raw in UomdErrandsSnapshot.Array(catalog, "items", int.MaxValue))
            { string id = UomdErrandsSnapshot.Id(raw!, "item_id"); if (r.Names.ContainsKey(id)) throw new InvalidDataException("Duplicate material."); r.Names[id] = UomdErrandsSnapshot.Text(raw!, "name_en", 200); }
            foreach (var raw in UomdErrandsSnapshot.Array(stacks, "stacks", int.MaxValue))
            { string id = UomdErrandsSnapshot.Id(raw!, "item_id"); if (r.Stocks.ContainsKey(id)) throw new InvalidDataException("Duplicate material balance."); r.Stocks[id] = Integer(raw!, "qty"); }
            var progression = JsonRead.Obj(JsonRead.Obj(catalog, "config"), "progression"); var equipment = JsonRead.Obj(progression, "equipment");
            r.MaxLevel = (int)Integer(equipment, "levelCap", 1, 20); r.XpItem = UomdErrandsSnapshot.Id(equipment, "xpItemId"); r.RivetItem = UomdErrandsSnapshot.Id(equipment, "milestoneItemId");
            var xp = JsonRead.Obj(equipment, "xp"); var fee = JsonRead.Obj(equipment, "fee");
            double xpBase = Number(xp, "base"), xpIncrement = Number(xp, "increment"), feeBase = Number(fee, "base"), feeIncrement = Number(fee, "increment");
            if (feeBase < 0 || feeIncrement < 0) throw new InvalidDataException("Negative gear fee.");
            long totalXp = 0, totalFees = 0;
            for (int level = 1; level <= r.MaxLevel; ++level)
            {
                r._xp[level] = Whole(xpBase + level * xpIncrement); r._fees[level] = Whole(Math.Max(1, Math.Ceiling(feeBase + level * feeIncrement)));
                if (r._xp[level] == 0 || (totalXp += r._xp[level]) > SafeMax || (totalFees += r._fees[level]) > SafeMax) throw new InvalidDataException("Unsafe gear progression.");
            }
            int previous = 0;
            foreach (var raw in UomdErrandsSnapshot.Array(equipment, "milestones", 6))
            {
                int level = (int)Integer(raw!, "fromLevel", 1, r.MaxLevel); long rivets = Integer(raw!, "rivets", 1);
                if (level <= previous) throw new InvalidDataException("Unordered gear milestones."); previous = level; r._milestones.Add(new Milestone { Level = level, Rivets = rivets });
            }
            var reroll = JsonRead.Obj(JsonRead.Obj(JsonRead.Obj(catalog, "config"), "gear"), "rerollCost"); r.RerollItem = UomdErrandsSnapshot.Id(reroll, "itemId");
            foreach (var pair in JsonRead.Obj(reroll, "quantityByRarity"))
            { if (!int.TryParse(pair.Key, out int rarity) || rarity < 1 || rarity > 5) throw new InvalidDataException("Invalid reroll rarity."); r._reroll[rarity] = Integer(JsonRead.Obj(reroll, "quantityByRarity"), pair.Key, 1); }
            foreach (string id in new[] { r.XpItem, r.RivetItem, r.RerollItem }) if (!r.Names.ContainsKey(id)) throw new InvalidDataException("Gear material is unavailable.");
            var definitions = new Dictionary<string, Definition>(StringComparer.Ordinal);
            foreach (var raw in UomdErrandsSnapshot.Array(catalog, "gear", int.MaxValue))
            {
                string id = UomdErrandsSnapshot.Id(raw!, "gear_id"); if (definitions.ContainsKey(id)) throw new InvalidDataException("Duplicate gear definition.");
                var definition = new Definition { Id = id, Slot = JsonRead.Str(raw, "slot"), MaxLevel = (int)Integer(raw!, "level_cap", 1, 20) };
                if (JsonRead.Get(raw, "dismantle_json") != null || JsonRead.Get(raw, "dismantle_xp") != null || JsonRead.Get(raw, "dismantle_allowed") != null)
                {
                    definition.DismantlePreview = true; definition.DismantleAllowed = Integer(raw!, "dismantle_allowed", 0, 1) == 1; long amount = Integer(raw!, "dismantle_xp");
                    if (amount > 0) definition.Returns.Add(new Amount { Id = r.XpItem, Quantity = amount });
                    if (!(UomdJson.Parse(UomdBattleWire.RequiredString(raw!, "dismantle_json")) is List<object?> returns) || returns.Count > 8) throw new InvalidDataException("Invalid dismantle terms.");
                    foreach (var material in returns) definition.Returns.Add(new Amount { Id = UomdErrandsSnapshot.Id(material!, "item_id"), Quantity = Integer(material!, "quantity", 1) });
                    if (definition.Returns.Any(a => !r.Names.ContainsKey(a.Id))) throw new InvalidDataException("Dismantle material unavailable.");
                }
                definitions[id] = definition;
            }
            var seen = new HashSet<long>();
            foreach (var raw in UomdErrandsSnapshot.Array(owned, "gear", int.MaxValue))
            {
                long id = Integer(raw!, "id", 1); if (!seen.Add(id)) throw new InvalidDataException("Duplicate gear instance.");
                var item = new Item { Id = id, GearId = UomdErrandsSnapshot.Id(raw!, "gearId"), Name = UomdErrandsSnapshot.Text(raw!, "name", 200), Slot = JsonRead.Str(raw, "slot"), Level = (int)Integer(raw!, "level", 1, 20), Cap = (int)Integer(raw!, "levelCap", 1, 20), Ascension = (int)Integer(raw!, "ascension", 0, 6), Rarity = (int)Integer(raw!, "rarity", 0, 5), Xp = Integer(raw!, "xp"), Locked = UomdErrandsSnapshot.Bool(raw!, "locked"), CanDismantle = UomdErrandsSnapshot.Bool(raw!, "canDismantle"), EquippedBy = JsonRead.Str(raw, "equippedBy"), Unavailable = JsonRead.Str(raw, "unavailableReason") };
                item.Version = JsonRead.Get(raw, "version") == null && !versionBound ? 0 : Integer(raw!, "version", 0, SafeMax - 1);
                if (item.Level > item.Cap) throw new InvalidDataException("Gear level exceeds its cap.");
                if (!new[] { "weapon", "armor", "necklace", "ring" }.Contains(item.Slot) || item.EquippedBy.Length > 0 && !UomdBattleWire.Id(item.EquippedBy, 80)) throw new InvalidDataException("Invalid gear slot or companion.");
                definitions.TryGetValue(item.GearId, out item.Definition);
                if (item.Unavailable.Length == 0 && (item.Definition == null || item.Rarity == 0)) throw new InvalidDataException("Gear definition is unavailable.");
                if (item.Definition != null && (item.Definition.Slot != item.Slot || item.Cap != Math.Min(item.Definition.MaxLevel, item.Ascension < r._milestones.Count ? r._milestones[item.Ascension].Level : r.MaxLevel))) throw new InvalidDataException("Gear cap or slot differs from its terms.");
                var passive = JsonRead.Get(raw, "passive"); if (passive != null) { item.Supported = UomdErrandsSnapshot.Bool(passive, "supported"); item.Passive = JsonRead.Str(passive, "name"); }
                item.Stats = JsonRead.Get(raw, "stats") as Dictionary<string, object?>;
                if (!item.Levelable && item.Unavailable.Length == 0) { if (item.Stats == null) throw new InvalidDataException("Accessory stats unavailable."); ValidateStats(item.Stats); }
                r.Items.Add(item);
            }
            return r;
        }
        public string Material(string id) => Names.TryGetValue(id, out string? name) ? name : id;
        public long Stock(string id) => Stocks.TryGetValue(id, out long qty) ? qty : 0;
        public string Amounts(IEnumerable<Amount> amounts) => string.Join(" · ", amounts.Select(a => Material(a.Id) + " ×" + a.Quantity.ToString(CultureInfo.InvariantCulture)));
        public Plan Preview(Item item, string kind, long balance, long requestedXp = 0)
        {
            var p = new Plan { Kind = kind, Level = item.Level, Xp = item.Xp, NextCap = item.Cap, Version = item.Version };
            if (!Bound) { p.Reason = "Upgrade rules are unavailable. Refresh after updating content."; return p; }
            if (item.Unavailable.Length > 0 || item.Definition == null) { p.Reason = "Unavailable in this content version."; return p; }
            if (!item.Supported && kind != "dismantle") { p.Reason = "This passive is not available yet."; return p; }
            if (kind == "level-up")
            {
                if (!item.Levelable) { p.Reason = "Only weapons and armor can be tempered."; return p; }
                if (item.Level >= item.Cap) { p.Reason = "Current level cap reached."; return p; }
                if (item.Xp >= _xp[item.Level]) { p.Reason = "Gear XP rules changed. Refresh before spending."; return p; }
                p.RequestXp = requestedXp > 0 ? requestedXp : Math.Min(1000000, Math.Min(Stock(XpItem), _xp[item.Level] - item.Xp));
                if (p.RequestXp < 1 || p.RequestXp > 1000000 || p.RequestXp > Stock(XpItem) || item.Xp + p.RequestXp > SafeMax) { p.Reason = "Not enough tempering XP."; return p; }
                double xp = item.Xp + p.RequestXp; long used = p.RequestXp;
                while (p.Level < item.Cap && xp >= _xp[p.Level]) { xp -= _xp[p.Level]; p.Fee += _fees[p.Level]; ++p.Level; }
                if (p.Level >= item.Cap) { used -= Whole(xp); xp = 0; }
                p.UsedXp = used; p.Xp = Whole(xp); p.Costs.Add(new Amount { Id = XpItem, Quantity = used });
            }
            else if (kind == "ascend")
            {
                if (!item.Levelable || item.Ascension >= _milestones.Count) { p.Reason = "No further weapon or armor milestone."; return p; }
                if (item.Level < item.Cap) { p.Reason = "Reach the current level cap first."; return p; }
                p.NextCap = Math.Min(item.Definition.MaxLevel, item.Ascension + 1 < _milestones.Count ? _milestones[item.Ascension + 1].Level : MaxLevel);
                if (p.NextCap <= item.Level) { p.Reason = "Maximum level reached."; return p; }
                p.Costs.Add(new Amount { Id = RivetItem, Quantity = _milestones[item.Ascension].Rivets });
            }
            else if (kind == "reroll")
            {
                if (item.Levelable || !_reroll.TryGetValue(item.Rarity, out long quantity)) { p.Reason = "This accessory cannot be re-rolled."; return p; }
                p.Costs.Add(new Amount { Id = RerollItem, Quantity = quantity });
            }
            else if (kind == "dismantle")
            {
                if (item.EquippedBy.Length > 0) p.Reason = "Remove this item before dismantling.";
                else if (item.Locked) p.Reason = "Unlock this item before dismantling.";
                else if (!item.Definition.DismantlePreview) p.Reason = "Dismantle preview is unavailable. Refresh before choosing.";
                else if (!item.CanDismantle || !item.Definition.DismantleAllowed) p.Reason = "This item cannot be dismantled.";
                else p.Returns.AddRange(item.Definition.Returns);
            }
            else throw new InvalidDataException("Unknown gear action.");
            if (p.Reason.Length == 0 && p.Costs.Any(c => Stock(c.Id) < c.Quantity)) p.Reason = "Not enough materials.";
            if (p.Reason.Length == 0 && p.Fee > balance) p.Reason = "Not enough Bell's Remains.";
            return p;
        }
    }
}
