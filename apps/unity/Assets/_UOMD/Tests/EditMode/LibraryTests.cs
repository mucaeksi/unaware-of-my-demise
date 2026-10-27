#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class LibraryTests
    {
        private static Dictionary<string, object?> Parse(string json) => UomdJson.ParseObject(json);
        private const string CardJson = "{\"entry_id\":\"codex_fixture\",\"kind\":\"codex\",\"group_id\":\"premise\",\"part\":1,\"title_en\":\"Fixture reading\",\"completed\":false}";
        private static Dictionary<string, object?> Listing() => Parse("{\"releaseId\":\"rel_0001\",\"entries\":[" + CardJson + "]}");
        private static UomdLibrary.Card Card() => UomdLibrary.Parse(Listing(), "rel_0001").Cards[0];
        private static Dictionary<string, object?> Reading()
        {
            var entry = Parse(CardJson); entry.Remove("completed");
            entry["scenes"] = UomdJson.Parse("[{\"schema_version\":1,\"scene_id\":\"scene_first\",\"location_id\":\"shelter\",\"commands\":[{\"op\":\"narrate\",\"line_id\":\"line_one\",\"text\":\"Fixture text.\"},{\"op\":\"end\"}]}]");
            entry["line_ids"] = new List<object?> { "line_one" };
            return new Dictionary<string, object?> { ["releaseId"] = "rel_0001", ["entry"] = entry };
        }
        [Test] public void EmptyServerShelfDoesNotFallBackToLocalSpoilerContents()
        {
            Assert.IsEmpty(UomdLibrary.Parse(Parse("{\"releaseId\":\"rel_0001\",\"entries\":[]}"), "rel_0001").Cards);
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Parse(Listing(), "rel_other"));
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Parse(Parse("{}"), "rel_0001"));
        }
        [TestCase("completed", "\"true\"")]
        [TestCase("kind", "\"hidden_future_kind\"")]
        [TestCase("part", "1.5")]
        public void MalformedCardNeverBecomesUnlocked(string field, string value)
        {
            var card = Parse(CardJson); card[field] = UomdJson.Parse(value);
            var response = Listing(); response["entries"] = new List<object?> { card };
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Parse(response, "rel_0001"));
        }
        [Test] public void DuplicateAndOversizeListingsFailClosed()
        {
            var response = Listing(); var cards = (List<object?>)response["entries"]!;
            cards.Add(Parse(CardJson)); Assert.Throws<InvalidDataException>(() => UomdLibrary.Parse(response, "rel_0001"));
            for (int i = cards.Count; i <= 200; ++i) cards.Add(Parse(CardJson));
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Parse(response, "rel_0001"));
        }
        [Test] public void ReadingMustMatchTheOriginalListedIdentityAndRelease()
        {
            var response = Reading(); Assert.AreEqual(1, UomdLibrary.Reading(response, "rel_0001", Card()).Count);
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Reading(response, "rel_other", Card()));
            ((Dictionary<string, object?>)response["entry"]!)["entry_id"] = "another_reading";
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Reading(response, "rel_0001", Card()));
        }
        [Test] public void UnknownCommandsAndIncompleteLineCoverageCannotMarkAReadingRead()
        {
            var response = Reading(); var entry = (Dictionary<string, object?>)response["entry"]!;
            entry["line_ids"] = new List<object?> { "different_line" };
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Reading(response, "rel_0001", Card()));
            response = Parse(CanonicalJson.Serialize(Reading()).Replace("narrate", "download_code"));
            Assert.Throws<InvalidDataException>(() => UomdLibrary.Reading(response, "rel_0001", Card()));
        }
        [Test] public void SceneOrderIsPreservedAndDuplicateSceneIdsAreRejected()
        {
            var response = Reading(); var entry = (Dictionary<string, object?>)response["entry"]!;
            var scenes = (List<object?>)entry["scenes"]!;
            scenes.Add(Parse(CanonicalJson.Serialize(scenes[0]).Replace("scene_first", "scene_second").Replace("line_one", "line_two")));
            entry["line_ids"] = new List<object?> { "line_one", "line_two" };
            var result = UomdLibrary.Reading(response, "rel_0001", Card());
            Assert.AreEqual("scene_first", JsonRead.Str(Parse(result[0]), "scene_id")); Assert.AreEqual("scene_second", JsonRead.Str(Parse(result[1]), "scene_id"));
            scenes[1] = scenes[0]; Assert.Throws<InvalidDataException>(() => UomdLibrary.Reading(response, "rel_0001", Card()));
        }
        private static UomdStoryCompletion Completion() => new UomdStoryCompletion("rel_0001", "codex_fixture", "original_request_123");
        private static Dictionary<string, object?> Receipt() => Parse("{\"releaseId\":\"rel_0001\",\"nodeId\":\"codex_fixture\",\"requestId\":\"original_request_123\",\"completed\":true,\"replayed\":false}");
        [Test] public void StoryRetryRetainsExactlyTheOriginalNonRewardInput()
        {
            var c = Completion(); Assert.AreEqual(3, Parse(c.Payload).Count);
            Assert.AreEqual("rel_0001", JsonRead.Str(Parse(c.Payload), "releaseId"));
            Assert.AreEqual(UomdBattleWire.Hash(c.Payload), c.InputHash); c.Confirm(Receipt());
            var receipt = Receipt(); receipt["releaseId"] = "rel_new";
            Assert.Throws<InvalidDataException>(() => c.Confirm(receipt));
        }
        [Test] public void MissingOrFalseCompletionNeverCountsAsRead()
        {
            var c = Completion(); var r = Receipt(); r["completed"] = false;
            Assert.Throws<InvalidDataException>(() => c.Confirm(r));
            r = Receipt(); r.Remove("replayed"); Assert.Throws<InvalidDataException>(() => c.Confirm(r));
        }
        [Test] public void StatusRequiresExactOriginalBindingAndReceipt()
        {
            var c = Completion();
            var status = new Dictionary<string, object?> { ["requestId"] = c.Request, ["path"] = UomdStoryCompletion.Path, ["state"] = "confirmed", ["binding"] = "exact", ["inputHash"] = c.InputHash, ["result"] = Receipt() };
            Assert.True(c.Status(status)); status["binding"] = "legacy"; Assert.Throws<InvalidDataException>(() => c.Status(status));
            status["binding"] = "exact"; status["inputHash"] = new string('0', 64); Assert.Throws<InvalidDataException>(() => c.Status(status));
            status["inputHash"] = c.InputHash; status["path"] = "/api/v1/progress/sweep"; Assert.Throws<InvalidDataException>(() => c.Status(status));
        }
        [Test] public void UnknownStatusDoesNotInventSuccessOrAcceptAResult()
        {
            var c = Completion(); var status = Parse("{\"requestId\":\"original_request_123\",\"path\":\"/api/v1/progress/story\",\"state\":\"unknown\",\"binding\":null,\"inputHash\":null,\"result\":null}");
            Assert.False(c.Status(status)); status["result"] = Receipt(); Assert.Throws<InvalidDataException>(() => c.Status(status));
        }
    }
}
