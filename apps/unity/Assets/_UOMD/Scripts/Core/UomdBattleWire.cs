#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Uomd.Contracts;

namespace Uomd.Core
{
    // Provider: apps/api/src/progress/battle-contract.ts. Cross-runtime fixtures exercise this boundary.
    public static class UomdBattleWire
    {
        public const string Path = "/api/v1/progress/battle";
        public static bool Id(string value, int max) => Regex.IsMatch(value, "^[a-z][a-z0-9_]{1," + (max - 1) + "}$");
        public static string Start(string release, string node)
        {
            if (!Id(release, 48) || !Id(node, 80)) throw new InvalidDataException("Invalid battle content identity.");
            return CanonicalJson.Serialize(new Dictionary<string, object?> { ["releaseId"] = release, ["nodeId"] = node });
        }
        public static string Submit(BattleSubmitRequestDto request)
        {
            var body = UomdJson.ParseObject(Start(request.releaseId, request.nodeId));
            if (!Regex.IsMatch(request.requestId ?? "", "^[A-Za-z0-9_-]{8,64}$")) throw new InvalidDataException("Invalid battle request identity.");
            body["requestId"] = request.requestId;
            if (request.sessionId != null)
            {
                if (!Regex.IsMatch(request.sessionId, "^[a-f0-9]{32}$")) throw new InvalidDataException("Invalid battle session.");
                body["sessionId"] = request.sessionId;
            }
            if (request.actions == null || request.actions.Length > 600) throw new InvalidDataException("Too many battle actions.");
            body["actions"] = request.actions.Select(a =>
            {
                if (a == null || a.skillId == null || a.skillId.Length > 80 || a.targetId?.Length > 80) throw new InvalidDataException("Invalid battle action.");
                var action = new Dictionary<string, object?> { ["skillId"] = a.skillId };
                if (a.targetId != null) action["targetId"] = a.targetId;
                return action;
            }).ToArray();
            string json = CanonicalJson.Serialize(body);
            if (Encoding.UTF8.GetByteCount(json) > 64 * 1024) throw new InvalidDataException("Battle request exceeds the server limit.");
            return json;
        }
        public static string RequiredString(object d, string key) => JsonRead.Get(d, key) is string s ? s : throw new InvalidDataException("Missing battle field: " + key);
        public static int RequiredInt(object d, string key, int min, int max)
        {
            object? value = JsonRead.Get(d, key);
            if (!(value is long n) || n < min || n > max) throw new InvalidDataException("Invalid battle number: " + key);
            return (int)n;
        }
        public static string Hash(string text) => Sha256Hash.ComputeHex(Encoding.UTF8.GetBytes(text));
    }

    public sealed class BattleStartReceipt
    {
        public string? SessionId, ExpiresAt, CatalogHash;
        public string PartyJson = "null";
        public static BattleStartReceipt Parse(string json)
        {
            var d = UomdJson.ParseObject(json);
            if (!d.ContainsKey("sessionId") || !d.ContainsKey("party") || !d.ContainsKey("expiresAt")) throw new InvalidDataException("Incomplete battle start.");
            var r = new BattleStartReceipt { SessionId = Optional(d, "sessionId"), ExpiresAt = Optional(d, "expiresAt"), CatalogHash = Optional(d, "catalogSha256"), PartyJson = CanonicalJson.Serialize(d["party"]) };
            if (r.SessionId != null && !Regex.IsMatch(r.SessionId, "^[a-f0-9]{32}$") || r.CatalogHash != null && !UomdEntryCheckpoint.IsHash(r.CatalogHash)) throw new InvalidDataException("Invalid battle start identity.");
            if (r.ExpiresAt != null && !DateTimeOffset.TryParse(r.ExpiresAt, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out _)) throw new InvalidDataException("Invalid session expiry.");
            if (d["party"] != null && (!(d["party"] is List<object?> party) || party.Count < 1 || party.Count > 5)) throw new InvalidDataException("Invalid frozen party.");
            return r;
        }
        private static string? Optional(object d, string key) => JsonRead.Get(d, key) == null ? null : UomdBattleWire.RequiredString(d, key);
    }

    public sealed class BattleReceipt
    {
        public string RequestId = "", NodeId = "", Json = "";
        public string? CatalogHash;
        public int Stars, BestStars, Turns;
        public static BattleReceipt Parse(string json)
        {
            var d = UomdJson.ParseObject(json);
            var r = new BattleReceipt { RequestId = UomdBattleWire.RequiredString(d, "requestId"), NodeId = UomdBattleWire.RequiredString(d, "nodeId"),
                CatalogHash = JsonRead.Get(d, "catalogSha256") as string, Stars = UomdBattleWire.RequiredInt(d, "stars", 1, 3), BestStars = UomdBattleWire.RequiredInt(d, "bestStars", 1, 3), Turns = UomdBattleWire.RequiredInt(d, "turns", 0, int.MaxValue), Json = json };
            if (!(JsonRead.Get(d, "firstClear") is bool) || !(JsonRead.Get(d, "newThreeStar") is bool) || !(JsonRead.Get(d, "replayed") is bool) || !(JsonRead.Get(d, "rewards") is List<object?>) || !(JsonRead.Get(d, "ration") is Dictionary<string, object?>)) throw new InvalidDataException("Incomplete battle receipt.");
            return r;
        }
    }

    public sealed class BattleOperationStatus
    {
        public bool Confirmed;
        public BattleReceipt? Result;
        public static BattleOperationStatus Parse(string json, string requestId, string inputHash)
        {
            var d = UomdJson.ParseObject(json);
            if (UomdBattleWire.RequiredString(d, "requestId") != requestId || UomdBattleWire.RequiredString(d, "path") != UomdBattleWire.Path) throw new InvalidDataException("Operation identity mismatch.");
            string state = UomdBattleWire.RequiredString(d, "state");
            if (state == "unknown" && JsonRead.Get(d, "result") == null && JsonRead.Get(d, "binding") == null && JsonRead.Get(d, "inputHash") == null) return new BattleOperationStatus();
            // New journaled claims require exact proof; a legacy result never settles a new payload.
            if (state != "confirmed" || UomdBattleWire.RequiredString(d, "binding") != "exact" || UomdBattleWire.RequiredString(d, "inputHash") != inputHash) throw new InvalidDataException("The server result is not bound to this battle payload.");
            var result = BattleReceipt.Parse(CanonicalJson.Serialize(JsonRead.Get(d, "result")));
            if (result.RequestId != requestId) throw new InvalidDataException("Battle receipt identity mismatch.");
            return new BattleOperationStatus { Confirmed = true, Result = result };
        }
    }
}
