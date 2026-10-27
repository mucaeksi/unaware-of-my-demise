using System;
using System.Linq;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    public class RebuildArchiveScreen : RebuildHubScreen
    {
        private string _shelf = "codex", _selected = "", _account = "", _notice = "";
        private bool _opening;
        private int _openingGeneration;
        public RebuildArchiveScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Library;
        protected override string Heading => "THE ARCHIVE";
        protected override void Entered() { ++_openingGeneration; _opening = false; _notice = ""; }
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            if (_account != Router.Api.AccountKey) { _account = Router.Api.AccountKey; _shelf = "codex"; _selected = _notice = ""; }
            var aside = Panel(Body, "hub-aside"); Text(aside, "THE ARCHIVE", "hub-card-title");
            Text(aside, "Only readings unlocked by your account appear here. Companion parts also require ownership and the earlier part.", "hub-copy");
            foreach (var shelf in new[] { (Id: "companion", Label: "COMPANIONS"), (Id: "codex", Label: "CODEX"), (Id: "event", Label: "EVENTS") })
            {
                string id = shelf.Id;
                var tab = Button(aside, shelf.Label, "archiveShelf_" + id, () => { _shelf = id; _selected = ""; _notice = ""; Draw(); });
                if (_shelf == id) tab.AddToClassList("hub-selected"); tab.SetEnabled(!_opening);
            }
            Button(aside, "CHAPTERS", "archiveChapters", () => Navigate(UomdScreenId.Chapters));
            var main = Panel(Body, "hub-main");
            if (!snapshot.SignedIn) { Text(main, "Sign in to load your unlocked readings.", "hub-copy"); Button(main, "SIGN IN", "archiveSignIn", () => Navigate(UomdScreenId.Account)); return; }
            if (snapshot.Library == null) { Text(main, "The Archive is unavailable. Refresh to load your unlocked readings.", "hub-copy"); return; }
            if (_notice.Length > 0) Text(main, _notice, "hub-copy");
            bool pending = Router.EntryFlow.InReading && Router.EntryFlow.ReadingAtEnd && Router.EntryFlow.ReadingIsCurrent;
            if (pending)
            {
                Text(main, "READING COMPLETION PENDING", "hub-card-title");
                Text(main, Router.EntryFlow.ReadingTitle + " · " + Router.EntryFlow.ReadingNotice, "hub-copy");
                var retry = Button(main, "CHECK / RETRY ORIGINAL READING", "archiveRetryCompletion", () => _ = Router.EntryFlow.RetryReadingCompletionAsync(), "hub-primary");
                retry.SetEnabled(!Router.EntryFlow.ReadingBusy && Data.Fresh && !snapshot.Maintenance);
            }
            var cards = snapshot.Library.Cards.Where(c => c.Kind == _shelf).ToList();
            Text(main, cards.Count + " UNLOCKED READINGS", "hub-card-title");
            var list = Scroll(main);
            if (cards.Count == 0) { Text(list, "No readings are unlocked here yet. Continue the main story. Events also follow their published schedule.", "hub-copy"); return; }
            foreach (var card in cards)
            {
                var selected = card;
                var row = Button(list, "", "archiveEntry_" + card.Id, () => { _selected = selected.Id; _notice = ""; Draw(); }, "hub-row");
                Text(row, card.Title, "hub-card-title");
                Text(row, (card.Kind == "companion" ? "Part " + card.Part + " · " : "") + (card.Completed ? "READ · REPLAY" : "READ"), "hub-copy");
                if (_selected == card.Id) row.AddToClassList("hub-selected"); row.SetEnabled(!_opening);
            }
            var choice = cards.FirstOrDefault(c => c.Id == _selected) ?? cards[0]; _selected = choice.Id;
            Text(main, choice.Title + (_opening ? " · Opening your reading…" : choice.Completed ? " · Replay without changing entry or campaign progress." : " · Completion unlocks eligible later parts; reading grants no rewards."), "hub-copy");
            var read = Button(main, choice.Completed ? "REPLAY READING" : "READ", "archiveRead", () => _ = OpenAsync(choice), "hub-primary");
            read.SetEnabled(!_opening && !pending && Data.Fresh && !snapshot.Maintenance);
        }
        private async Awaitable OpenAsync(UomdLibrary.Card card)
        {
            if (_opening || !Data.Fresh || Data.Snapshot?.SignedIn != true || Data.Snapshot.Maintenance || Router.EntryFlow.InReading && Router.EntryFlow.ReadingAtEnd) return;
            int generation = ++_openingGeneration, version = Data.Version, revision = Router.Api.AuthRevision;
            string account = Router.Api.AccountKey, release = Router.Patch.ActiveReleaseId;
            bool Current() => generation == _openingGeneration && Router.ActiveScreenId == ScreenId && Data.Version == version && Data.Fresh
                && Router.Api.AccountKey == account && Router.Api.AuthRevision == revision && Router.Patch.ActiveReleaseId == release;
            _opening = true; _notice = ""; Draw();
            try
            {
                var response = await Router.EntryFlow.ReadArchiveAsync("/api/v1/library/" + Uri.EscapeDataString(card.Id) + "?releaseId=" + Uri.EscapeDataString(release));
                if (!Current()) return;
                var scenes = UomdLibrary.Reading(response, release, card);
                await Router.EntryFlow.PlayReadingAsync(card, scenes, release);
            }
            catch (Exception) { if (Current()) _notice = "This reading could not be opened. Refresh your unlocked readings and try again."; }
            finally { if (generation == _openingGeneration) { _opening = false; if (Router.ActiveScreenId == ScreenId) Draw(); } }
        }
    }
}
