#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Uomd.Core
{
    /// <summary>Exact original intent for supported account actions. Never contains credentials.</summary>
    public sealed class UomdSavedAction
    {
        public const string SweepPath = "/api/v1/progress/sweep";
        public const string TaskPath = "/api/v1/tasks/claim", SuppliesPath = "/api/v1/tasks/supplies", PatrolPath = "/api/v1/afk/claim";
        public static bool InvitationPath(string path) => Regex.IsMatch(path, "^/api/v1/recruitment/[a-z][a-z0-9_]{1,79}$");
        public string Scope = "", Path = "", Payload = "", State = "pending", Receipt = "", RejectionCode = "", Summary = "";
        public Dictionary<string, object?> Body => UomdJson.ParseObject(Payload);
        public string RequestId => JsonRead.Str(Body, "requestId");
        public string Release => JsonRead.Str(Body, "releaseId");
        public string InputHash
        {
            get { var body = Body; if (Path == SweepPath) body["sweep"] = true; return UomdBattleWire.Hash(CanonicalJson.Serialize(body)); }
        }
        public static string ScopeFor(string account) => UomdBattleOperation.ScopeFor(account);
        public void Validate()
        {
            if (!UomdEntryCheckpoint.IsHash(Scope) || !Regex.IsMatch(RequestId, "^[a-f0-9]{32}$") || !UomdBattleWire.Id(Release, 48)) throw new InvalidDataException("Invalid action binding.");
            var body = Body;
            if (Summary.Length > 1024) throw new InvalidDataException("Action summary is too long.");
            if (CanonicalJson.Serialize(body) != Payload) throw new InvalidDataException("Action payload must be canonical.");
            var match = Regex.Match(Path, "^/api/v1/characters/([a-z][a-z0-9_]{1,79})/(level-up|ascend|shards/attune|shards/convert|skills/[a-z][a-z0-9_]{1,79}/upgrade)$");
            var fields = new HashSet<string> { "releaseId", "requestId" };
            if (Path == SweepPath)
            {
                fields.Add("nodeId"); fields.Add("count");
                if (!UomdBattleWire.Id(JsonRead.Str(body, "nodeId"), 80)) throw new InvalidDataException("Invalid Sweep stage.");
                UomdBattleWire.RequiredInt(body, "count", 1, 10);
            }
            else if (InvitationPath(Path)) { fields.Add("characterId"); if (!UomdBattleWire.Id(JsonRead.Str(body, "characterId"), 80)) throw new InvalidDataException("Invalid invitation choice."); }
            else if (Path == TaskPath)
            {
                fields.Add("periodKey"); fields.Add("taskId");
                UomdErrandsSnapshot.TaskPeriod(JsonRead.Str(body, "periodKey"));
                if (!Regex.IsMatch(JsonRead.Str(body, "taskId"), "^_?[a-z][a-z0-9_]{1,79}$")) throw new InvalidDataException("Invalid original task identity.");
            }
            else if (Path == SuppliesPath) { fields.Add("periodKey"); UomdErrandsSnapshot.SupplyEnd(JsonRead.Str(body, "periodKey")); }
            else if (Path == PatrolPath) { }
            else if (!match.Success) throw new InvalidDataException("Unsupported saved action.");
            else if (match.Groups[2].Value == "level-up")
            {
                fields.Add("items");
                if (!(JsonRead.Get(body, "items") is List<object?> items) || items.Count != 1) throw new InvalidDataException("One XP material is required.");
                var item = items[0] as Dictionary<string, object?>;
                if (item == null || item.Count != 2 || !UomdBattleWire.Id(JsonRead.Str(item, "itemId"), 80) || UomdBattleWire.RequiredInt(item, "quantity", 1, 1) != 1) throw new InvalidDataException("Invalid XP material.");
            }
            else if (match.Groups[2].Value == "shards/convert") { fields.Add("shards"); UomdBattleWire.RequiredInt(body, "shards", 1, int.MaxValue); }
            foreach (string key in body.Keys) if (!fields.Contains(key)) throw new InvalidDataException("Unexpected action field.");
            if (State != "pending" && State != "confirmed" && State != "rejected") throw new InvalidDataException("Invalid saved action state.");
            if (State == "rejected" && !DefinitiveRejection(RejectionCode)) throw new InvalidDataException("Invalid action rejection.");
            if (State == "confirmed") ValidateReceipt(UomdJson.ParseObject(Receipt));
            else if (Receipt.Length > 0) throw new InvalidDataException("Pending action cannot have a receipt.");
        }
        public static bool DefinitiveRejection(string code) => Rejections.Contains(code);
        private static readonly HashSet<string> Rejections = new HashSet<string> { "insufficient_funds", "insufficient_items", "insufficient_shards", "not_owned", "no_such_skill", "not_xp_item", "xp_overflow", "account_level_too_low", "at_cap", "level_too_low", "max_ascension", "max_rank", "max_resonance", "no_excess_shards", "not_at_cap", "story_gate", "not_enough_ration", "sweep_requires_three_stars", "sweep_limit_reached", "sweep_not_repeatable", "node_locked", "unknown_node", "unknown_release", "release_not_economic", "invalid_choice", "unknown_selector", "selector_state_changed", "period_closed", "not_done", "already_claimed", "mode_locked", "afk_nothing_to_claim" };
        public void ValidateReceipt(Dictionary<string, object?> result)
        {
            if (InvitationPath(Path) || Path == TaskPath || Path == SuppliesPath || Path == PatrolPath)
            {
                if (JsonRead.Str(result, "requestId") != RequestId || JsonRead.Str(result, "releaseId") != Release || !(JsonRead.Get(result, "replayed") is bool)) throw new InvalidDataException("Account result identity mismatch.");
                if (InvitationPath(Path))
                {
                    if (JsonRead.Str(result, "itemId") != Path.Split('/')[4] || JsonRead.Str(result, "characterId") != JsonRead.Str(Body, "characterId") || JsonRead.Str(result, "characterName").Length == 0) throw new InvalidDataException("Invitation result identity mismatch.");
                    UomdBattleWire.RequiredInt(result, "consumed", 1, 1);
                    var grant = JsonRead.Obj(result, "grant"); UomdBattleWire.RequiredInt(grant, "copiesAdded", 1, 1);
                    int copies = UomdBattleWire.RequiredInt(grant, "copiesAfter", 1, int.MaxValue), added = UomdBattleWire.RequiredInt(grant, "shardsAdded", 0, int.MaxValue), total = UomdBattleWire.RequiredInt(grant, "shardsAfter", 0, int.MaxValue);
                    if (total < added || copies == 1 && added != 0 || copies > 1 && added == 0) throw new InvalidDataException("Invalid original invitation grant.");
                }
                else
                {
                    var rewards = UomdErrandsSnapshot.Rewards(result);
                    if (Path == TaskPath || Path == SuppliesPath)
                    {
                        string task = Path == SuppliesPath ? "_daily_supplies" : JsonRead.Str(Body, "taskId");
                        if (JsonRead.Str(result, "taskId") != task || JsonRead.Str(result, "periodKey") != JsonRead.Str(Body, "periodKey")) throw new InvalidDataException("Task result belongs to another period.");
                        if (Path == TaskPath && !UomdEntryCheckpoint.IsHash(JsonRead.Str(result, "taskRulesSha256"))) throw new InvalidDataException("Missing frozen task terms.");
                        if (Path == SuppliesPath && (UomdErrandsSnapshot.Timestamp(result, "endsAtMs") != UomdErrandsSnapshot.SupplyEnd(JsonRead.Str(Body, "periodKey")) || rewards.Count != 1 || JsonRead.Str(rewards[0], "type") != "currency" || UomdBattleWire.RequiredInt(result, "amount", 1, int.MaxValue) != JsonRead.Int(rewards[0], "amount"))) throw new InvalidDataException("Invalid original daily supplies.");
                    }
                    else
                    {
                        long previous = UomdErrandsSnapshot.Timestamp(result, "previousCheckpointMs"), next = UomdErrandsSnapshot.Timestamp(result, "checkpointMs");
                        int elapsed = UomdBattleWire.RequiredInt(result, "elapsedSeconds", 60, int.MaxValue), minutes = UomdBattleWire.RequiredInt(result, "minutesAccrued", 1, int.MaxValue);
                        if (next <= previous || (long)minutes * 60 > elapsed || !(JsonRead.Get(result, "capped") is bool) || rewards.Count == 0) throw new InvalidDataException("Invalid patrol settlement.");
                    }
                }
                return;
            }
            if (Path == SweepPath)
            {
                if (JsonRead.Str(result, "requestId") != RequestId || JsonRead.Str(result, "nodeId") != JsonRead.Str(Body, "nodeId") || JsonRead.Int(result, "count") != JsonRead.Int(Body, "count")) throw new InvalidDataException("Sweep result identity mismatch.");
                UomdBattleWire.RequiredInt(result, "dailyUsed", 1, int.MaxValue); UomdBattleWire.RequiredInt(result, "dailyLimit", 1, int.MaxValue);
                UomdBattleWire.RequiredInt(JsonRead.Obj(result, "ration"), "spent", 1, int.MaxValue);
                if (!(JsonRead.Get(result, "rewards") is List<object?>)) throw new InvalidDataException("Missing Sweep rewards.");
            }
            else
            {
                string id = Path.Split('/')[4];
                if (JsonRead.Str(result, "character") != id) throw new InvalidDataException("Companion result identity mismatch.");
                if (Path.EndsWith("/level-up", StringComparison.Ordinal))
                { UomdBattleWire.RequiredInt(result, "level", 1, int.MaxValue); UomdBattleWire.RequiredInt(result, "gainedXp", 1, int.MaxValue); UomdBattleWire.RequiredInt(result, "wastedXp", 0, int.MaxValue); }
                else if (Path.EndsWith("/ascend", StringComparison.Ordinal))
                { UomdBattleWire.RequiredInt(result, "ascension", 1, int.MaxValue); UomdBattleWire.RequiredInt(result, "newCap", 1, int.MaxValue); }
                else if (Path.Contains("/skills/")) UomdBattleWire.RequiredInt(result, "rank", 1, int.MaxValue);
                else if (Path.EndsWith("/attune", StringComparison.Ordinal))
                { UomdBattleWire.RequiredInt(result, "spentShards", 1, int.MaxValue); UomdBattleWire.RequiredInt(JsonRead.Obj(result, "resonance"), "tier", 1, 6); }
                else if (Path.EndsWith("/convert", StringComparison.Ordinal))
                { if (JsonRead.Int(result, "convertedShards") != JsonRead.Int(Body, "shards")) throw new InvalidDataException("Shard conversion amount mismatch."); UomdBattleWire.RequiredInt(result, "shardsRemaining", 0, int.MaxValue); }
            }
        }
        public Dictionary<string, object?>? ConfirmedStatus(Dictionary<string, object?> status)
        {
            if (JsonRead.Str(status, "requestId") != RequestId || JsonRead.Str(status, "path") != Path) throw new InvalidDataException("Action status identity mismatch.");
            if (JsonRead.Str(status, "state") == "unknown")
            {
                if (JsonRead.Get(status, "binding") != null || JsonRead.Get(status, "inputHash") != null || JsonRead.Get(status, "result") != null) throw new InvalidDataException("Malformed unknown action status.");
                return null;
            }
            if (JsonRead.Str(status, "state") != "confirmed" || JsonRead.Str(status, "binding") != "exact" || JsonRead.Str(status, "inputHash") != InputHash) throw new InvalidDataException("Action status is not bound to the original input.");
            var result = JsonRead.Obj(status, "result"); ValidateReceipt(result); return result;
        }
        public string Encode() => CanonicalJson.Serialize(new Dictionary<string, object?> { ["version"] = 1, ["scope"] = Scope, ["path"] = Path, ["payload"] = Payload, ["state"] = State, ["receipt"] = Receipt, ["rejectionCode"] = RejectionCode, ["summary"] = Summary });
        public static UomdSavedAction Decode(string text, string scope)
        {
            var d = UomdJson.ParseObject(text);
            if (JsonRead.Int(d, "version") != 1) throw new NotSupportedException("Unsupported action journal version.");
            var action = new UomdSavedAction { Scope = JsonRead.Str(d, "scope"), Path = JsonRead.Str(d, "path"), Payload = JsonRead.Str(d, "payload"), State = JsonRead.Str(d, "state"), Receipt = JsonRead.Str(d, "receipt"), RejectionCode = JsonRead.Str(d, "rejectionCode"), Summary = JsonRead.Str(d, "summary") };
            if (action.Scope != scope) throw new InvalidDataException("Action account mismatch.");
            action.Validate(); return action;
        }
    }
    public sealed class UomdActionJournal
    {
        private const int MaxBytes = 256 * 1024;
        private readonly string _root;
        private readonly bool _memoryOnly;
        private readonly Dictionary<string, string> _memory = new Dictionary<string, string>();
        public UomdActionJournal(string root, bool memoryOnly = false) { _root = root; _memoryOnly = memoryOnly; }
        private string FileFor(string scope)
        {
            if (!UomdEntryCheckpoint.IsHash(scope)) throw new ArgumentException("Invalid action account scope.");
            return System.IO.Path.Combine(_root, scope + ".json");
        }
        public UomdSavedAction? Load(string scope)
        {
            string path = FileFor(scope), text;
            if (_memoryOnly) { if (!_memory.TryGetValue(scope, out text)) return null; }
            else { if (!File.Exists(path)) return null; if (new FileInfo(path).Length > MaxBytes) throw new InvalidDataException("Oversized action journal."); text = File.ReadAllText(path); }
            var d = UomdJson.ParseObject(text); string payload = UomdBattleWire.RequiredString(d, "payload");
            if (JsonRead.Str(d, "sha256") != UomdBattleWire.Hash(payload)) throw new InvalidDataException("The action journal checksum failed. Preserve it for recovery.");
            return UomdSavedAction.Decode(payload, scope);
        }
        public void Save(UomdSavedAction action)
        {
            var previous = Load(action.Scope);
            if (previous?.State == "pending" && (previous.Path != action.Path || previous.Payload != action.Payload || previous.Summary != action.Summary)) throw new InvalidOperationException("The unresolved original action cannot be replaced.");
            string path = FileFor(action.Scope), payload = action.Encode(); UomdSavedAction.Decode(payload, action.Scope);
            byte[] bytes = Encoding.UTF8.GetBytes(CanonicalJson.Serialize(new Dictionary<string, object?> { ["payload"] = payload, ["sha256"] = UomdBattleWire.Hash(payload) }));
            if (bytes.Length > MaxBytes) throw new InvalidDataException("Oversized action journal.");
            if (_memoryOnly) { _memory[action.Scope] = Encoding.UTF8.GetString(bytes); return; }
            Directory.CreateDirectory(_root); string temp = path + ".tmp";
            try
            {
                using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None)) { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                if (File.Exists(path)) File.Replace(temp, path, path + ".bak"); else File.Move(temp, path);
            }
            finally { if (File.Exists(temp)) File.Delete(temp); }
        }
    }
}
