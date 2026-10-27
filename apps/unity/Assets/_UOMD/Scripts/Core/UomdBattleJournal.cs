#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Uomd.Contracts;

namespace Uomd.Core
{
    /// <summary>One unresolved battle per stable account. No credentials, reward authority or narrative cursor.</summary>
    public sealed class UomdBattleOperation
    {
        public const int Version = 1;
        public string Scope = "", Release = "", Node = "", Encounter = "", RequestId = "", StartJson = "", PackHash = "", EncounterHash = "";
        public string State = "fighting", Payload = "", ReceiptJson = "", RejectionCode = "";
        public string InputHash => UomdBattleWire.Hash(Payload);
        public bool Pending => State == "pending";
        public BattleStartReceipt Start => BattleStartReceipt.Parse(StartJson);
        public bool ContentMatches(string release, string pack, string encounter) => Release == release && PackHash == UomdBattleWire.Hash(pack) && EncounterHash == UomdBattleWire.Hash(encounter);
        public void Prepare(BattleActionInputDto[] actions)
        {
            string payload = UomdBattleWire.Submit(new BattleSubmitRequestDto { releaseId = Release, nodeId = Node, requestId = RequestId, sessionId = Start.SessionId, actions = actions });
            if (State != "fighting" && (State != "pending" || Payload != payload)) throw new InvalidOperationException("The original battle payload cannot change.");
            Payload = payload; State = "pending";
        }
        public void Confirm(BattleReceipt receipt)
        {
            if ((State != "pending" && State != "rejected") || receipt.RequestId != RequestId || receipt.NodeId != Node || Start.CatalogHash != null && receipt.CatalogHash != Start.CatalogHash) throw new InvalidDataException("Battle confirmation mismatch.");
            ReceiptJson = receipt.Json; State = "confirmed";
        }
        public string Encode() => CanonicalJson.Serialize(new Dictionary<string, object?> { ["version"] = Version, ["path"] = UomdBattleWire.Path, ["scope"] = Scope, ["release"] = Release, ["node"] = Node,
            ["encounter"] = Encounter, ["requestId"] = RequestId, ["start"] = StartJson, ["packHash"] = PackHash, ["encounterHash"] = EncounterHash,
            ["state"] = State, ["payload"] = Payload, ["receipt"] = ReceiptJson, ["rejectionCode"] = RejectionCode });
        public static UomdBattleOperation Decode(string json, string scope)
        {
            var d = UomdJson.ParseObject(json);
            if (JsonRead.Int(d, "version") != Version) throw new NotSupportedException("Unsupported battle journal version.");
            if (JsonRead.Str(d, "path") != UomdBattleWire.Path) throw new InvalidDataException("Invalid battle operation path.");
            var r = new UomdBattleOperation { Scope = JsonRead.Str(d, "scope"), Release = JsonRead.Str(d, "release"), Node = JsonRead.Str(d, "node"), Encounter = JsonRead.Str(d, "encounter"),
                RequestId = JsonRead.Str(d, "requestId"), StartJson = JsonRead.Str(d, "start"), PackHash = JsonRead.Str(d, "packHash"), EncounterHash = JsonRead.Str(d, "encounterHash"),
                RejectionCode = JsonRead.Str(d, "rejectionCode"), State = JsonRead.Str(d, "state"), Payload = JsonRead.Str(d, "payload"), ReceiptJson = JsonRead.Str(d, "receipt") };
            UomdBattleWire.Start(r.Release, r.Node);
            if (r.Scope != scope || !UomdEntryCheckpoint.IsHash(scope) || !UomdEntryCheckpoint.IsHash(r.PackHash) || !UomdEntryCheckpoint.IsHash(r.EncounterHash) || !UomdBattleWire.Id(r.Encounter, 80) || !System.Text.RegularExpressions.Regex.IsMatch(r.RequestId, "^[a-f0-9]{32}$")) throw new InvalidDataException("Invalid battle journal binding.");
            _ = r.Start;
            if (r.State != "fighting" && r.State != "pending" && r.State != "confirmed" && r.State != "rejected") throw new InvalidDataException("Invalid battle journal state.");
            if (r.State == "rejected" && r.RejectionCode != "session_expired" && r.RejectionCode != "battle_not_won") throw new InvalidDataException("Invalid battle rejection.");
            if (r.State == "fighting" && (r.Payload.Length > 0 || r.ReceiptJson.Length > 0)) throw new InvalidDataException("Unexpected battle proof.");
            if (r.State != "fighting")
            {
                var body = UomdJson.ParseObject(r.Payload);
                if (CanonicalJson.Serialize(body) != r.Payload || JsonRead.Str(body, "releaseId") != r.Release || JsonRead.Str(body, "nodeId") != r.Node || JsonRead.Str(body, "requestId") != r.RequestId || (JsonRead.Get(body, "sessionId") as string) != r.Start.SessionId) throw new InvalidDataException("Invalid battle payload binding.");
                if (r.State == "confirmed") { var receipt = BattleReceipt.Parse(r.ReceiptJson); if (receipt.RequestId != r.RequestId || receipt.NodeId != r.Node) throw new InvalidDataException("Invalid saved receipt."); }
            }
            return r;
        }
        public static string ScopeFor(string accountKey)
        {
            if (!accountKey.StartsWith("player:", StringComparison.Ordinal) || accountKey.Length <= 7) throw new InvalidOperationException("A stable signed-in account is required.");
            return UomdBattleWire.Hash("uomd-battle-v1:" + accountKey);
        }
    }

