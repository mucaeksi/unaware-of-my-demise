#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Scripting;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Platform
{
    [Serializable, Preserve]
    public sealed class GoogleIdTokenResultDto
    {
        public string idToken = string.Empty;
    }

    [Serializable, Preserve]
    public sealed class PlayPurchaseDto
    {
        public string productId = string.Empty;
        public string purchaseToken = string.Empty;
        public string state = "purchased";
    }

    [Serializable, Preserve]
    public sealed class OwnedPurchasesEnvelopeDto
    {
        public PlayPurchaseDto[] purchases = Array.Empty<PlayPurchaseDto>();
    }

    [Serializable, Preserve]
    public sealed class ConsentStateDto
    {
        public bool canRequestAds;
        public bool privacyOptionsRequired;
        public string status = "UNKNOWN";
        public bool underAgeOfConsent;
        public bool childDirected;
        public string maxAdContentRating = "T";
    }

    [Serializable, Preserve]
    public sealed class RewardedAdResultDto
    {
        public bool earned;
    }

    public interface IUomdPlatformBridge
    {
        bool IsNativeAndroid { get; }
        SessionDto? ReadSecureSession();
        bool WriteSecureSession(SessionDto session);
        void ClearSecureSession();
        Awaitable<string> SignInWithGoogleAsync(string serverClientId, CancellationToken ct = default);
        Awaitable SignOutGoogleAsync(CancellationToken ct = default);
        Awaitable<PlayPurchaseDto> PurchaseProductAsync(string productId, string type, string accountTag, string? offerToken = null, CancellationToken ct = default);
        Awaitable<PlayPurchaseDto[]> QueryOwnedPurchasesAsync(CancellationToken ct = default);
        Awaitable<ConsentStateDto> InitAdsConsentAsync(bool underAgeOfConsent = false, CancellationToken ct = default);
        Awaitable<bool> ShowRewardedAdAsync(string adUnitId, string userId, string customData, CancellationToken ct = default);
        void RestartApplication();
    }

    /// <summary>
    /// Unity 6 Android IL2CPP JNI bridge calling UomdGoogleSignInBridge, UomdBillingBridge,
    /// UomdAdsBridge, and UomdAppBridge in Assets/Plugins/Android/io/github/mucaeksi/unawareofmydemise/.
    /// Always disposes AndroidJavaClass / AndroidJavaObject local references and marshals callbacks
    /// back onto the Unity main thread via Awaitable.MainThreadAsync().
    /// </summary>
    public sealed class UomdAndroidJniBridge : IUomdPlatformBridge
    {
        private const string PackagePrefix = "io.github.mucaeksi.unawareofmydemise";
        private const string SignInClass = PackagePrefix + ".UomdGoogleSignInBridge";
        private const string BillingClass = PackagePrefix + ".UomdBillingBridge";
        private const string AdsClass = PackagePrefix + ".UomdAdsBridge";
        private const string AppClass = PackagePrefix + ".UomdAppBridge";

        public bool IsNativeAndroid => Application.platform == RuntimePlatform.Android;

        private sealed class JniCallbackProxy : AndroidJavaProxy
        {
            private readonly TaskCompletionSource<string> _tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);

            public JniCallbackProxy() : base(PackagePrefix + ".UomdUnityCallback") { }

            public Task<string> Task => _tcs.Task;

            // Invoked from Java on Binder / UI thread
            public void onSuccess(string jsonPayload)
            {
                _tcs.TrySetResult(jsonPayload ?? "{}");
            }

            // Invoked from Java on Binder / UI thread
            public void onError(string code, string message)
            {
                _tcs.TrySetException(new UomdApiException(400, code ?? "native_error", message ?? "Native plugin call failed"));
            }
        }

        private static AndroidJavaObject GetCurrentActivity()
        {
            using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
            return unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
        }

        public SessionDto? ReadSecureSession()
        {
            if (!IsNativeAndroid) return null;
            using var activity = GetCurrentActivity();
            using var bridge = new AndroidJavaClass(SignInClass);
            string json = bridge.CallStatic<string>("readSessionJson", activity);
            if (string.IsNullOrEmpty(json) || json == "{}") return null;
            var dto = JsonUtility.FromJson<SessionDto>(json);
            if (dto is null || string.IsNullOrEmpty(dto.token) || string.IsNullOrEmpty(dto.expiresAt)) return null;
            return dto;
        }

        public bool WriteSecureSession(SessionDto session)
        {
            if (!IsNativeAndroid) return false;
            using var activity = GetCurrentActivity();
            using var bridge = new AndroidJavaClass(SignInClass);
            return bridge.CallStatic<bool>("writeSessionJson", activity, session.token, session.expiresAt, session.playerId ?? string.Empty);
        }

        public void ClearSecureSession()
        {
            if (!IsNativeAndroid) return;
            using var activity = GetCurrentActivity();
            using var bridge = new AndroidJavaClass(SignInClass);
            bridge.CallStatic("clearSession", activity);
        }

        public async Awaitable<string> SignInWithGoogleAsync(string serverClientId, CancellationToken ct = default)
        {
            var proxy = new JniCallbackProxy();
            using (var activity = GetCurrentActivity())
            using (var bridge = new AndroidJavaClass(SignInClass))
            {
                bridge.CallStatic("signIn", activity, serverClientId, proxy);
            }
            string json = await proxy.Task;
            await Awaitable.MainThreadAsync();
            ct.ThrowIfCancellationRequested();
            var parsed = JsonUtility.FromJson<GoogleIdTokenResultDto>(json);
            if (parsed is null || string.IsNullOrEmpty(parsed.idToken))
            {
                throw new UomdApiException(400, "bad_token", "Google ID token was empty");
            }
            return parsed.idToken;
        }

        public async Awaitable SignOutGoogleAsync(CancellationToken ct = default)
        {
            var proxy = new JniCallbackProxy();
            using (var activity = GetCurrentActivity())
            using (var bridge = new AndroidJavaClass(SignInClass))
            {
                bridge.CallStatic("signOut", activity, proxy);
            }
            await proxy.Task;
            await Awaitable.MainThreadAsync();
            ct.ThrowIfCancellationRequested();
        }

        public async Awaitable<PlayPurchaseDto> PurchaseProductAsync(
            string productId,
            string type,
            string accountTag,
            string? offerToken = null,
            CancellationToken ct = default)
        {
            var proxy = new JniCallbackProxy();
            using (var activity = GetCurrentActivity())
            using (var bridge = new AndroidJavaClass(BillingClass))
            {
                bridge.CallStatic("purchase", activity, productId, type, accountTag, offerToken ?? string.Empty, proxy);
            }
            string json = await proxy.Task;
            await Awaitable.MainThreadAsync();
            ct.ThrowIfCancellationRequested();
            var parsed = JsonUtility.FromJson<PlayPurchaseDto>(json);
            if (parsed is null || string.IsNullOrEmpty(parsed.purchaseToken))
            {
                throw new UomdApiException(400, "purchase_failed", "Purchase token missing");
            }
            return parsed;
        }

        public async Awaitable<PlayPurchaseDto[]> QueryOwnedPurchasesAsync(CancellationToken ct = default)
        {
            var proxy = new JniCallbackProxy();
            using (var activity = GetCurrentActivity())
            using (var bridge = new AndroidJavaClass(BillingClass))
            {
                bridge.CallStatic("queryOwnedPurchases", activity, proxy);
            }
            string json = await proxy.Task;
            await Awaitable.MainThreadAsync();
            ct.ThrowIfCancellationRequested();
            var env = JsonUtility.FromJson<OwnedPurchasesEnvelopeDto>(json);
            return env?.purchases ?? Array.Empty<PlayPurchaseDto>();
        }

        public async Awaitable<ConsentStateDto> InitAdsConsentAsync(bool underAgeOfConsent = false, CancellationToken ct = default)
        {
            var proxy = new JniCallbackProxy();
            using (var activity = GetCurrentActivity())
            using (var bridge = new AndroidJavaClass(AdsClass))
            {
                bridge.CallStatic("initConsent", activity, underAgeOfConsent, proxy);
            }
            string json = await proxy.Task;
            await Awaitable.MainThreadAsync();
            ct.ThrowIfCancellationRequested();
            return JsonUtility.FromJson<ConsentStateDto>(json) ?? new ConsentStateDto();
        }

        public async Awaitable<bool> ShowRewardedAdAsync(string adUnitId, string userId, string customData, CancellationToken ct = default)
        {
            var proxy = new JniCallbackProxy();
            using (var activity = GetCurrentActivity())
            using (var bridge = new AndroidJavaClass(AdsClass))
            {
                bridge.CallStatic("showRewardedAd", activity, adUnitId, userId, customData, proxy);
            }
            string json = await proxy.Task;
            await Awaitable.MainThreadAsync();
            ct.ThrowIfCancellationRequested();
            var res = JsonUtility.FromJson<RewardedAdResultDto>(json);
            return res is not null && res.earned;
        }

        public void RestartApplication()
        {
            if (!IsNativeAndroid) return;
            using var activity = GetCurrentActivity();
            using var bridge = new AndroidJavaClass(AppClass);
            bridge.CallStatic<bool>("restartApp", activity);
        }
    }

    /// <summary>
    /// Safe Editor / Desktop fallback implementation of IUomdPlatformBridge using PlayerPrefs for local testing.
    /// </summary>
    public sealed class UomdEditorMockBridge : IUomdPlatformBridge
    {
        private const string PrefKey = "uomd.editor_session.v1";

        public bool IsNativeAndroid => false;

        public SessionDto? ReadSecureSession()
        {
            string raw = PlayerPrefs.GetString(PrefKey, string.Empty);
            if (string.IsNullOrEmpty(raw)) return null;
            return JsonUtility.FromJson<SessionDto>(raw);
        }

        public bool WriteSecureSession(SessionDto session)
        {
            PlayerPrefs.SetString(PrefKey, JsonUtility.ToJson(session));
            PlayerPrefs.Save();
            return true;
        }

        public void ClearSecureSession()
        {
            PlayerPrefs.DeleteKey(PrefKey);
            PlayerPrefs.Save();
        }

        public async Awaitable<string> SignInWithGoogleAsync(string serverClientId, CancellationToken ct = default)
        {
            await Awaitable.NextFrameAsync(ct);
            throw new UomdApiException(400, "not_supported_in_editor", "Google CredentialManager requires an Android device build");
        }

        public async Awaitable SignOutGoogleAsync(CancellationToken ct = default)
        {
            ClearSecureSession();
            await Awaitable.NextFrameAsync(ct);
        }

        public async Awaitable<PlayPurchaseDto> PurchaseProductAsync(string productId, string type, string accountTag, string? offerToken = null, CancellationToken ct = default)
        {
            await Awaitable.NextFrameAsync(ct);
            throw new UomdApiException(400, "billing_unavailable", "Google Play Billing requires an Android device build");
        }

        public async Awaitable<PlayPurchaseDto[]> QueryOwnedPurchasesAsync(CancellationToken ct = default)
        {
            await Awaitable.NextFrameAsync(ct);
            return Array.Empty<PlayPurchaseDto>();
        }

        public async Awaitable<ConsentStateDto> InitAdsConsentAsync(bool underAgeOfConsent = false, CancellationToken ct = default)
        {
            await Awaitable.NextFrameAsync(ct);
            return new ConsentStateDto { canRequestAds = false, status = "NOT_REQUIRED" };
        }

        public async Awaitable<bool> ShowRewardedAdAsync(string adUnitId, string userId, string customData, CancellationToken ct = default)
        {
            await Awaitable.NextFrameAsync(ct);
            return false;
        }

        public void RestartApplication()
        {
            UnityEngine.SceneManagement.SceneManager.LoadScene(0);
        }
    }
}
