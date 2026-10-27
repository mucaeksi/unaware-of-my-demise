#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Uomd.Core
{
    /// <summary>Only server-listed cards are visible. Local patch contents never grant spoiler access.</summary>
    public sealed class UomdLibrary
    {
        public sealed class Card
        {
            public string Id = "", Kind = "", Group = "", Title = "";
            public int Part;
            public bool Completed;
        }
        public readonly List<Card> Cards = new List<Card>();
        public static UomdLibrary Parse(object response, string release)
        {
            if (UomdBattleWire.RequiredString(response, "releaseId") != release || !(JsonRead.Get(response, "entries") is List<object?> entries) || entries.Count > 200)
                throw new InvalidDataException("Archive listing is unavailable for this content.");
            var result = new UomdLibrary(); var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (object? value in entries)
            {
                if (value == null) throw new InvalidDataException("Invalid Archive card.");
                var card = ReadCard(value);
                if (!ids.Add(card.Id) || !(JsonRead.Get(value, "completed") is bool completed)) throw new InvalidDataException("Invalid Archive listing.");
                card.Completed = completed; result.Cards.Add(card);
            }
            return result;
        }
        private static Card ReadCard(object value)
        {
            var c = new Card { Id = Id(value, "entry_id"), Kind = UomdBattleWire.RequiredString(value, "kind"), Group = Id(value, "group_id"),
                Title = UomdBattleWire.RequiredString(value, "title_en"), Part = UomdBattleWire.RequiredInt(value, "part", 1, 200) };
            if (c.Title.Length < 1 || c.Title.Length > 80 || c.Kind != "companion" && c.Kind != "codex" && c.Kind != "event") throw new InvalidDataException("Invalid Archive card.");
            return c;
        }
        private static string Id(object value, string field)
        {
            string id = UomdBattleWire.RequiredString(value, field);
            if (!UomdBattleWire.Id(id, 80)) throw new InvalidDataException("Invalid Archive identity.");
            return id;
        }
        // Published library scenes use the existing closed StoryRunner grammar, never downloaded code.
        private static readonly HashSet<string> Ops = new HashSet<string>(("set_flag branch label goto voice sound video layer remove_layer animate camera mask panel background music fade show hide flash shake wait checkpoint say narrate choice end").Split(' '), StringComparer.Ordinal);
        public static List<string> Reading(object response, string release, Card expected)
        {
            if (UomdBattleWire.RequiredString(response, "releaseId") != release || !(JsonRead.Get(response, "entry") is Dictionary<string, object?> entry)) throw new InvalidDataException("Archive content changed.");
            Card actual = ReadCard(entry);
            if (actual.Id != expected.Id || actual.Kind != expected.Kind || actual.Group != expected.Group || actual.Part != expected.Part || actual.Title != expected.Title) throw new InvalidDataException("Archive selection changed.");
            if (!(JsonRead.Get(entry, "scenes") is List<object?> scenes) || scenes.Count < 1 || scenes.Count > 8) throw new InvalidDataException("This reading has no supported scenes.");
            var result = new List<string>(); var sceneIds = new HashSet<string>(); var lines = new HashSet<string>();
            foreach (object? scene in scenes)
            {
                if (scene == null || !sceneIds.Add(Id(scene, "scene_id")) || UomdBattleWire.RequiredInt(scene, "schema_version", 1, 1) != 1
                    || !(JsonRead.Get(scene, "commands") is List<object?> commands) || commands.Count < 1 || commands.Count > 400) throw new InvalidDataException("Invalid Archive scene.");
                Id(scene, "location_id");
                foreach (object? command in commands)
                {
                    if (command == null || !Ops.Contains(UomdBattleWire.RequiredString(command, "op"))) throw new InvalidDataException("This story needs a newer app.");
                    string op = JsonRead.Str(command, "op");
                    if (op != "say" && op != "narrate") continue;
                    string text = UomdBattleWire.RequiredString(command, "text"), line = UomdBattleWire.RequiredString(command, "line_id");
                    if (text.Length < 1 || text.Length > 600 || line.Length < 1 || line.Length > 80 || !lines.Add(line)) throw new InvalidDataException("Invalid Archive line.");
                }
                result.Add(CanonicalJson.Serialize(scene));
            }
            if (!(JsonRead.Get(entry, "line_ids") is List<object?> declared) || declared.Count < 1 || declared.Count > 1000 || declared.Count != lines.Count || declared.Any(l => !(l is string s) || !lines.Contains(s)) || declared.Distinct().Count() != declared.Count)
                throw new InvalidDataException("Archive line coverage changed.");
            return result;
        }
    }

    /// <summary>Exact original non-reward story completion; unknown status is never interpreted as success.</summary>
    public sealed class UomdStoryCompletion
    {
        public const string Path = "/api/v1/progress/story";
        public readonly string Release, Entry, Request, Payload, InputHash;
        public UomdStoryCompletion(string release, string entry, string request)
        {
            if (!Regex.IsMatch(request ?? "", "^[A-Za-z0-9_-]{8,64}$")) throw new InvalidDataException("Invalid story request.");
            var body = UomdJson.ParseObject(UomdBattleWire.Start(release, entry)); body["requestId"] = request;
            Release = release; Entry = entry; Request = request; Payload = CanonicalJson.Serialize(body); InputHash = UomdBattleWire.Hash(Payload);
        }
        public void Confirm(object receipt)
        {
            if (UomdBattleWire.RequiredString(receipt, "requestId") != Request || UomdBattleWire.RequiredString(receipt, "releaseId") != Release
                || UomdBattleWire.RequiredString(receipt, "nodeId") != Entry || !(JsonRead.Get(receipt, "completed") is bool completed) || !completed
                || !(JsonRead.Get(receipt, "replayed") is bool)) throw new InvalidDataException("Story completion was not confirmed.");
        }
        public bool Status(object response)
        {
            if (UomdBattleWire.RequiredString(response, "requestId") != Request || UomdBattleWire.RequiredString(response, "path") != Path) throw new InvalidDataException("Story status identity mismatch.");
            string state = UomdBattleWire.RequiredString(response, "state");
            if (state == "unknown" && JsonRead.Get(response, "binding") == null && JsonRead.Get(response, "inputHash") == null && JsonRead.Get(response, "result") == null) return false;
            if (state != "confirmed" || JsonRead.Str(response, "binding") != "exact" || JsonRead.Str(response, "inputHash") != InputHash) throw new InvalidDataException("Story status is not bound to the original reading.");
            Confirm(JsonRead.Get(response, "result")!); return true;
        }
    }
}
