#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>Canonical patch text, synthetic account gates and non-reward completion. No HTTP or device progress.</summary>
    public sealed partial class UomdHubReview
    {
        public const string LibrarySource = "content/patches/rel_0003_part1_campaign/library/library_index.json";
        private List<Dictionary<string, object>> _libraryEntries;
        private readonly Dictionary<string, HashSet<string>> _libraryCompleted = new Dictionary<string, HashSet<string>>();
        private readonly Dictionary<string, (string Payload, Dictionary<string, object> Result)> _libraryResults = new Dictionary<string, (string, Dictionary<string, object>)>();
        public string LibraryMode = "gated", LibraryLastPayload = "";
        public bool LibraryEventsOpen, LibraryStatusOffline, LibraryLoseResponse;
        public int LibraryReads, LibraryWrites, LibraryApplied;
        public AwaitableCompletionSource<bool> LibraryReadGate, LibraryWriteGate;
        private async Awaitable InitializeLibraryAsync()
        {
            await Awaitable.NextFrameAsync();
            string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../../.."));
            var library = UomdJson.ParseObject(File.ReadAllText(Path.Combine(root, LibrarySource)));
            _libraryEntries = JsonRead.Objects(library, "entries").ToList();
        }
        private HashSet<string> LibraryCompleted(string player)
        {
            if (!_libraryCompleted.TryGetValue(player, out var entries)) _libraryCompleted[player] = entries = new HashSet<string>(StringComparer.Ordinal);
            return entries;
        }
        private bool LibraryAllows(Dictionary<string, object> entry, string player, string mode)
        {
            if (mode == "empty") return false;
            var gate = JsonRead.Obj(entry, "gate"); var completed = LibraryCompleted(player);
            return (JsonRead.Str(gate, "after_node").Length == 0 || mode == "unlocked")
                && (JsonRead.Str(gate, "after_entry").Length == 0 || completed.Contains(JsonRead.Str(gate, "after_entry")))
                && (JsonRead.Str(gate, "owned_character").Length == 0 || JsonRead.Str(gate, "owned_character") == "mahmut" || JsonRead.Str(gate, "owned_character") == "fadyme")
                && (JsonRead.Str(entry, "kind") != "event" || LibraryEventsOpen || completed.Contains(JsonRead.Str(entry, "entry_id")));
        }
        public async Awaitable<Dictionary<string, object>> ReadLibraryAsync(string path)
        {
            ++LibraryReads;
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "", mode = LibraryMode, release = _router.Patch.ActiveReleaseId;
            var gate = LibraryReadGate; LibraryReadGate = null;
            if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (mode == "offline") throw new UomdApiException(0, "fixture_offline", "Isolated Archive fixture.");
            if (path.StartsWith("/api/v1/operations/", StringComparison.Ordinal))
            {
                if (LibraryStatusOffline) throw new UomdApiException(0, "fixture_offline", "Isolated status fixture.");
                string request = path.Substring("/api/v1/operations/".Length).Split('?')[0];
                if (_libraryResults.TryGetValue(player + ":" + request, out var record))
                {
                    var receipt = new Dictionary<string, object>(record.Result) { ["replayed"] = true };
                    return LibraryGraph(new Dictionary<string, object> { ["requestId"] = request, ["path"] = UomdStoryCompletion.Path, ["state"] = "confirmed", ["binding"] = "exact", ["inputHash"] = UomdBattleWire.Hash(record.Payload), ["result"] = receipt });
                }
                return new Dictionary<string, object> { ["requestId"] = request, ["path"] = UomdStoryCompletion.Path, ["state"] = "unknown", ["binding"] = null, ["inputHash"] = null, ["result"] = null };
            }
            var allowed = _libraryEntries.Where(e => LibraryAllows(e, player, mode)).ToList();
            string responseRelease = mode == "wrong_release" ? "rel_other" : release;
            if (path.StartsWith("/api/v1/library?", StringComparison.Ordinal))
            {
                var cards = allowed.Select(e => (object)new Dictionary<string, object> { ["entry_id"] = JsonRead.Str(e, "entry_id"), ["kind"] = JsonRead.Str(e, "kind"), ["group_id"] = JsonRead.Str(e, "group_id"), ["part"] = JsonRead.Int(e, "part"), ["title_en"] = JsonRead.Str(e, "title_en"), ["completed"] = LibraryCompleted(player).Contains(JsonRead.Str(e, "entry_id")) }).ToList();
                if (mode == "malformed") cards.Add(new Dictionary<string, object> { ["entry_id"] = "missing_card_fields" });
                return LibraryGraph(new Dictionary<string, object> { ["releaseId"] = responseRelease, ["entries"] = cards });
            }
            string id = Uri.UnescapeDataString(path.Substring("/api/v1/library/".Length).Split('?')[0]);
            var entry = allowed.FirstOrDefault(e => JsonRead.Str(e, "entry_id") == id);
            if (entry == null) throw new UomdApiException(403, "node_locked", "Isolated gate.");
            return LibraryGraph(new Dictionary<string, object> { ["releaseId"] = responseRelease, ["entry"] = entry });
        }
        public async Awaitable<Dictionary<string, object>> CompleteLibraryAsync(Dictionary<string, object> body)
        {
            ++LibraryWrites;
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "", mode = LibraryMode, payload = CanonicalJson.Serialize(body);
            string node = JsonRead.Str(body, "nodeId"), request = JsonRead.Str(body, "requestId"), release = JsonRead.Str(body, "releaseId");
            LibraryLastPayload = payload;
            var gate = LibraryWriteGate; LibraryWriteGate = null;
            if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (body.Count != 3 || release != _router.Patch.ActiveReleaseId || !_libraryEntries.Any(e => JsonRead.Str(e, "entry_id") == node && LibraryAllows(e, player, mode))) throw new UomdApiException(403, "node_locked", "Isolated completion gate.");
            if (_libraryResults.TryGetValue(player + ":" + request, out var prior))
            {
                if (prior.Payload != payload) throw new UomdApiException(409, "request_id_reused", "Isolated identity conflict.");
                return LibraryGraph(new Dictionary<string, object>(prior.Result) { ["replayed"] = true });
            }
            var receipt = new Dictionary<string, object> { ["requestId"] = request, ["releaseId"] = release, ["nodeId"] = node, ["completed"] = true, ["replayed"] = false };
            ++LibraryApplied; LibraryCompleted(player).Add(node); _libraryResults[player + ":" + request] = (payload, receipt);
            if (LibraryLoseResponse) { LibraryLoseResponse = false; LibraryStatusOffline = true; throw new UomdApiException(0, "fixture_response_lost", "Isolated committed result."); }
            return LibraryGraph(receipt);
        }
        private static Dictionary<string, object> LibraryGraph(object value) => UomdJson.ParseObject(CanonicalJson.Serialize(value));
    }
}
#endif
