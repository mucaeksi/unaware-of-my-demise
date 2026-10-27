#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;

namespace Uomd.Core
{
    public sealed class UomdInvitation
    {
        public string Id = "", Title = "";
        public int Quantity, DuplicateShards;
        public sealed class Choice { public string Id = "", Name = "", Element = "", Role = ""; public int Rarity, Copies; }
        public readonly List<Choice> Choices = new List<Choice>();
        public static List<UomdInvitation> Parse(object response, string release)
        {
            if (JsonRead.Str(response, "releaseId") != release) throw new InvalidDataException("Invitation release mismatch.");
            var result = new List<UomdInvitation>(); var ids = new HashSet<string>();
            foreach (object? raw in UomdErrandsSnapshot.Array(response, "selectors", 64))
            {
                var s = new UomdInvitation { Id = UomdErrandsSnapshot.Id(raw!, "itemId"), Title = UomdErrandsSnapshot.Text(raw!, "title", 160), Quantity = UomdBattleWire.RequiredInt(raw!, "quantity", 1, int.MaxValue), DuplicateShards = UomdBattleWire.RequiredInt(raw!, "duplicateShards", 0, int.MaxValue) };
                if (!ids.Add(s.Id)) throw new InvalidDataException("Duplicate invitation.");
                var choices = new HashSet<string>();
                foreach (object? c in UomdErrandsSnapshot.Array(raw!, "choices", 64))
                {
                    var choice = new Choice { Id = UomdErrandsSnapshot.Id(c!, "id"), Name = UomdErrandsSnapshot.Text(c!, "name_en", 80), Element = UomdErrandsSnapshot.Text(c!, "element", 80), Role = UomdErrandsSnapshot.Text(c!, "role", 80), Rarity = UomdBattleWire.RequiredInt(c!, "rarity", 1, 5), Copies = UomdBattleWire.RequiredInt(c!, "copies", 0, int.MaxValue) };
                    if (!choices.Add(choice.Id)) throw new InvalidDataException("Duplicate invitation choice."); s.Choices.Add(choice);
                }
                if (s.Choices.Count == 0) throw new InvalidDataException("Invitation choices are unavailable.");
                result.Add(s);
            }
            return result;
        }
    }
    /// <summary>Authoritative reward previews and eligibility. Client time never grants progress or rolls a period.</summary>
    public sealed class UomdErrandsSnapshot
    {
        public sealed class Row
        {
            public string Id = "", Title = "", Period = "";
            public int Progress, Target;
            public bool Done, Claimed, Weekly, Running;
            public long End;
            public List<object?> Rewards = new List<object?>();
            public Dictionary<string, object?> Names = new Dictionary<string, object?>();
            public bool CanClaim(double now) => Done && !Claimed && (Weekly || now < End);
        }
        public sealed class Patrol
        {
            public bool Unlocked, Claimable;
            public int Elapsed, Cap;
            public List<object?> Rewards = new List<object?>();
            public static Patrol Parse(object value)
            {
                var p = new Patrol { Unlocked = Bool(value, "unlocked"), Claimable = Bool(value, "claimable"), Elapsed = UomdBattleWire.RequiredInt(value, "elapsedSeconds", 0, int.MaxValue), Cap = UomdBattleWire.RequiredInt(value, "capSeconds", 1, int.MaxValue), Rewards = UomdErrandsSnapshot.Rewards(value) };
                if (p.Elapsed > p.Cap || p.Claimable && (!p.Unlocked || p.Rewards.Count == 0)) throw new InvalidDataException("Invalid patrol eligibility.");
                return p;
            }
        }
        public long ServerTime, SupplyEnds, WindowEnds;
        public string SupplyPeriod = "";
        public int SupplyAmount;
        public bool SupplyClaimed, SupplyPeriodBound;
        public Patrol? Afk;
        public readonly List<Row> Rows = new List<Row>();
        public bool SupplyReady(double now) => SupplyPeriodBound && !SupplyClaimed && now < SupplyEnds;
        public static UomdErrandsSnapshot Parse(object response, string release)
        {
            if (JsonRead.Get(response, "releaseId") != null && JsonRead.Str(response, "releaseId") != release) throw new InvalidDataException("Errands release mismatch.");
            object sup = JsonRead.Get(response, "supplies") ?? throw new InvalidDataException("Daily supplies are unavailable.");
            var result = new UomdErrandsSnapshot { ServerTime = Timestamp(response, "serverTimeMs"), SupplyPeriod = UomdBattleWire.RequiredString(sup, "periodKey"), SupplyEnds = Timestamp(sup, "endsAtMs"), SupplyAmount = UomdBattleWire.RequiredInt(sup, "amount", 1, int.MaxValue), SupplyClaimed = Bool(sup, "claimed") };
            result.SupplyPeriodBound = JsonRead.Get(sup, "periodBound") == null ? false : Bool(sup, "periodBound");
            if (SupplyEnd(result.SupplyPeriod) != result.SupplyEnds) throw new InvalidDataException("Daily supply period mismatch.");
            var seen = new HashSet<string>();
            void Add(object raw, string period, long end, bool weekly)
            {
                string id = UomdBattleWire.RequiredString(raw, "id");
                var row = new Row { Id = id, Title = Text(raw, "title", 200), Period = period, End = end, Weekly = weekly, Running = !weekly || Bool(raw, "running"), Progress = UomdBattleWire.RequiredInt(raw, "progress", 0, int.MaxValue), Target = UomdBattleWire.RequiredInt(JsonRead.Get(raw, "objective")!, "count", 1, int.MaxValue), Done = Bool(raw, "done"), Claimed = Bool(raw, "claimed"), Rewards = Rewards(raw), Names = JsonRead.Obj(raw, "rewardNames") };
                TaskPeriod(period);
                if (!System.Text.RegularExpressions.Regex.IsMatch(id, "^_?[a-z][a-z0-9_]{1,79}$") || !seen.Add(period + ":" + id) || row.Progress > row.Target || row.Done != (row.Progress >= row.Target)) throw new InvalidDataException("Invalid task eligibility.");
                result.Rows.Add(row);
            }
            object? daily = JsonRead.Get(response, "daily");
            if (daily != null)
            {
                string period = UomdBattleWire.RequiredString(daily, "periodKey"); result.WindowEnds = Timestamp(daily, "endsAtMs");
                foreach (object? task in Array(daily, "tasks", 100)) Add(task!, period, result.WindowEnds, false);
                object completion = JsonRead.Get(daily, "completion") ?? throw new InvalidDataException("Missing window completion.");
                bool ready = Bool(completion, "ready");
                Add(new Dictionary<string, object?> { ["id"] = "_window_complete", ["title"] = "Window complete", ["progress"] = ready ? 1L : 0L, ["objective"] = new Dictionary<string, object?> { ["count"] = 1L }, ["done"] = ready, ["claimed"] = Bool(completion, "claimed"), ["rewards"] = Rewards(completion), ["rewardNames"] = JsonRead.Get(completion, "rewardNames") }, period, result.WindowEnds, false);
            }
            foreach (object? weekly in Array(response, "weekly", 100)) Add(weekly!, UomdBattleWire.RequiredString(weekly!, "periodKey"), Timestamp(weekly!, "endsAtMs"), true);
            return result;
        }
        public static bool Bool(object value, string field) => JsonRead.Get(value, field) is bool b ? b : throw new InvalidDataException("Missing eligibility: " + field);
        public static string Text(object value, string field, int max)
        { string s = UomdBattleWire.RequiredString(value, field); if (s.Length < 1 || s.Length > max) throw new InvalidDataException("Invalid reward text."); return s; }
        public static string Id(object value, string field)
        { string s = Text(value, field, 80); if (!UomdBattleWire.Id(s, 80)) throw new InvalidDataException("Invalid reward identity."); return s; }
        public static List<object?> Array(object value, string field, int max)
        { if (!(JsonRead.Get(value, field) is List<object?> list) || list.Count > max || list.Any(v => v == null)) throw new InvalidDataException("Invalid reward list."); return list; }
        public static long Timestamp(object value, string field)
        { if (!(JsonRead.Get(value, field) is long t) || t < 0 || t > 253402300799999L) throw new InvalidDataException("Invalid server time."); return t; }
        public static long SupplyEnd(string period)
        {
            if (!period.StartsWith("supply:", StringComparison.Ordinal) || !DateTimeOffset.TryParseExact(period.Substring(7), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var day)) throw new InvalidDataException("Invalid supply day.");
            return day.AddDays(1).ToUnixTimeMilliseconds();
        }
        public static void TaskPeriod(string period)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(period, "^[dw]:[0-9T:-]{10,13}(:[a-z][a-z0-9_]{1,79})?$") || period.StartsWith("d:", StringComparison.Ordinal) && (period.Length != 15 || period[12] != 'T')) throw new InvalidDataException("Invalid task period.");
            string stamp = period.Substring(2, 10) + "T" + (period[0] == 'd' ? period.Substring(13, 2) : "00");
            if (!DateTimeOffset.TryParseExact(stamp, "yyyy-MM-ddTHH", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _)) throw new InvalidDataException("Invalid task date.");
        }
        public static List<object?> Rewards(object value)
        {
            var rewards = Array(value, "rewards", 100);
            foreach (object? reward in rewards)
            {
                string type = JsonRead.Str(reward, "type");
                if (type == "currency") { if (JsonRead.Str(reward, "currency") != "eclipse_token") throw new InvalidDataException("Unsupported currency."); UomdBattleWire.RequiredInt(reward!, "amount", 1, int.MaxValue); }
                else if (type == "account_xp") UomdBattleWire.RequiredInt(reward!, "amount", 1, int.MaxValue);
                else if (type == "item") { Id(reward!, "itemId"); UomdBattleWire.RequiredInt(reward!, "quantity", 1, int.MaxValue); }
                else if (type == "character") Id(reward!, "itemId");
                else if (type == "gear") Id(reward!, "gearId");
                else throw new InvalidDataException("Unsupported reward.");
            }
            return rewards;
        }
    }
}
