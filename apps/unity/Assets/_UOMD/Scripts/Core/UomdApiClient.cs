#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Threading;
using UnityEngine;
using UnityEngine.Networking;
using Uomd.Contracts;

namespace Uomd.Core
{
    public sealed class UomdApiException : Exception
    {
        public int Status { get; }
        public string Code { get; }

        public UomdApiException(int status, string code, string message) : base(message)
        {
            Status = status;
            Code = code;
        }
    }

    /// <summary>
    /// Unity 6 C# port of apps/game/src/net/api.ts (`GameApi`).
    /// Communicates with the Cloudflare Workers + D1 backend (`apps/api`) over HTTPS JSON using
    /// `UnityWebRequest` and Unity 6 `Awaitable`, preserving Bearer session authority, authVersion
    /// race guards, and idempotency requestIds.
    /// </summary>
    public sealed class UomdApiClient
    {
        private const string EditorPrefsSessionKey = "uomd.session.v1";
        private const int DefaultTimeoutSeconds = 30;

        private readonly string _baseUrl;
        private SessionDto? _session;
        private string? _cachedPlayerId, _cachedPlayerKey;
        private int _authVersion;
        private int _signingInVersion;

        public event Action? OnAuthChanged;

        public UomdApiClient(string baseUrl)
        {
            _baseUrl = baseUrl.TrimEnd('/');
        }

        public int AuthRevision => _authVersion;
        /// <summary>The API origin (privacy notice and web deletion portal live under it).</summary>
        public string BaseUrl => _baseUrl;

        public bool IsSignedIn
        {
            get
            {
                if (_session is null || string.IsNullOrEmpty(_session.token) || string.IsNullOrEmpty(_session.expiresAt))
                    return false;
                return DateTimeOffset.TryParse(_session.expiresAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var exp) && exp > DateTimeOffset.UtcNow;
            }
        }

        public string AccountKey
        {
            get
            {
                if (!IsSignedIn || _session is null) return "guest";
                if (!string.IsNullOrEmpty(_session.playerId))
                {
                    if (_cachedPlayerId != _session.playerId) { _cachedPlayerId = _session.playerId; _cachedPlayerKey = "player:" + _session.playerId; }
                    return _cachedPlayerKey!;
                }
                int len = Math.Min(24, _session.token.Length);
                return $"token:{_session.token.Substring(0, len)}";
            }
        }

        public static string NewRequestId() => Guid.NewGuid().ToString("N");

        public void AdoptSession(SessionDto? session)
        {
            _authVersion++;
            _session = session;
            _cachedPlayerId = _cachedPlayerKey = null;
            _signingInVersion = 0;
            OnAuthChanged?.Invoke();
        }

        public void SetSessionToken(string token)
        {
            AdoptSession(new SessionDto { token = token, expiresAt = DateTimeOffset.UtcNow.AddDays(30).ToString("o") });
        }

        public SessionDto? GetCurrentSessionSnapshot() => _session;

        public async Awaitable<TResponse> CallAsync<TResponse>(
            string method,
            string path,
            string? jsonBody = null,
            bool requireAuth = true,
            int? expectedAuthVersion = null,
            CancellationToken ct = default)
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active)
                throw new UomdApiException(0, "editor_preview", "Network requests are disabled in Production Review.");
#endif
            if (requireAuth && _signingInVersion != 0)
            {
                throw new UomdApiException(409, "auth_changed", "Finish selecting your account before requesting its data");
            }
            if (expectedAuthVersion.HasValue && expectedAuthVersion.Value != _authVersion)
            {
                throw new UomdApiException(409, "auth_changed", "The account changed before this action was sent");
            }

            SessionDto? requestSession = _session;
            int requestAuthVersion = _authVersion;
            string url = $"{_baseUrl}{path}";

            using var req = new UnityWebRequest(url, method);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.timeout = DefaultTimeoutSeconds;