    public sealed class UomdBattleJournal
    {
        private const int MaxBytes = 256 * 1024;
        private readonly string _root;
        private readonly bool _memoryOnly;
        private readonly Dictionary<string, string> _memory = new Dictionary<string, string>();
        public UomdBattleJournal(string root, bool memoryOnly = false) { _root = root; _memoryOnly = memoryOnly; }
        public UomdBattleOperation? Load(string scope)
        {
            string path = FileFor(scope);
            if (_memoryOnly) return _memory.TryGetValue(scope, out var v) ? Unwrap(v, scope) : null;
            if (!File.Exists(path)) return null;
            if (new FileInfo(path).Length > MaxBytes) throw new InvalidDataException("Oversized battle journal.");
            // A prior copy may predate sending. Never silently regress to it and forget an unresolved claim.
            return Unwrap(File.ReadAllText(path), scope);
        }
        public void Save(UomdBattleOperation operation)
        {
            string path = FileFor(operation.Scope), payload = operation.Encode();
            UomdBattleOperation.Decode(payload, operation.Scope);
            string json = CanonicalJson.Serialize(new Dictionary<string, object?> { ["payload"] = payload, ["sha256"] = UomdBattleWire.Hash(payload) });
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            if (bytes.Length > MaxBytes) throw new InvalidDataException("Oversized battle journal.");
            if (_memoryOnly) { _memory[operation.Scope] = json; return; }
            Directory.CreateDirectory(_root);
            string temp = path + ".tmp";
            try
            {
                using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None)) { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                if (File.Exists(path)) File.Replace(temp, path, path + ".bak"); else File.Move(temp, path);
            }
            finally { if (File.Exists(temp)) File.Delete(temp); }
        }
        private string FileFor(string scope)
        {
            if (!UomdEntryCheckpoint.IsHash(scope)) throw new ArgumentException("Invalid battle journal scope.");
            return System.IO.Path.Combine(_root, scope + ".json");
        }
        private static UomdBattleOperation Unwrap(string json, string scope)
        {
            var d = UomdJson.ParseObject(json); string payload = UomdBattleWire.RequiredString(d, "payload");
            if (UomdBattleWire.Hash(payload) != JsonRead.Str(d, "sha256")) throw new InvalidDataException("The battle journal checksum failed. Recovery is required before another battle.");
            return UomdBattleOperation.Decode(payload, scope);
        }
    }
}
