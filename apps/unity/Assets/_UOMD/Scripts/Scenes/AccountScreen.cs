#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Platform;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// The account (port of AccountScene.ts): Google sign-in, cloud save, data export, sign-out, account deletion with a
    /// two-tap confirm, privacy options and SETTINGS (the TitleScene settings panel subset the Unity client supports).
    /// </summary>
    public sealed class AccountScreen : UomdHubScreen
    {
        private const int DeleteConfirmMs = 6000;
        private string? _confirmDeleteFor;
        private int _confirmDeleteRevision = -1;

        public AccountScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Account;
        protected override string Heading => "ACCOUNT";
        protected override bool NeedsSignIn => false;

        public override void OnExit()
        {
            base.OnExit();
            _confirmDeleteFor = null;
        }

        protected override async Awaitable BuildAsync(int generation)
        {
            var api = Router.Api;
            if (!api.IsSignedIn)
            {
                Centered(Text(RefW / 2f, 330f, "Your account is a Google account. Progress, rolls and purchases are bound to it and survive a reinstall.", 36, UomdThemeTokens.TextPrimary, 0.5f, 0.5f, wrapWidth: 1400f));
                bool canSignIn = Router.PlatformBridge.IsNativeAndroid;
                var signIn = Button(RefW / 2f, 520f, "SIGN IN WITH GOOGLE", null, 760, 140, 36, UomdPanelVariant.Hot, () => _ = SignInAsync());
                UomdScreenKit.SetEnabled(signIn, canSignIn, UomdPanelVariant.Hot);
                if (!canSignIn) Text(RefW / 2f, 650f, "Google sign-in requires the Android app.", 32, UomdThemeTokens.TextDim, 0.5f, 0.5f);
                Button(RefW / 2f - 480f, 790f, "PRIVACY OPTIONS (ADS)", null, 460, 110, 24, UomdPanelVariant.Normal, OpenPrivacyOptions);
                Button(RefW / 2f, 790f, "PRIVACY & DELETE URL", null, 460, 110, 24, UomdPanelVariant.Normal, OpenPrivacyPolicy);
                Button(RefW / 2f + 480f, 790f, "SETTINGS", null, 460, 110, 28, UomdPanelVariant.Normal, OpenSettings);
                return;
            }
            var me = await api.GetJsonAsync("/api/v1/me");
            var save = await api.GetJsonAsync("/api/v1/save");
            if (!IsCurrent(generation)) return;
            string meId = JsonRead.Str(me, "id");
            Button(300f, 195f, "PURCHASES", null, 460, 100, 32, UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(UomdScreenId.Purchases));
            Button(RefW - 300f, 195f, "SAVED ACTIONS", null, 460, 100, 32, UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(UomdScreenId.Operations));
            Fit(Text(RefW / 2f, 280f, JsonRead.Str(me, "displayName", "Wayfarer") is { Length: > 0 } name ? name : "Wayfarer", 52, UomdThemeTokens.Gold, 0.5f, 0.5f), 1000f);
            Text(RefW / 2f, 350f, $"Player {meId}", 26, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            long version = JsonRead.Int(save, "version");
            Text(RefW / 2f, 470f, version == 0 ? "No cloud save yet." : $"Cloud save v{version} · {JsonRead.Str(save, "updatedAt")}", 34, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            var cloud = JsonRead.Obj(save, "data");
            Button(RefW / 2f - 330f, 590f, "UPLOAD SAVE", null, 600, 110, 32, UomdPanelVariant.Normal, () => _ = UploadAsync(version, cloud));
            var download = Button(RefW / 2f + 330f, 590f, "DOWNLOAD SAVE", null, 600, 110, 32, UomdPanelVariant.Normal, () => _ = DownloadAsync());
            UomdScreenKit.SetEnabled(download, version > 0);
            Button(RefW / 2f - 330f, 730f, "EXPORT MY DATA", null, 600, 110, 32, UomdPanelVariant.Normal, () => _ = ExportAsync());
            Button(RefW / 2f + 330f, 730f, "SIGN OUT", null, 600, 110, 32, UomdPanelVariant.Normal, () => _ = SignOutAsync());
            Button(RefW / 2f - 460f, 1010f, "PRIVACY OPTIONS (ADS)", null, 430, 96, 22, UomdPanelVariant.Normal, OpenPrivacyOptions);
            Button(RefW / 2f, 1010f, "PRIVACY NOTICE", null, 430, 96, 22, UomdPanelVariant.Normal, OpenPrivacyPolicy);
            Button(RefW / 2f + 460f, 1010f, "SETTINGS", null, 430, 96, 24, UomdPanelVariant.Normal, OpenSettings);
            bool confirming = _confirmDeleteFor == meId && _confirmDeleteRevision == api.AuthRevision;
            Button(RefW / 2f, 880f, confirming ? "TAP AGAIN TO DELETE FOREVER" : "DELETE ACCOUNT", confirming ? "progress, wallet and roster cannot be restored" : null,
                900, 130, 32, UomdPanelVariant.Danger, () => _ = DeleteAccountAsync(meId));
        }

        private static Label Centered(Label label)
        {
            label.style.unityTextAlign = TextAnchor.MiddleCenter;
            return label;
        }

        private void OpenPrivacyOptions() => _ = PrivacyOptionsAsync();

        private async Awaitable PrivacyOptionsAsync()
        {
            try
            {
                await Router.PlatformBridge.ShowPrivacyOptionsFormAsync();
                Say("Privacy choice updated");
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        private void OpenPrivacyPolicy()
        {
            Application.OpenURL($"{Router.Api.BaseUrl}/privacy");
            Say("Privacy notice & web deletion portal opened");
        }

        private async Awaitable SignInAsync()
        {
            try
            {
                string token = await Router.PlatformBridge.SignInWithGoogleAsync(UomdPlatformBridgeFactory.GoogleWebClientId);
                if (string.IsNullOrEmpty(token)) return;
                var player = await Router.Api.SignInWithGoogleIdTokenAsync(token);
                Say(player.isNew ? "Welcome, wayfarer. Your company awaits." : "Welcome back.");
                await RefreshAsync();
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        private async Awaitable ExportAsync()
        {
            try
            {
                var data = await Router.Api.GetJsonAsync("/api/v1/account/export");
                string file = Path.Combine(Application.persistentDataPath, "unaware-of-my-demise-data.json");
                await File.WriteAllTextAsync(file, CanonicalJson.Serialize(data));
                Say("Your data was saved as a file in the game's folder");
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        private async Awaitable DeleteAccountAsync(string expectedPlayer)
        {
            var api = Router.Api;
            int revision = api.AuthRevision;
            try
            {
                var current = await api.GetJsonAsync("/api/v1/me");
                if (revision != api.AuthRevision || JsonRead.Str(current, "id") != expectedPlayer) throw new UomdApiException(409, "auth_changed", "The selected account changed");
                if (_confirmDeleteFor != expectedPlayer || _confirmDeleteRevision != revision)
                {
                    _confirmDeleteFor = expectedPlayer;
                    _confirmDeleteRevision = revision;
                    UomdScreenKit.After(Stage, DeleteConfirmMs, () =>
                    {
                        if (_confirmDeleteFor != expectedPlayer || _confirmDeleteRevision != revision) return;
                        _confirmDeleteFor = null;
                        _ = RefreshAsync();
                    });
                    await RefreshAsync();
                    return;
                }
                await api.SendJsonAsync("POST", "/api/v1/account/delete", new Dictionary<string, object?> { ["confirm"] = "DELETE" }, idempotent: false);
                if (api.AuthRevision != revision) throw new UomdApiException(409, "auth_changed", "The previous account was deleted; the current sign-in was kept");
                await ForgetAsync();
                _confirmDeleteFor = null;
                Say("Your account was deleted");
                await RefreshAsync();
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        private async Awaitable SignOutAsync()
        {
            try
            {
                // the request carries the old bearer; local authority ends whether or not it reaches the server
                try { await Router.Api.SendJsonAsync("POST", "/api/v1/auth/logout", new Dictionary<string, object?>(), idempotent: false); }
                catch (Exception e) { Debug.LogWarning($"[Account] logout request failed: {e.Message}"); }
                await ForgetAsync();
                Say("Signed out");
                await RefreshAsync();
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        /// <summary>Drops the session here and in the Google identity (Services.identity.forget).</summary>
        private async Awaitable ForgetAsync()
        {
            Router.Api.AdoptSession(null);
            try { await Router.PlatformBridge.SignOutGoogleAsync(); }
            catch (Exception e) { Debug.LogWarning($"[Account] Google sign-out failed: {e.Message}"); }
        }

        private async Awaitable UploadAsync(long version, Dictionary<string, object?> cloud)
        {
            try
            {
                // other keys of the cloud save (story continuity, prefs) belong to other features and are kept
                var data = new Dictionary<string, object?>(cloud, StringComparer.Ordinal);
                var progress = new Dictionary<string, object?>(StringComparer.Ordinal);
                foreach (var node in UomdLocalProgress.Load()) progress[node.Key] = new Dictionary<string, object?> { ["stars"] = (long)node.Value };
                data["progress"] = progress;
                await Router.Api.SendJsonAsync("PUT", "/api/v1/save", new Dictionary<string, object?> { ["expectedVersion"] = version, ["data"] = data });
                Say("Saved to the cloud");
            }
            catch (Exception e)
            {
                Say(e is UomdApiException api && api.Code == "save_conflict" ? "The cloud save changed on another device. Download it first." : ErrText(e));
            }
            await RefreshAsync();
        }

        private async Awaitable DownloadAsync()
        {
            try
            {
                var save = await Router.Api.GetJsonAsync("/api/v1/save");
                foreach (var node in JsonRead.Obj(JsonRead.Obj(save, "data"), "progress"))
                    UomdLocalProgress.Complete(node.Key, (int)JsonRead.Int(node.Value, "stars")); // merge: stars only go up
                Say("Cloud progress merged into this device");
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
        }

        // ------------------------------------------------------------------------------- settings

        private void OpenSettings()
        {
            var m = OpenModal(0.86f);
            float cx = RefW / 2f, cy = RefH / 2f;
            Card(cx, cy, 1720f, 1000f, UomdPanelVariant.Normal, m);
            Text(cx, cy - 436f, "SETTINGS", 44, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true, into: m);
            var audio = Router.Audio;
            var session = Router.Session;
            string Pct(float v) => $"{Mathf.RoundToInt(v * 100)}%";
            float Step(float v, float d) => Mathf.Clamp01(Mathf.Round((v + d) * 10f) / 10f);
            var rows = new (string Label, Func<string> Get, Action Dec, Action Inc)[]
            {
                ("Music", () => Pct(audio.BgmVolume), () => audio.BgmVolume = Step(audio.BgmVolume, -0.1f), () => audio.BgmVolume = Step(audio.BgmVolume, 0.1f)),
                ("Effects", () => Pct(audio.SfxVolume), () => { audio.SfxVolume = Step(audio.SfxVolume, -0.1f); audio.PlaySfx("sfx_ui_confirm"); }, () => { audio.SfxVolume = Step(audio.SfxVolume, 0.1f); audio.PlaySfx("sfx_ui_confirm"); }),
                ("Voice", () => Pct(audio.VoiceVolume), () => audio.VoiceVolume = Step(audio.VoiceVolume, -0.1f), () => audio.VoiceVolume = Step(audio.VoiceVolume, 0.1f)),
                ("Reduced motion", () => session.ReducedMotion ? "ON" : "OFF", () => session.ReducedMotion = !session.ReducedMotion, () => session.ReducedMotion = !session.ReducedMotion)
            };
            for (int i = 0; i < rows.Length; i++)
            {
                var row = rows[i];
                float y = cy - 300f + i * 110f;
                Text(cx - 470f, y, row.Label, 40, UomdThemeTokens.TextPrimary, 0f, 0.5f, into: m);
                var value = Text(cx + 190f, y, row.Get(), 36, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true, into: m);
                Button(cx + 30f, y, "−", null, 130, 100, 48, UomdPanelVariant.Normal, () => { row.Dec(); value.text = row.Get(); UomdPrefs.Save(session, audio); }, m);
                Button(cx + 350f, y, "+", null, 130, 100, 48, UomdPanelVariant.Normal, () => { row.Inc(); value.text = row.Get(); UomdPrefs.Save(session, audio); }, m);
            }
            string LayoutTag(string l) => l == "afk_faithful" ? "AFK" : l == "arena_lite" ? "ARENA" : "CURRENT";
            var flash = Button(1600f, cy - 300f, $"FLASH: {(session.ReduceFlash ? "REDUCED" : "NORMAL")}", "Reduce Flash", 340, 96, 22,
                session.ReduceFlash ? UomdPanelVariant.Active : UomdPanelVariant.Normal, () => { }, m);
            flash.clicked += () =>
            {
                session.ReduceFlash = !session.ReduceFlash;
                UomdScreenKit.SetLabel(flash, $"FLASH: {(session.ReduceFlash ? "REDUCED" : "NORMAL")}");
                UomdScreenKit.SetVariant(flash, session.ReduceFlash ? UomdPanelVariant.Active : UomdPanelVariant.Normal);
                UomdPrefs.Save(session, audio);
            };
            var layout = Button(1600f, cy - 190f, $"LAYOUT: {LayoutTag(session.BattleHudLayout)}", "Battle Layout", 340, 96, 22,
                session.BattleHudLayout == "afk_faithful" ? UomdPanelVariant.Active : UomdPanelVariant.Normal, () => { }, m);
            layout.clicked += () =>
            {
                var list = UomdPrefs.BattleLayouts;
                session.BattleHudLayout = list[(Array.IndexOf(list, session.BattleHudLayout) + 1) % list.Length];
                UomdScreenKit.SetLabel(layout, $"LAYOUT: {LayoutTag(session.BattleHudLayout)}");
                UomdScreenKit.SetVariant(layout, session.BattleHudLayout == "afk_faithful" ? UomdPanelVariant.Active : UomdPanelVariant.Normal);
                UomdPrefs.Save(session, audio);
            };
            Button(1600f, cy - 80f, "PRIVACY OPTIONS", "Ad Consent", 340, 96, 22, UomdPanelVariant.Normal, OpenPrivacyOptions, m);
            Button(cx, cy + 400f, "CLOSE", null, 560, 110, 32, UomdPanelVariant.Normal, CloseModal, m);
        }
    }
}
