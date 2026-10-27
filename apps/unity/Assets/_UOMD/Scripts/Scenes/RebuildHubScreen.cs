using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>Native hub foundation over read-only account snapshots and the existing screen routes.</summary>
    public abstract class RebuildHubScreen : IUomdScreenController
    {
        protected readonly UomdSceneRouter Router;
        private VisualElement _root, _body, _overlay, _art;
        private Label _status, _player, _wallet, _artNotice;
        private Button _refresh;
        private int _generation, _version = -1;
        private int _renderGeneration, _renderRevision;
        private string _renderAccount, _renderRelease;
        private bool _actionBusy, _artFailed, _artLoaded;
        private string _artPath;
        private int _sweepCount = 1;
        private readonly HashSet<string> _images = new HashSet<string>(StringComparer.Ordinal);
        private readonly Dictionary<string, List<VisualElement>> _portraitTargets = new Dictionary<string, List<VisualElement>>();
        private readonly HashSet<string> _loadingPortraits = new HashSet<string>();
        public abstract UomdScreenId ScreenId { get; }
        protected UomdHubState Data => Router.HubState;
        protected VisualElement Body => _body;
        protected UomdAccountActions Actions => Router.AccountActions;
        protected bool CanWrite => Data.Fresh && Data.Snapshot?.SignedIn == true && !Data.Snapshot.Maintenance && Actions.Current && !Actions.Blocked;
        protected virtual string Heading => ScreenId == UomdScreenId.Home ? "THE COMPANY" : ScreenId == UomdScreenId.Roster ? "YOUR COMPANIONS" : "CHAPTERS";
#if UNITY_EDITOR
        public string[] ReviewImagePaths => _images.ToArray();
        public string ReviewState => Data.Loading ? "loading" : Data.Notice.Length > 0 ? Data.Snapshot == null ? "error" : "stale" : Data.Snapshot?.SignedIn == true ? "ready" : "guest";
#endif
        protected RebuildHubScreen(UomdSceneRouter router) { Router = router; }
        protected virtual void Entered() { }
        public async Awaitable OnEnterAsync(VisualElement host)
        {
            Entered();
            int generation = ++_generation; _version = -1; _actionBusy = false; _images.Clear(); _portraitTargets.Clear(); _loadingPortraits.Clear(); _artLoaded = false; _artPath = null;
            Resources.Load<VisualTreeAsset>("Rebuild/Hub").CloneTree(host);
            _root = host.Q("rebuildHub"); _body = _root.Q("hubBody"); _overlay = _root.Q("hubOverlay"); _art = _root.Q("hubArt");
            _status = _root.Q<Label>("hubStatus"); _player = _root.Q<Label>("hubPlayer"); _wallet = _root.Q<Label>("hubWallet");
            _artNotice = _root.Q<Label>("hubArtNotice"); _refresh = _root.Q<Button>("hubRefresh");
            _root.Q<Label>("hubHeading").text = Heading;
            Bind("hubHome", UomdScreenId.Home); Bind("hubCompany", UomdScreenId.Roster); Bind("hubChapters", UomdScreenId.Chapters); Bind("hubAccount", UomdScreenId.Account);
            _root.Q<Button>("hubBack").clicked += Back;
            _refresh.clicked += Refresh;
            _root.Q<Button>("hubMore").clicked += OpenRoutes;
            _root.Q<Button>("hubClose").clicked += CloseRoutes;
            _root.Q<Button>("hubRecoverAction").clicked += () => { if (_version == Data.Version && _renderAccount == Router.Api.AccountKey && _renderRevision == Router.Api.AuthRevision && _renderRelease == Router.Patch.ActiveReleaseId) _ = Actions.RecoverAsync(); };
            _root.RegisterCallback<GeometryChangedEvent>(Geometry);
            _root.RegisterCallback<KeyDownEvent>(Key);
            _root.Q<Button>(ScreenId == UomdScreenId.Home ? "hubHome" : ScreenId == UomdScreenId.Chapters ? "hubChapters" : "hubCompany").AddToClassList("hub-selected");
            Router.Audio.PlayBgmCue("bgm_main_theme");
            _ = Data.RefreshAsync(); Draw();
            await LoadArtAsync(generation);
        }
        private void Bind(string name, UomdScreenId target) => _root.Q<Button>(name).clicked += () => Navigate(target);
        protected virtual void Navigate(UomdScreenId target)
        {
            if (_actionBusy || Actions.Busy) return;
            if (target == UomdScreenId.Gear && ScreenId != UomdScreenId.Character)
                Router.Session.GearCharacterId = Router.Session.GearSlot = "";
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active && Router.ProductionPreview?.scenario.StartsWith("hub/", StringComparison.Ordinal) == true)
            {
                Router.HubReview.LastRoute = target.ToString();
                if (target != UomdScreenId.Home && target != UomdScreenId.Roster && target != UomdScreenId.Chapters && target != UomdScreenId.Title && target != UomdScreenId.Character && target != UomdScreenId.Team && target != UomdScreenId.Gear && target != UomdScreenId.Operations && target != UomdScreenId.Library && target != UomdScreenId.Recruit && target != UomdScreenId.Tasks)
                { CloseRoutes(); _status.text = "REVIEW FIXTURE · " + target + " route selected. Account actions remain isolated."; return; }
            }
#endif
            _ = Router.NavigateToAsync(target);
        }
        private async Awaitable LoadArtAsync(int generation)
        {
            _artPath = Router.Media.Catalog.Background("sol_hub_shelter");
            var texture = await Router.Media.TextureAsync(_artPath);
            if (generation != _generation || _root == null) return;
            _artFailed = texture == null; _artLoaded = texture != null;
            if (texture != null) { _art.style.backgroundImage = new StyleBackground(texture); _images.Add(_artPath); }
            _artNotice.text = _artFailed ? "The shelter illustration could not be loaded. Retry to load it again." : "";
        }
        private void Refresh() { if (_actionBusy || Actions.Busy || Data.Loading) return; _ = Data.RefreshAsync(); if (_artFailed) _ = LoadArtAsync(_generation); }
        private void Geometry(GeometryChangedEvent e) => _root?.EnableInClassList("hub-compact", e.newRect.width < 1700);
        private void Key(KeyDownEvent e)
        {
            if (e.keyCode != KeyCode.Escape) return;
            Back(); e.StopPropagation();
        }
        protected virtual void Back()
        {
            if (Actions.Busy) return;
            if (!_overlay.ClassListContains("is-hidden")) { CloseRoutes(); return; }
            Navigate(ScreenId == UomdScreenId.Home ? UomdScreenId.Title : UomdScreenId.Home);
        }
        private void OpenRoutes()
        {
            var list = _root.Q<ScrollView>("hubRoutes"); list.Clear();
            foreach (var route in new (string Label, UomdScreenId Target)[] {
                ("SUMMON", UomdScreenId.Summon), ("TEAM", UomdScreenId.Team), ("ARMORY", UomdScreenId.Gear), ("INVITATIONS", UomdScreenId.Recruit),
                ("ERRANDS", UomdScreenId.Tasks), ("DEEDS", UomdScreenId.Deeds), ("TRIALS", UomdScreenId.Trials), ("MAIL", UomdScreenId.Mail),
                ("SHOP", UomdScreenId.Shop), ("PROFILE", UomdScreenId.Profile), ("ARCHIVE", UomdScreenId.Library), ("SAVED ACTIONS", UomdScreenId.Operations),
                ("NOTICES", UomdScreenId.ContentPanel), ("ACCOUNT", UomdScreenId.Account) })
            {
                var target = route.Target;
                Action tap = () => { if (target == UomdScreenId.Recruit) Router.Session.RecruitReturnTo = ScreenId; Navigate(target); };
                Button(list, route.Label, "hubRoute_" + target, tap);
            }
            _overlay.RemoveFromClassList("is-hidden"); _root.Q<Button>("hubClose").Focus();
        }
        protected void CloseRoutes() { _overlay.AddToClassList("is-hidden"); _root.Q<Button>("hubMore").Focus(); }
        protected VisualElement OpenPicker()
        { var list = _root.Q<ScrollView>("hubRoutes"); list.Clear(); _overlay.RemoveFromClassList("is-hidden"); _root.Q<Button>("hubClose").Focus(); return list; }
        protected bool OverlayOpen => !_overlay.ClassListContains("is-hidden");
        public virtual void OnTick(float dt)
        {
            if (!Data.ContextCurrent) _ = Data.RefreshAsync();
            if (_version != Data.Version) Draw();
        }
        protected void Draw()
        {
            if (_root == null) return;
            ++_renderGeneration; _renderAccount = Router.Api.AccountKey; _renderRevision = Router.Api.AuthRevision; _renderRelease = Router.Patch.ActiveReleaseId;
            if (OverlayOpen) CloseRoutes();
            try { Actions.Bind(); } catch (Exception) { _status.text = "Saved actions could not be read. Preserve local data for recovery."; }
            _version = Data.Version; _body.Clear(); _portraitTargets.Clear(); _images.Clear(); if (_artLoaded) _images.Add(_artPath);
            var snapshot = Data.ContextCurrent ? Data.Snapshot : null;
            _player.text = snapshot?.SignedIn == true ? (snapshot.DisplayName.Length > 0 ? snapshot.DisplayName : "Signed in") + " · Level " + snapshot.AccountLevel : Router.Api.IsSignedIn ? Data.Loading ? "Loading account…" : "Account unavailable" : "Guest";
            _wallet.text = snapshot?.Balance == null ? "Bell's Remains  —" : "Bell's Remains  " + snapshot.Balance.Value.ToString("N0", System.Globalization.CultureInfo.InvariantCulture);
            _refresh.SetEnabled(!Data.Loading && !_actionBusy && !Actions.Busy);
            foreach (string id in new[] { "hubBack", "hubHome", "hubCompany", "hubChapters", "hubAccount", "hubMore" }) _root.Q<Button>(id).SetEnabled(!Actions.Busy);
            var recover = _root.Q<Button>("hubRecoverAction");
            recover.style.display = Actions.Current && Actions.Action != null && Actions.Blocked ? DisplayStyle.Flex : DisplayStyle.None;
            recover.SetEnabled(!Actions.Busy && !Data.Loading);
            string status = _actionBusy ? "Opening the selected stage…" : Data.Loading ? snapshot == null ? "Loading account data…" : "Refreshing account data…" : Data.Notice.Length > 0 ? Data.Notice
                : snapshot?.SignedIn == true ? snapshot.Maintenance ? "Server maintenance: stage entry is paused." : "Loaded " + Data.LoadedAtUtc.ToLocalTime().ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture) + " · Refresh to update." : "Sign in to load your company and account progress.";
            _status.text = status;
            if (Actions.Current && Actions.Notice.Length > 0 && (Actions.Blocked || Data.Notice.Length == 0 && !Data.Loading)) _status.text = Actions.Notice;
            if (!Actions.Current && snapshot?.SignedIn == true) _status.text = "Saved actions could not be read. Spending is paused; preserve local data for recovery.";
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) _status.text = "REVIEW FIXTURE · " + _status.text;
#endif
            if (snapshot == null)
            {
                var panel = Panel(_body, "hub-main"); Text(panel, Data.Loading ? "THE ROAD IS WAITING" : "ACCOUNT DATA UNAVAILABLE", "hub-card-title");
                Text(panel, Data.Loading ? "Your account is being loaded." : "Connect and refresh to load your company, balance and chapter progress.", "hub-copy"); return;
            }
            DrawContent(snapshot);
        }
        protected virtual void DrawContent(UomdHubSnapshot snapshot)
        { if (ScreenId == UomdScreenId.Home) Home(snapshot); else if (ScreenId == UomdScreenId.Roster) Company(snapshot); else Chapters(snapshot); }
        private void Home(UomdHubSnapshot snapshot)
        {
            var aside = Panel(_body, "hub-aside"); Text(aside, "CHAPTERS", "hub-small");
            Text(aside, snapshot.NextNode?.Title ?? "Before the Road", "hub-card-title");
            Text(aside, snapshot.SignedIn ? snapshot.Companions.Count + " companions · stages cleared " + snapshot.Nodes.Count(snapshot.Cleared) : "Your story continues beyond the shelter.", "hub-copy");
            Text(aside, snapshot.SignedIn ? TeamText(snapshot) : "Sign in to load your company.", "hub-copy hub-muted");
            Portrait(aside, snapshot);
            Button(aside, "CHAPTERS", "hubContinue", () => { Data.SelectedNode = snapshot.NextNode?.Id ?? ""; Navigate(UomdScreenId.Chapters); }, "hub-primary");
            var main = Panel(_body, "hub-main"); Text(main, "THE COMPANY", "hub-card-title");
            var scroll = Scroll(main); var grid = new VisualElement(); grid.AddToClassList("hub-grid"); scroll.Add(grid);
            foreach (var item in new (string Label, UomdScreenId Target)[] { ("COMPANY", UomdScreenId.Roster), ("TEAM", UomdScreenId.Team), ("SUMMON", UomdScreenId.Summon),
                ("ARCHIVE", UomdScreenId.Library), ("ERRANDS", UomdScreenId.Tasks), ("SAVED ACTIONS", UomdScreenId.Operations) })
            { var target = item.Target; Button(grid, item.Label, "hubShortcut_" + target, () => Navigate(target), "hub-shortcut"); }
        }
        private void Company(UomdHubSnapshot snapshot)
        {
            var aside = Panel(_body, "hub-aside"); Text(aside, "FORMATION", "hub-small"); Text(aside, snapshot.TeamName.Length == 0 ? "YOUR TEAM" : snapshot.TeamName, "hub-card-title");
            Text(aside, snapshot.SignedIn ? TeamText(snapshot) : "Sign in to load your companions and team.", "hub-copy"); Portrait(aside, snapshot);
            Button(aside, "TEAM", "hubTeam", () => Navigate(UomdScreenId.Team)); Button(aside, "ARMORY", "hubArmory", () => Navigate(UomdScreenId.Gear));
            var main = Panel(_body, "hub-main"); Text(main, snapshot.SignedIn ? snapshot.Companions.Count + " COMPANIONS" : "YOUR COMPANIONS", "hub-card-title");
            Button(main, "INVITATIONS", "hubInvitations", () => { Router.Session.RecruitReturnTo = UomdScreenId.Roster; Navigate(UomdScreenId.Recruit); });
            var scroll = Scroll(main); var grid = new VisualElement(); grid.AddToClassList("hub-grid"); scroll.Add(grid);
            if (!snapshot.SignedIn || snapshot.Companions.Count == 0)
            { Text(grid, snapshot.SignedIn ? "No companions yet. Invitations and the altar bring them to the company." : "Sign in to view your company.", "hub-copy"); return; }
            foreach (var member in snapshot.Companions)
            {
                string id = member.Id;
                var card = Button(grid, "", "hubCompanion_" + id, () => { Router.Session.SelectedUnitId = id; Navigate(UomdScreenId.Character); }, "hub-companion");
                card.SetEnabled(member.Available); Text(card, member.Name, "hub-card-title");
                Text(card, member.Available ? "Level " + member.Level : "Unavailable in this release", "hub-copy");
                if (member.Available) Text(card, new string('★', member.Rarity), "hub-small");
                if (member.Available && (id == "fadyme" || id == "mahmut"))
                {
                    card.AddToClassList("hub-has-portrait"); var face = new VisualElement { pickingMode = PickingMode.Ignore }; face.AddToClassList("hub-card-portrait"); card.Add(face);
                    RegisterPortrait(face, Router.Media.Catalog.PortraitImage(id, "sol_composed"));
                }
                if (member.Available) { Text(card, member.Element + " · " + member.Role, "hub-copy hub-muted"); Text(card, "copies " + member.Copies + " · shards " + member.Shards, "hub-small"); }
            }
        }
        private void Chapters(UomdHubSnapshot snapshot)
        {
            var aside = Panel(_body, "hub-aside"); Text(aside, "CHAPTERS", "hub-card-title");
            bool hasHard = snapshot.Nodes.Any(n => n.Hard); if (!hasHard) Data.Hard = false;
            if (hasHard) Button(aside, Data.Hard ? "HARD · SWITCH TO NORMAL" : "NORMAL · SWITCH TO HARD", "hubDifficulty", () => { Data.Hard = !Data.Hard; Data.SelectedNode = ""; Draw(); });
            var chapterList = Scroll(aside);
            var chapters = snapshot.Chapters.Where(c => c.Nodes.Any(n => n.Hard == Data.Hard)).ToList();
            var chapter = chapters.FirstOrDefault(c => c.Nodes.Any(n => n.Id == Data.SelectedNode)) ?? chapters.FirstOrDefault(c => c.Id == Data.SelectedChapter) ?? chapters.FirstOrDefault();
            foreach (var c in chapters)
            {
                string id = c.Id; var button = Button(chapterList, c.Title, "hubChapter_" + id, () => { Data.SelectedChapter = id; Data.SelectedNode = ""; Draw(); }, "hub-row");
                if (c == chapter) button.AddToClassList("hub-selected");
            }
            var main = Panel(_body, "hub-main");
            if (chapter == null) { Text(main, "No chapters are available in this release.", "hub-copy"); return; }
            var nodes = chapter.Nodes.Where(n => n.Hard == Data.Hard).ToList();
            var selected = nodes.FirstOrDefault(n => n.Id == Data.SelectedNode) ?? nodes.FirstOrDefault(n => !snapshot.Cleared(n) && snapshot.Unlocked(n)) ?? nodes[0];
            Data.SelectedChapter = chapter.Id; Data.SelectedNode = selected.Id;
            int max = nodes.Count(n => n.Kind == "battle") * 3, earned = nodes.Where(n => n.Kind == "battle").Sum(snapshot.Stars);
            Text(main, chapter.Title, "hub-card-title"); Text(main, snapshot.SignedIn ? "Chapter stars " + earned + "/" + max + " · Ration " + snapshot.Ration + "/" + snapshot.RationCap : "Sign in to load chapter progress.", "hub-small");
            var list = Scroll(main);
            foreach (var node in nodes)
            {
                var current = node; var row = Button(list, "", "hubNode_" + node.Id, () => { Data.SelectedNode = current.Id; Draw(); }, "hub-row");
                if (node == selected) row.AddToClassList("hub-selected"); Text(row, node.Title, "hub-card-title");
                string state = !snapshot.SignedIn ? "Progress requires sign-in" : !snapshot.Unlocked(node) ? "Locked · finish the previous story step" : snapshot.Cleared(node) ? "Cleared" : "Available";
                Text(row, (node.Kind == "story" ? "Story" : "Battle · " + (node.Cost < 0 ? "Unavailable" : node.Cost == 0 ? "Free practice" : node.Cost + " Ration")) + " · " + state + (snapshot.SignedIn && node.Kind == "battle" ? " · " + new string('★', snapshot.Stars(node)) + new string('☆', 3 - snapshot.Stars(node)) : ""), "hub-copy");
            }
            string reason = !snapshot.SignedIn ? "Sign in to enter this stage." : !Data.Fresh ? "Refresh account data before entering." : snapshot.Maintenance ? "Server maintenance is active."
                : !snapshot.Unlocked(selected) ? "Finish the previous story step first." : selected.Cost < 0 ? "This stage is unavailable in this app version." : snapshot.Ration < selected.Cost ? "Not enough Ration." : selected.Kind == "story" ? "Read this story." : selected.Cost == 0 ? "Free practice · one-time rewards only" : selected.Cost + " Ration · rewards confirmed by your account";
            Text(main, selected.Title + " · " + reason, "hub-small");
            var start = Button(main, snapshot.SignedIn ? selected.Kind == "story" ? "READ STORY" : "START BATTLE" : "SIGN IN", "hubStartStage", () => { if (!snapshot.SignedIn) Navigate(UomdScreenId.Account); else _ = StartStageAsync(selected); }, "hub-primary");
            start.SetEnabled(!_actionBusy && !Actions.Blocked && (!snapshot.SignedIn || Data.Fresh && snapshot.CanStart(selected)));
            if (selected.Kind == "battle" && selected.Cost > 0)
            {
                Text(main, "SWEEP · requires 3 stars · daily remaining " + snapshot.SweepRemaining(selected) + "/" + snapshot.SweepDailyLimit, "hub-small");
                var amounts = new VisualElement { name = "hubSweepCounts" }; amounts.AddToClassList("hub-grid"); amounts.AddToClassList("hub-sweep-counts"); main.Add(amounts);
                foreach (int amount in new[] { 1, 5, 10 })
                {
                    int count = amount; var choose = Button(amounts, "×" + amount, "hubSweepCount_" + amount, () => { _sweepCount = count; Draw(); });
                    choose.SetEnabled(amount <= snapshot.SweepMaxBatch && !Actions.Busy); if (amount == _sweepCount) choose.AddToClassList("hub-selected");
                }
                var repeat = JsonRead.Arr(JsonRead.Get(selected.Definition, "rewards"), "repeat");
                Text(main, "Cost " + ((long)selected.Cost * _sweepCount) + " Ration · " + _sweepCount + " clears · repeat rewards and random drops only (no first-clear rewards).", "hub-small").name = "hubSweepCost";
                if (repeat.Count > 0) Text(main, "Repeat rewards per clear: " + string.Join(" · ", repeat.Select(RewardText)), "hub-small");
                var sweep = Button(main, "SWEEP ×" + _sweepCount, "hubSweep", () => _ = Actions.ExecuteAsync(UomdSavedAction.SweepPath, new Dictionary<string, object> { ["nodeId"] = selected.Id, ["count"] = (long)_sweepCount }, selected.Title + " · Sweep ×" + _sweepCount + " · " + ((long)selected.Cost * _sweepCount) + " Ration"), "hub-primary");
                sweep.SetEnabled(CanWrite && snapshot.CanSweep(selected, _sweepCount));
                if (!snapshot.SweepEnabled) Text(main, "Sweep is currently unavailable.", "hub-small");
            }
        }
        protected static string RewardText(object reward)
        {
            string type = JsonRead.Str(reward, "type");
            if (type == "currency") return JsonRead.Int(reward, "amount") + " Bell's Remains";
            if (type == "account_xp") return JsonRead.Int(reward, "amount") + " Account XP";
            if (type == "item") return JsonRead.Int(reward, "quantity") + " " + JsonRead.Str(reward, "itemId").Replace('_', ' ');
            return JsonRead.Str(reward, type == "gear" ? "gearId" : "itemId").Replace('_', ' ');
        }
        private async Awaitable StartStageAsync(HubNode node)
        {
            if (_actionBusy || Actions.Blocked || !Data.Fresh || Data.Snapshot == null || !Data.Snapshot.CanStart(node)) return;
            int generation = _generation; _actionBusy = true; Draw();
            bool started = await Router.EntryFlow.PlayNodeAsync(node.Id, node.Kind, node.Story, node.Encounter);
            if (generation != _generation || _root == null) return;
            _actionBusy = false; Draw(); if (!started) _status.text = "This stage could not be loaded. Check your account and try again.";
        }
        private string TeamText(UomdHubSnapshot s) => s.Team.Count == 0 ? "No active team. Choose a formation in Team."
            : string.Join("\n", s.Team.Select(id => s.Companions.FirstOrDefault(c => c.Id == id)?.Name ?? "Unavailable companion"));
        private void Portrait(VisualElement into, UomdHubSnapshot snapshot)
        {
            string id = snapshot.Team.Concat(snapshot.Companions.Where(c => c.Available).Select(c => c.Id)).FirstOrDefault(i => i == "fadyme" || i == "mahmut");
            if (id == null) { into.Add(new VisualElement { style = { flexGrow = 1 } }); return; }
            string path = Router.Media.Catalog.PortraitImage(id, "sol_composed");
            if (path == null) return;
            var element = new VisualElement { pickingMode = PickingMode.Ignore }; element.AddToClassList("hub-portrait"); into.Add(element);
            RegisterPortrait(element, path);
        }
        protected void RegisterPortrait(VisualElement element, string path)
        {
            if (path == null) return;
            if (!_portraitTargets.TryGetValue(path, out var targets)) _portraitTargets[path] = targets = new List<VisualElement>();
            targets.Add(element);
            if (_loadingPortraits.Add(path)) _ = LoadPortraitAsync(path, _generation);
        }
        private async Awaitable LoadPortraitAsync(string path, int generation)
        {
            try
            {
                var texture = await Router.Media.TextureAsync(path);
                if (generation != _generation || texture == null || !_portraitTargets.TryGetValue(path, out var targets)) return;
                foreach (var element in targets)
                    if (element.panel != null) { element.style.backgroundImage = new StyleBackground(texture); _images.Add(path); }
            }
            finally { if (generation == _generation) _loadingPortraits.Remove(path); }
        }
        protected static VisualElement Panel(VisualElement parent, string extra)
        { var p = new VisualElement(); p.AddToClassList("hub-panel"); p.AddToClassList(extra); parent.Add(p); return p; }
        protected static Label Text(VisualElement parent, string text, string classes)
        { var label = new Label(text) { pickingMode = PickingMode.Ignore }; foreach (string c in classes.Split(' ')) label.AddToClassList(c); parent.Add(label); return label; }
        protected static ScrollView Scroll(VisualElement parent)
        { var scroll = new ScrollView(ScrollViewMode.Vertical) { horizontalScrollerVisibility = ScrollerVisibility.Hidden }; scroll.contentContainer.style.width = Length.Percent(100); scroll.AddToClassList("hub-list"); parent.Add(scroll); return scroll; }
        protected Button Button(VisualElement parent, string text, string name, Action tap, string extra = "")
        {
            int render = _renderGeneration, version = Data.Version, revision = Router.Api.AuthRevision;
            string account = Router.Api.AccountKey, release = Router.Patch.ActiveReleaseId;
            var b = new Button(() => { if (render == _renderGeneration && version == Data.Version && revision == Router.Api.AuthRevision && account == Router.Api.AccountKey && release == Router.Patch.ActiveReleaseId) tap(); }) { name = name, text = text };
            b.AddToClassList("hub-button"); if (extra.Length > 0) b.AddToClassList(extra); parent.Add(b); return b;
        }
        public void OnExit()
        {
            ++_generation; Data.Cancel();
            if (_root != null) { _root.UnregisterCallback<GeometryChangedEvent>(Geometry); _root.UnregisterCallback<KeyDownEvent>(Key); }
            _root = _body = _overlay = _art = null;
        }
    }
}
