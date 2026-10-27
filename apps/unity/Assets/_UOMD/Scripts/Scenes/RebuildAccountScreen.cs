using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Platform;

namespace Uomd.Scenes
{
    public class RebuildAccountScreen : RebuildHubScreen
    {
        private string _view = "account", _notice = "", _noticeAccount, _approvedPlayer;
        private int _lifetime, _noticeRevision, _approvedRevision, _approvedVersion;
        private bool _busy;
        private CancellationTokenSource _cancel;
        private Label _message;
        private string _operation = "";
        public RebuildAccountScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Account;
        protected override string Heading => "ACCOUNT";
        protected override void Entered() { ++_lifetime; _cancel = CancellationTokenSource.CreateLinkedTokenSource(Router.destroyCancellationToken); _approvedPlayer = null; }
        protected override void Leaving() { ++_lifetime; _cancel?.Cancel(); _cancel?.Dispose(); _cancel = null; _approvedPlayer = null; }
        protected override void DrawUnavailable() => DrawContent(null);
        private bool Native
        {
            get
            {
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active) return Router.HubReview != null;
#endif
                return Router.PlatformBridge.IsNativeAndroid;
            }
        }
#if UNITY_EDITOR
        public bool ReviewBusy => _busy;
        public string ReviewNotice => _noticeAccount == Router.Api.AccountKey && _noticeRevision == Router.Api.AuthRevision ? _notice : "";
        public string ReviewOperation => _operation;
#endif
        private sealed class Context
        {
            private readonly RebuildAccountScreen _screen;
            private readonly int _lifetime;
            private readonly string _release;
            public string Account, Player;
            public int Revision;
            public readonly CancellationToken Token;
            public Context(RebuildAccountScreen screen)
            { _screen = screen; _lifetime = screen._lifetime; _release = screen.Router.Patch.ActiveReleaseId; Token = screen._cancel.Token; AcceptAuth(); }
            public void Check()
            { CheckView(); if (Account != _screen.Router.Api.AccountKey || Revision != _screen.Router.Api.AuthRevision) throw new OperationCanceledException(); }
            private void CheckView()
            { Token.ThrowIfCancellationRequested(); if (_lifetime != _screen._lifetime || _release != _screen.Router.Patch.ActiveReleaseId) throw new OperationCanceledException(); }
            public void AcceptAuth()
            { CheckView(); Account = _screen.Router.Api.AccountKey; Revision = _screen.Router.Api.AuthRevision; Player = _screen.Router.Api.GetCurrentSessionSnapshot()?.playerId; }
        }
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            if (_noticeAccount != Router.Api.AccountKey || _noticeRevision != Router.Api.AuthRevision) _notice = "";
            if (_approvedRevision != Router.Api.AuthRevision || _approvedVersion != Data.Version || !Data.Fresh) _approvedPlayer = null;
            var aside = Panel(Body, "hub-aside"); Text(aside, "YOUR ACCOUNT", "hub-card-title");
            foreach (string view in new[] { "account", "privacy", "settings" })
            { string selected = view; var tab = Button(aside, view.ToUpperInvariant(), "accountView_" + view, () => { _view = selected; _approvedPlayer = null; Draw(); }); tab.SetEnabled(!_busy); if (_view == view) tab.AddToClassList("hub-selected"); }
            Text(aside, "Progress, companions and purchases belong to your signed-in account.", "hub-copy");
            var main = Panel(Body, "hub-main"); var list = Scroll(main);
            _message = Text(list, _busy ? "Please wait…" : _notice, "hub-copy"); _message.name = "accountNotice";
            if (_view == "settings") { Settings(list); return; }
            if (_view == "privacy") { Privacy(list); return; }
            if (!Router.Api.IsSignedIn)
            {
                Text(list, "Sign in with your Google account to load your company and cloud copy.", "hub-copy");
                var signIn = Button(list, "SIGN IN WITH GOOGLE", "accountSignIn", () => _ = Run("sign_in", SignIn), "hub-primary"); signIn.SetEnabled(Native && !_busy);
                if (!Native) Text(list, "Google sign-in requires the Android app.", "hub-copy"); return;
            }
            Text(list, snapshot?.SignedIn == true ? snapshot.DisplayName : "Account data unavailable", "hub-card-title");
            if (snapshot?.SignedIn == true) Text(list, "Player " + snapshot.PlayerId, "hub-small");
            if (_approvedPlayer == snapshot?.PlayerId && _approvedPlayer != null)
            {
                Text(list, "DELETE THIS ACCOUNT PERMANENTLY?", "hub-card-title");
                Text(list, "Progress, wallet and roster cannot be restored. Review retention details in the privacy notice.", "hub-copy");
                string player = _approvedPlayer; var confirm = Button(list, "DELETE FOREVER", "accountDeleteConfirm", () => { _approvedPlayer = null; _ = Run("delete", c => Delete(c, player)); }, "account-danger"); confirm.SetEnabled(CanWrite && !_busy);
                Button(list, "KEEP ACCOUNT", "accountDeleteCancel", () => { _approvedPlayer = null; Draw(); }).SetEnabled(!_busy);
                return;
            }
            var cloud = snapshot?.Cloud;
            Text(list, cloud == null ? "Refresh to load the cloud copy." : cloud.Version == 0 ? "No cloud save yet." : "Cloud copy v" + cloud.Version + " · " + cloud.UpdatedAt, "hub-copy");
            Text(list, "Cloud copies merge device stars. Account rewards and battle progress stay on the server.", "hub-small");
            var upload = Button(list, "UPLOAD SAVE", "accountUpload", () => _ = Run("upload", Upload)); upload.SetEnabled(CanWrite && !_busy && cloud != null);
            var download = Button(list, "DOWNLOAD SAVE", "accountDownload", () => _ = Run("download", Download)); download.SetEnabled(Data.Fresh && !_busy && cloud?.Version > 0);
            var export = Button(list, "EXPORT MY DATA", "accountExport", () => _ = Run("export", Export)); export.SetEnabled(Data.Fresh && !_busy);
            var signOut = Button(list, "SIGN OUT", "accountSignOut", () => _ = Run("sign_out", SignOut)); signOut.SetEnabled(!_busy);
            var actions = Button(list, "SAVED ACTIONS", "accountActions", () => Navigate(UomdScreenId.Operations)); actions.SetEnabled(!_busy);
            Button(list, "PURCHASES", "accountPurchases", () => Navigate(UomdScreenId.Purchases)).SetEnabled(!_busy);
            var delete = Button(list, "DELETE ACCOUNT…", "accountDeleteReview", () => { _approvedPlayer = snapshot.PlayerId; _approvedRevision = Router.Api.AuthRevision; _approvedVersion = Data.Version; Draw(); }, "account-danger"); delete.SetEnabled(CanWrite && !_busy && snapshot?.SignedIn == true);
        }
        private void Privacy(VisualElement list)
        {
            Text(list, "PRIVACY", "hub-card-title");
            Text(list, "Review the privacy notice, manage advertising choices or open the web account deletion page.", "hub-copy");
            var options = Button(list, "PRIVACY OPTIONS (ADS)", "accountPrivacyOptions", () => _ = Run("privacy_options", async c => { await NativeAction("privacy", c); c.Check(); Message(c, "Privacy options closed."); })); options.SetEnabled(Native && !_busy);
            if (!Native) Text(list, "Advertising privacy options require the Android app.", "hub-copy");
            Button(list, "PRIVACY NOTICE", "accountPrivacyNotice", () => OpenPage(false)).SetEnabled(!_busy);
            Button(list, "WEB ACCOUNT DELETION", "accountDeletionPage", () => OpenPage(true)).SetEnabled(!_busy);
        }
        private void OpenPage(bool deletion)
        {
            try
            {
                string url = UomdCloudCopy.PrivacyUrl(Router.Api.BaseUrl, deletion);
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active) { Router.HubReview.AccountOpenedUrl = url; return; }
#endif
                Application.OpenURL(url);
            }
            catch (Exception) { LocalMessage("The privacy page could not be opened."); }
        }
        private void Settings(VisualElement list)
        {
            Text(list, "SETTINGS", "hub-card-title"); var audio = Router.Audio; var session = Router.Session;
            foreach (var item in new[] { ("music", "Music"), ("effects", "Effects"), ("voice", "Voice") })
            {
                string id = item.Item1; var row = new VisualElement(); row.style.flexDirection = FlexDirection.Row; row.style.flexShrink = 0; list.Add(row);
                var value = Text(row, "", "hub-copy"); value.style.flexGrow = 1;
                float Get() => id == "music" ? audio.BgmVolume : id == "effects" ? audio.SfxVolume : audio.VoiceVolume;
                void Set(float v) { v = Mathf.Clamp01(Mathf.Round(v * 10) / 10); if (id == "music") audio.BgmVolume = v; else if (id == "effects") audio.SfxVolume = v; else audio.VoiceVolume = v; value.text = item.Item2 + " · " + Mathf.RoundToInt(Get() * 100) + "%"; }
                Set(Get()); Button(row, "−", "accountVolumeMinus_" + id, () => Preference(() => Set(Get() - .1f))).SetEnabled(!_busy); Button(row, "+", "accountVolumePlus_" + id, () => Preference(() => Set(Get() + .1f))).SetEnabled(!_busy);
            }
            void Toggle(string id, string label, Func<bool> get, Action change)
            { Button button = null; button = Button(list, label + ": " + (get() ? "ON" : "OFF"), "accountSetting_" + id, () => Preference(() => { change(); button.text = label + ": " + (get() ? "ON" : "OFF"); })); button.SetEnabled(!_busy); }
            Toggle("muted", "Mute audio", () => audio.Muted, () => audio.Muted = !audio.Muted);
            Toggle("motion", "Reduced motion", () => session.ReducedMotion, () => session.ReducedMotion = !session.ReducedMotion);
            Toggle("flash", "Reduced flash", () => session.ReduceFlash, () => session.ReduceFlash = !session.ReduceFlash);
            Button layout = null; string Layout() => "Battle layout: " + session.BattleHudLayout.Replace('_', ' ');
            layout = Button(list, Layout(), "accountSetting_layout", () => Preference(() => { var values = UomdPrefs.BattleLayouts; session.BattleHudLayout = values[(Array.IndexOf(values, session.BattleHudLayout) + 1) % values.Length]; layout.text = Layout(); })); layout.SetEnabled(!_busy);
        }
        private void Preference(Action change)
        { try { change(); UomdPrefs.Save(Router.Session, Router.Audio); LocalMessage("Preferences applied on this device."); } catch (Exception) { LocalMessage("Preferences applied for this session; saving failed."); } }
        private void LocalMessage(string text)
        { _notice = text; _noticeAccount = Router.Api.AccountKey; _noticeRevision = Router.Api.AuthRevision; if (_message != null) _message.text = text; }
        private void Message(Context c, string text) { c.Check(); LocalMessage(text); }
        private async Awaitable Run(string kind, Func<Context, Awaitable> operation)
        {
            if (_busy || _cancel == null) return;
            var c = new Context(this); _busy = true; _operation = kind; _notice = ""; Data.Touch();
            try { await operation(c); }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                try
                {
                    c.Check();
                    string message = e is UomdApiException api && api.Code == "save_conflict" ? "Cloud copy changed. Refresh and review it before uploading again."
                        : kind == "delete" ? "Deletion is not confirmed. Sign in or use the web deletion page to check."
                        : kind == "upload" ? "Upload is not confirmed. Refresh and review the cloud copy before trying again."
                        : kind == "export" ? "Data export was not saved. Check your connection and device storage, then retry."
                        : kind == "sign_in" ? "Sign-in was not completed. Try again when connected."
                        : kind == "privacy_options" ? "Privacy options could not be opened. Try again in the Android app."
                        : "The action could not be completed. Refresh and retry.";
                    Message(c, message); if (kind == "upload" || kind == "delete") Data.Invalidate();
                }
                catch (OperationCanceledException) { }
            }
            finally { _busy = false; Data.Touch(); }
        }
        private async Awaitable<Dictionary<string, object>> Read(string path, Context c)
        {
            c.Check(); Dictionary<string, object> result;
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) result = await Router.HubReview.AccountRead(path); else
#endif
            result = await Router.Api.GetJsonAsync(path, ct: c.Token);
            c.Check(); return result;
        }
        private async Awaitable<Dictionary<string, object>> Send(string method, string path, Dictionary<string, object> body, Context c)
        {
            c.Check(); Dictionary<string, object> result;
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) result = await Router.HubReview.AccountSend(method, path, body); else
#endif
            result = await Router.Api.SendJsonAsync(method, path, body, idempotent: false, ct: c.Token);
            c.Check(); return result;
        }
        private Dictionary<string, int> LocalProgress()
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) return new Dictionary<string, int>(Router.HubReview.AccountLocal);
#endif
            return UomdLocalProgress.Load();
        }
        private async Awaitable Upload(Context c)
        {
            if (!CanWrite) return; var cloud = Data.Snapshot.Cloud; var body = cloud.Upload(LocalProgress());
            try { await Send("PUT", "/api/v1/save", body, c); }
            catch (UomdApiException e) when (e.Code != "save_conflict" && (e.Status == 0 || e.Status >= 500)) { c.Check(); }
            var actual = UomdCloudCopy.Parse(await Read("/api/v1/save", c));
            if (actual.Version != cloud.Version + 1 || CanonicalJson.Serialize(actual.Data) != CanonicalJson.Serialize(body["data"])) throw new InvalidDataException("Cloud readback differs.");
            await Data.RefreshAsync(); c.Check(); Message(c, "Cloud copy verified after upload.");
        }
        private async Awaitable Download(Context c)
        {
            var cloud = UomdCloudCopy.Parse(await Read("/api/v1/save", c)); c.Check();
            if (cloud.Version == 0) { Message(c, "No cloud save yet."); return; }
            foreach (var node in cloud.Progress())
            {
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active) { var local = Router.HubReview.AccountLocal; local[node.Key] = Math.Max(local.TryGetValue(node.Key, out int old) ? old : 0, node.Value); continue; }
#endif
                UomdLocalProgress.Complete(node.Key, node.Value);
            }
            Message(c, "Cloud stars merged into this device. Account progress is unchanged.");
        }
        private async Awaitable Export(Context c)
        {
            var data = await Read("/api/v1/account/export", c); UomdCloudCopy.VerifyExport(data, c.Player); string json = CanonicalJson.Serialize(data); c.Check();
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) { Router.HubReview.AccountExport(json); Message(c, "REVIEW FIXTURE · Export captured in memory; no device file written."); return; }
#endif
            string name = await UomdCloudCopy.StoreExportAsync(Application.persistentDataPath, c.Account, json, c.Check, c.Token);
            Message(c, "Saved in the game's folder: " + name);
        }
        private async Awaitable Delete(Context c, string approvedPlayer)
        {
            if (!CanWrite || c.Player != approvedPlayer) return;
            var me = await Read("/api/v1/me", c); if (JsonRead.Str(me, "id") != approvedPlayer) throw new InvalidDataException("Account changed.");
            var result = await Send("POST", "/api/v1/account/delete", new Dictionary<string, object> { ["confirm"] = "DELETE" }, c);
            if (!JsonRead.Bool(result, "deleted") || JsonRead.Str(result, "playerId") != approvedPlayer) throw new InvalidDataException("Deletion not confirmed.");
            c.Check(); Router.Api.AdoptSession(null); c.AcceptAuth();
            try { await NativeAction("sign_out", c); } catch (Exception) { c.Check(); }
            Message(c, "Your account deletion was confirmed."); await Data.RefreshAsync();
        }
        private async Awaitable SignOut(Context c)
        {
            // Start revocation with the old bearer, then end local authority before waiting for the network.
            var pending = Send("POST", "/api/v1/auth/logout", new Dictionary<string, object>(), c);
            c.Check(); Router.Api.AdoptSession(null); c.AcceptAuth();
            try { await pending; } catch (Exception) { c.Check(); }
            string message = "Signed out on this device.";
            try { await NativeAction("sign_out", c); } catch (Exception) { c.Check(); message = "Signed out here; Google sign-out could not be confirmed."; }
            Message(c, message); await Data.RefreshAsync();
        }
        private async Awaitable SignIn(Context c)
        {
            string token;
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active)
            {
                await Router.HubReview.AccountNative("sign_in"); c.Check();
                token = "isolated-account-token";
            }
            else
