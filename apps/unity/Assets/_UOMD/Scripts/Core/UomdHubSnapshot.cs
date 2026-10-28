#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Uomd.Core
{
    /// <summary>Read-only projection of published chapters and authoritative account replies. Never grants progress.</summary>
    public sealed class UomdHubSnapshot
    {
        public string Release = "", PlayerId = "", DisplayName = "", TeamName = "";
        public bool SignedIn, Maintenance;
        public bool SweepEnabled;
        public int SweepDailyLimit, SweepMaxBatch;
        public string SweepPeriod = "";
        public readonly Dictionary<string, int> SweepUsage = new Dictionary<string, int>(StringComparer.Ordinal);
        public Dictionary<string, object?> Mine = null!, Roster = null!, Teams = null!, Catalog = null!, Stacks = null!, Gear = null!;
        public Dictionary<string, object?>? Stats;
        public UomdLibrary? Library;
        public List<UomdInvitation>? Invitations;
        public UomdErrandsSnapshot? Errands;
        public UomdCloudCopy? Cloud;
        public UomdGearProgression? Equipment;
        public long? Balance;
        public int AccountLevel, Ration, RationCap;
        public readonly List<HubCompanion> Companions = new List<HubCompanion>();
        public readonly List<string> Team = new List<string>();
        public readonly List<HubChapter> Chapters = new List<HubChapter>();
        public readonly Dictionary<string, (int Stars, int Clears)> Progress = new Dictionary<string, (int, int)>(StringComparer.Ordinal);
        public IEnumerable<HubNode> Nodes => Chapters.SelectMany(c => c.Nodes);
        public HubNode? NextNode => Nodes.FirstOrDefault(n => !Cleared(n) && Unlocked(n)) ?? Nodes.FirstOrDefault(Unlocked);
        public bool Cleared(HubNode node) => Progress.TryGetValue(node.Id, out var p) && (node.Kind == "story" ? p.Clears > 0 : p.Stars > 0);
        public bool Unlocked(HubNode node)
        {
            if (node.Requires.Length == 0) return true;
            var prerequisite = Nodes.FirstOrDefault(n => n.Id == node.Requires);
            return prerequisite != null && Cleared(prerequisite);
        }
        public int Stars(HubNode node) => Progress.TryGetValue(node.Id, out var p) ? p.Stars : 0;
        public bool CanStart(HubNode node) => SignedIn && !Maintenance && Unlocked(node) && node.Cost >= 0 && Ration >= node.Cost;
        public int SweepRemaining(HubNode node) => Math.Max(0, SweepDailyLimit - (SweepUsage.TryGetValue(node.Id, out int used) ? used : 0));
        public bool CanSweep(HubNode node, int count) => CanStart(node) && SweepEnabled && node.Kind == "battle" && node.Cost > 0 && Stars(node) == 3 && count >= 1 && count <= SweepMaxBatch && count <= SweepRemaining(node) && (long)node.Cost * count <= Ration;
        public static UomdHubSnapshot Published(string release, object index)
        {
            var snapshot = new UomdHubSnapshot { Release = release };
            if (!(JsonRead.Get(index, "chapters") is List<object?>)) throw new InvalidDataException("Published chapters are unavailable.");
            foreach (var c in Objects(index, "chapters"))
            {
                var chapter = new HubChapter { Id = Required(c, "chapter_id"), Title = Required(c, "title_en") };
                foreach (var n in Objects(c, "nodes"))
                {
                    string kind = Required(n, "kind");
                    if (kind != "story" && kind != "battle") throw new InvalidDataException("Unknown chapter node kind.");
                    string ration = JsonRead.Str(n, "ration_class");
                    int cost = ration == "" || ration == "tutorial" ? 0 : ration == "campaign" ? 6 : ration == "material_hunt" ? 8 : ration == "gear_dungeon" || ration == "special_boss" ? 10 : -1;
                    chapter.Nodes.Add(new HubNode { Id = Required(n, "node_id"), Title = Required(n, "title_en"), Kind = kind, Requires = JsonRead.Str(n, "requires"),
                        Story = JsonRead.Str(n, "story"), Encounter = JsonRead.Str(n, "encounter"), Hard = JsonRead.Str(n, "difficulty") == "hard", Cost = kind == "story" ? 0 : cost, Definition = n });
                }
                snapshot.Chapters.Add(chapter);
            }
            if (snapshot.Nodes.GroupBy(n => n.Id).Any(g => g.Count() != 1)) throw new InvalidDataException("Duplicate published chapter node.");
            return snapshot;
        }
        public void Account(object me, object wallet, object mine, object roster, object teams, object progress, object flags)
        {
            Mine = (Dictionary<string, object?>)mine; Roster = (Dictionary<string, object?>)roster; Teams = (Dictionary<string, object?>)teams;
            PlayerId = Required(me, "id"); DisplayName = JsonRead.Str(me, "displayName");
            // An absent wallet row means zero; an absent wallet envelope means a broken reply.
            if (!(JsonRead.Get(wallet, "wallets") is Dictionary<string, object?> wallets)) throw new InvalidDataException("Wallet is unavailable.");
            Balance = wallets.ContainsKey("eclipse_token") ? Number(wallets, "eclipse_token", 0, 9007199254740991L) : 0;
            AccountLevel = (int)Number(JsonRead.Get(mine, "account")!, "level", 1, int.MaxValue);
            RequireArray(mine, "characters"); RequireArray(mine, "unavailable"); RequireArray(roster, "characters"); RequireArray(teams, "teams"); RequireArray(progress, "nodes");
            var catalog = Objects(roster, "characters").ToDictionary(c => Required(c, "id"), StringComparer.Ordinal);
            foreach (var c in Objects(mine, "characters"))
            {
                string id = Required(c, "id"); catalog.TryGetValue(id, out var definition);
                Companions.Add(new HubCompanion { Id = id, Name = definition == null ? "Unavailable companion" : Required(definition, "name_en"),
                    Level = (int)Number(c, "level", 1, int.MaxValue), Copies = (int)Number(c, "copies", 1, int.MaxValue), Shards = (int)Number(c, "shards", 0, int.MaxValue),
                    Rarity = definition == null ? 0 : (int)Number(definition, "rarity", 1, 5), Element = JsonRead.Str(definition, "element"), Role = JsonRead.Str(definition, "role").Replace('_', ' '), Available = definition != null });
            }
            foreach (var c in Objects(mine, "unavailable"))
                Companions.Add(new HubCompanion { Id = Required(c, "id"), Name = "Unavailable companion" });
            Companions.Sort((a, b) => b.Rarity != a.Rarity ? b.Rarity.CompareTo(a.Rarity) : StringComparer.OrdinalIgnoreCase.Compare(a.Name, b.Name));
            var active = Objects(teams, "teams").FirstOrDefault(t => JsonRead.Bool(t, "active"));
            if (active != null)
            {
                TeamName = Required(active, "name"); RequireArray(active, "members");
                foreach (var member in Objects(active, "members")) Team.Add(Required(member, "characterId"));
            }
            foreach (var n in Objects(progress, "nodes"))
                Progress[Required(n, "node_id")] = ((int)Number(n, "stars", 0, 3), (int)Number(n, "clears", 0, int.MaxValue));
            var ration = JsonRead.Get(progress, "ration")!; Ration = (int)Number(ration, "value", 0, int.MaxValue); RationCap = (int)Number(ration, "cap", 1, int.MaxValue);
            if (!(JsonRead.Get(flags, "flags") is Dictionary<string, object?>)) throw new InvalidDataException("Server status is unavailable.");
            Maintenance = JsonRead.Bool(JsonRead.Get(JsonRead.Obj(flags, "flags"), "maintenance.read_only"), "enabled");
            SweepEnabled = JsonRead.Bool(JsonRead.Get(JsonRead.Obj(flags, "flags"), "sweep.enabled"), "enabled");
            if (JsonRead.Get(progress, "sweep") is Dictionary<string, object?> sweep)
            {
                SweepDailyLimit = (int)Number(sweep, "dailyLimit", 1, int.MaxValue); SweepMaxBatch = (int)Number(sweep, "maxBatch", 1, 10); SweepPeriod = Required(sweep, "periodKey");
                if (!(JsonRead.Get(sweep, "usageByNode") is Dictionary<string, object?> usage)) throw new InvalidDataException("Sweep usage is unavailable.");
                foreach (string key in usage.Keys) SweepUsage[key] = (int)Number(usage, key, 0, int.MaxValue);
            }
            SignedIn = true;
        }
        public void Details(Dictionary<string, object?> catalog, Dictionary<string, object?> stacks, Dictionary<string, object?> gear, Dictionary<string, object?>? stats)
        {
            RequireArray(catalog, "items"); RequireArray(catalog, "gear"); RequireArray(stacks, "stacks"); RequireArray(gear, "gear");
            if (!(JsonRead.Get(JsonRead.Obj(JsonRead.Obj(catalog, "config"), "progression"), "character") is Dictionary<string, object?>)) throw new InvalidDataException("Growth rules are unavailable.");
            if (stats != null)
            {
                var values = JsonRead.Get(stats, "stats");
                foreach (string key in new[] { "hp", "atk", "def", "spd" })
                { object? value = JsonRead.Get(values, key); if (!(value is long) && !(value is double d && !double.IsNaN(d) && !double.IsInfinity(d))) throw new InvalidDataException("Stats are unavailable."); }
            }
            Catalog = catalog; Stacks = stacks; Gear = gear; Stats = stats;
        }
        private static IEnumerable<Dictionary<string, object?>> Objects(object d, string key)
        {
            RequireArray(d, key);
            foreach (object? value in (List<object?>)JsonRead.Get(d, key)!)
                yield return value as Dictionary<string, object?> ?? throw new InvalidDataException("Invalid account list entry: " + key);
        }
        private static void RequireArray(object d, string key) { if (!(JsonRead.Get(d, key) is List<object?>)) throw new InvalidDataException("Missing account list: " + key); }
        private static string Required(object d, string key) => JsonRead.Get(d, key) is string s && s.Length > 0 ? s : throw new InvalidDataException("Missing account field: " + key);
        private static long Number(object d, string key, long min, long max) => JsonRead.Get(d, key) is long n && n >= min && n <= max ? n : throw new InvalidDataException("Invalid account number: " + key);
    }
    public sealed class HubCompanion
    {
        public string Id = "", Name = "", Element = "", Role = "";
        public int Level, Rarity, Copies, Shards;
        public bool Available;
    }
    public sealed class HubChapter { public string Id = "", Title = ""; public readonly List<HubNode> Nodes = new List<HubNode>(); }
    public sealed class HubNode
    {
        public Dictionary<string, object?> Definition = new Dictionary<string, object?>();
        public string Id = "", Title = "", Kind = "", Requires = "", Story = "", Encounter = "";
        public int Cost;
        public bool Hard;
    }
}