            if (jsonBody is not null)
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(jsonBody);
                req.uploadHandler = new UploadHandlerRaw(bodyBytes);
                req.SetRequestHeader("Content-Type", "application/json");
            }

            if (requireAuth && requestSession is not null && !string.IsNullOrEmpty(requestSession.token))
            {
                req.SetRequestHeader("Authorization", $"Bearer {requestSession.token}");
            }

            var op = req.SendWebRequest();
            while (!op.isDone)
            {
                if (ct.IsCancellationRequested)
                {
                    req.Abort();
                    ct.ThrowIfCancellationRequested();
                }
                await Awaitable.NextFrameAsync(ct);
            }

            string responseText = req.downloadHandler?.text ?? string.Empty;
            long statusCode = req.responseCode;

            if (req.result != UnityWebRequest.Result.Success || statusCode < 200 || statusCode >= 300)
            {
                if (statusCode == 401 && requireAuth && ReferenceEquals(_session, requestSession) && _authVersion == requestAuthVersion)
                {
                    AdoptSession(null);
                }

                string errCode = "http_error";
                string errMsg = string.IsNullOrEmpty(req.error) ? $"HTTP {statusCode}" : req.error;
                if (!string.IsNullOrEmpty(responseText))
                {
                    try
                    {
                        var env = JsonUtility.FromJson<ApiErrorEnvelopeDto>(responseText);
                        if (env is not null)
                        {
                            if (!string.IsNullOrEmpty(env.error)) errCode = env.error!;
                            if (!string.IsNullOrEmpty(env.message)) errMsg = env.message!;
                        }
                    }
                    catch
                    {
                        // Non-JSON error body
                    }
                }
                throw new UomdApiException((int)statusCode, errCode, errMsg);
            }

            if (requireAuth && string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase) && requestAuthVersion != _authVersion)
            {
                throw new UomdApiException(409, "auth_changed", "The account changed before its data arrived");
            }

            if (typeof(TResponse) == typeof(string))
            {
                return (TResponse)(object)responseText;
            }

            TResponse parsed = JsonUtility.FromJson<TResponse>(responseText);
            if (parsed is null)
            {
                throw new UomdApiException(503, "invalid_response", $"Empty or invalid JSON from {path}");
            }
            return parsed;
        }

        // ============================================================================
        // Typed Endpoint Methods (Mirroring apps/game/src/net/api.ts)
        // ============================================================================

        public async Awaitable<PlayerSummaryDto> SignInWithGoogleIdTokenAsync(string idToken, CancellationToken ct = default)
        {
            int attempt = ++_authVersion;
            _signingInVersion = attempt;
            try
            {
                string body = JsonUtility.ToJson(new GoogleAuthRequestDto { idToken = idToken });
                var res = await CallAsync<GoogleAuthResponseDto>("POST", "/api/v1/auth/google", body, requireAuth: false, ct: ct);
                if (_authVersion != attempt)
                {
                    throw new UomdApiException(409, "auth_changed", "The selected account changed before sign-in completed");
                }
                _signingInVersion = 0;
                AdoptSession(new SessionDto
                {
                    token = res.token,
                    expiresAt = res.expiresAt,
                    playerId = res.player.id
                });
                return res.player;
            }
            finally
            {
                if (_signingInVersion == attempt) _signingInVersion = 0;
            }
        }

        public async Awaitable<RefreshSessionResponseDto> RefreshSessionAsync(CancellationToken ct = default)
        {
            int expected = _authVersion;
            var res = await CallAsync<RefreshSessionResponseDto>("POST", "/api/v1/auth/refresh", "{}", requireAuth: true, expectedAuthVersion: expected, ct: ct);
            AdoptSession(new SessionDto
            {
                token = res.token,
                expiresAt = res.expiresAt,
                playerId = res.playerId
            });
            return res;
        }

        /// <summary>
        /// A GET whose JSON body is read with UomdJson (dictionaries, lists, long/double). The hub screens use it so each
        /// endpoint of apps/game/src/net/api.ts does not need its own JsonUtility DTO.
        /// </summary>
        public async Awaitable<Dictionary<string, object?>> GetJsonAsync(string path, bool requireAuth = true, CancellationToken ct = default)
        {
            string text = await CallAsync<string>("GET", path, null, requireAuth, ct: ct);
            return UomdJson.ParseObject(text);
        }

        /// <summary>
        /// A write bound to the current account. <paramref name="idempotent"/> adds a fresh requestId (the server's
        /// idempotency key; api.ts `mutate`); plain writes (api.ts `call`: teams, equip) send the body as is, because their
        /// server schemas are strict. A DELETE sends no body. The TS client also journaled pending idempotent actions across
        /// restarts (net/operations.ts); campaign battles and rebuilt companion/Sweep actions use their durable services.
        /// Legacy mutation callers still use this one-shot transport directly.
        /// </summary>
        public async Awaitable<Dictionary<string, object?>> SendJsonAsync(string method, string path, Dictionary<string, object?>? body = null, bool requireAuth = true, bool idempotent = true, CancellationToken ct = default)
        {
            string? json = null;
            if (method != "DELETE")
            {
                var payload = body != null ? new Dictionary<string, object?>(body, StringComparer.Ordinal) : new Dictionary<string, object?>(StringComparer.Ordinal);
                if (idempotent && !payload.ContainsKey("requestId")) payload["requestId"] = NewRequestId();
                json = CanonicalJson.Serialize(payload);
            }
            string text = await CallAsync<string>(method, path, json, requireAuth, _authVersion, ct);
            return string.IsNullOrWhiteSpace(text) ? new Dictionary<string, object?>(StringComparer.Ordinal) : UomdJson.ParseObject(text);
        }

        public Awaitable<PlayerSummaryDto> GetMeAsync(CancellationToken ct = default) =>
            CallAsync<PlayerSummaryDto>("GET", "/api/v1/me", ct: ct);

        public async Awaitable<WalletsDto> GetWalletAsync(CancellationToken ct = default) =>
            (await CallAsync<WalletEnvelopeDto>("GET", "/api/v1/wallet", ct: ct)).wallets;

        public Awaitable<EntryCheckpointDto> GetEntryAsync(CancellationToken ct = default) =>
            CallAsync<EntryCheckpointDto>("GET", "/api/v1/entry", ct: ct);

        public Awaitable<EntryCheckpointDto> PutEntryAsync(bool prologue, int tutorials, bool completed = false, CancellationToken ct = default)
        {
            var payload = new EntryUpdateRequestDto
            {
                prologue = prologue,
                tutorials = tutorials,
                completed = completed,
                requestId = NewRequestId()
            };
            return PutEntryAsync(payload, ct);
        }

        public Awaitable<EntryCheckpointDto> PutEntryAsync(EntryUpdateRequestDto payload, CancellationToken ct = default) =>
            CallAsync<EntryCheckpointDto>("PUT", "/api/v1/entry", JsonUtility.ToJson(payload), ct: ct);

        public async Awaitable<BannerInfoDto[]> GetBannersAsync(string? releaseId = null, CancellationToken ct = default)
        {
            string query = string.IsNullOrEmpty(releaseId) ? string.Empty : $"?releaseId={UnityWebRequest.EscapeURL(releaseId)}";
            return (await CallAsync<BannersEnvelopeDto>("GET", $"/api/v1/banners{query}", requireAuth: false, ct: ct)).banners;
        }

        public Awaitable<PullResponseDto> PullGachaAsync(string bannerId, int count, string? target = null, string? releaseId = null, CancellationToken ct = default)
        {
            var req = new PullRequestDto
            {
                bannerId = bannerId,
                count = count,
                target = target,
                releaseId = releaseId,
                requestId = NewRequestId()
            };
            return CallAsync<PullResponseDto>("POST", "/api/v1/gacha/pull", JsonUtility.ToJson(req), ct: ct);
        }

        public Awaitable<MyCharactersResponseDto> GetMyCharactersAsync(string? releaseId = null, CancellationToken ct = default)
        {
            string query = string.IsNullOrEmpty(releaseId) ? string.Empty : $"?releaseId={UnityWebRequest.EscapeURL(releaseId)}";
            return CallAsync<MyCharactersResponseDto>("GET", $"/api/v1/characters/mine{query}", ct: ct);
        }

        public async Awaitable<GearViewDto[]> GetGearAsync(string? releaseId = null, CancellationToken ct = default)
        {
            string query = string.IsNullOrEmpty(releaseId) ? string.Empty : $"?releaseId={UnityWebRequest.EscapeURL(releaseId)}";
            return (await CallAsync<GearListEnvelopeDto>("GET", $"/api/v1/gear{query}", ct: ct)).gear;
        }

        public Awaitable<TeamsEnvelopeDto> GetTeamsAsync(CancellationToken ct = default) =>
            CallAsync<TeamsEnvelopeDto>("GET", "/api/v1/teams", ct: ct);

        public async Awaitable<MailItemDto[]> GetMailAsync(CancellationToken ct = default) =>
            (await CallAsync<MailEnvelopeDto>("GET", "/api/v1/mail", ct: ct)).mail;

        public Awaitable<StoryProgressResponseDto> CompleteStoryNodeAsync(string releaseId, string nodeId, CancellationToken ct = default)
        {
            var req = new StoryProgressRequestDto
            {
                releaseId = releaseId,
                nodeId = nodeId,
                requestId = NewRequestId()
            };
            return CallAsync<StoryProgressResponseDto>("POST", "/api/v1/progress/story", JsonUtility.ToJson(req), ct: ct);
        }

        public async Awaitable<BattleStartReceipt> StartBattleAsync(string releaseId, string nodeId, int authRevision, CancellationToken ct = default) =>
            BattleStartReceipt.Parse(await CallAsync<string>("POST", UomdBattleWire.Path + "/start", UomdBattleWire.Start(releaseId, nodeId), expectedAuthVersion: authRevision, ct: ct));

        public async Awaitable<BattleReceipt> SubmitBattleAsync(string canonicalPayload, int authRevision, CancellationToken ct = default) =>
            BattleReceipt.Parse(await CallAsync<string>("POST", UomdBattleWire.Path, canonicalPayload, expectedAuthVersion: authRevision, ct: ct));

        public async Awaitable<BattleOperationStatus> BattleStatusAsync(string requestId, string inputHash, int authRevision, CancellationToken ct = default) =>
            BattleOperationStatus.Parse(await CallAsync<string>("GET", "/api/v1/operations/" + Uri.EscapeDataString(requestId) + "?path=" + Uri.EscapeDataString(UomdBattleWire.Path), expectedAuthVersion: authRevision, ct: ct), requestId, inputHash);
    }
}