#endif
            {
                token = await Router.PlatformBridge.SignInWithGoogleAsync(UomdPlatformBridgeFactory.GoogleWebClientId, c.Token); c.Check(); if (string.IsNullOrEmpty(token)) return;
            }
            int attempt = Router.Api.AuthRevision + 1; string previousAccount = Router.Api.AccountKey;
            try
            {
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active) await Router.HubReview.AccountExchange(); else
#endif
                await Router.Api.SignInWithGoogleIdTokenAsync(token, c.Token);
                c.AcceptAuth();
            }
            catch
            {
                // The API advances auth revision before exchanging the token; rebind only that exact failed attempt.
                if (Router.Api.AuthRevision == attempt && Router.Api.AccountKey == previousAccount) c.AcceptAuth();
                throw;
            }
            Message(c, "Signed in. Refreshing your account…"); await Data.RefreshAsync();
            Message(c, Data.Fresh ? "Signed in. Account data refreshed." : "Signed in. Refresh account data when connected.");
        }
        private async Awaitable NativeAction(string kind, Context c)
        {
            c.Check();
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) { await Router.HubReview.AccountNative(kind); c.Check(); return; }
#endif
            if (kind == "privacy") await Router.PlatformBridge.ShowPrivacyOptionsFormAsync(c.Token); else await Router.PlatformBridge.SignOutGoogleAsync(c.Token);
            c.Check();
        }
    }
}
