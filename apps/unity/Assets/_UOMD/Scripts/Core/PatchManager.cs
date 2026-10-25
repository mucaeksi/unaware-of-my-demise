#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using Uomd.Core.Patching;

namespace Uomd.Core
{
    /// <summary>
    /// The game's single access point for content files (Unity side of apps/game/src/content/ContentService.ts). Paths resolve
    /// through the active signed patch release (UomdPatchClient over FileContentStorage in persistentDataPath) and fall back to
    /// the release embedded in StreamingAssets/uomd_base. A patched object is hash-verified the first time it is served; a
    /// damaged object rolls the device back to the previous release (or the base) instead of being shown.
    /// </summary>
    public sealed class PatchManager
    {
        /// <summary>Content channel of this build; the staging Worker serves only its own channel.</summary>
        public const string Channel = "staging";
        private const string InstallIdKey = "uomd.install_id.v1";
        private const string EntryCompletedKey = "uomd.entry.completed.v1";
        private const int BackgroundDownloadTimeoutMs = 15 * 60 * 1000;

        private readonly string _streamingBaseDir;
        private readonly string _patchRoot;
        private readonly HashSet<string> _verified = new HashSet<string>(StringComparer.Ordinal);
        private UomdStreamingBase? _base;
        private FileContentStorage? _files;
        private UomdPatchClient? _client;
        private PatchState _state = PatchState.Empty;

        public PatchManager()
        {
            _streamingBaseDir = Path.Combine(Application.streamingAssetsPath, "uomd_base");
            _patchRoot = Path.Combine(Application.persistentDataPath, "uomd_patches", "v1");
            Service = new UomdPatchService(() => null);
        }

        /// <summary>The first-install background download (stages; the restart switches it on).</summary>
        public UomdPatchService Service { get; private set; }
        public PatchOutcome? LastOutcome { get; private set; }
        public string ActiveReleaseId => _state.Active?.ReleaseId ?? _base?.ReleaseId ?? "rel_0001";
        public long ActiveGeneration => _state.Active?.Generation ?? _base?.Generation ?? 1;
        public string? StagedReleaseId => _state.Staged?.ReleaseId;
        public float DownloadProgress => Service.Status.BarFill ?? 0f;
        public string StatusMessage { get; private set; } = "Base content active";
        /// <summary>Raised after the active release changed (activation, rollback, kill switch); cached media must reload.</summary>
        public event Action? ContentChanged;

        /// <summary>Set once the first-install flow is complete on this device: later starts check for updates at boot.</summary>
        public bool EntryCompleted
        {
            get => PlayerPrefs.GetInt(EntryCompletedKey, 0) == 1;
            set
            {
                PlayerPrefs.SetInt(EntryCompletedKey, value ? 1 : 0);
                PlayerPrefs.Save();
            }
        }

        /// <summary>
        /// Loads the embedded release, opens patch storage and switches on a staged release (no network). memoryOnly keeps
        /// downloads in memory (capture runs must not inherit or leave device state).
        /// </summary>
        public async Awaitable InitializeAsync(string apiBaseUrl, bool memoryOnly)
        {
            try
            {
                _base = await UomdStreamingBase.LoadAsync(_streamingBaseDir);
            }
            catch (Exception e)
            {
                Debug.LogError($"[UomdPatch] embedded release unreadable, patching disabled: {e.Message}");
                StatusMessage = "Embedded content could not be verified";
                return;
            }
            IContentStorage storage;
            bool persistent = !memoryOnly;
            try
            {
                storage = memoryOnly ? new MemoryContentStorage() : (_files = new FileContentStorage(_patchRoot));
            }
            catch (Exception e) when (e is IOException || e is UnauthorizedAccessException)
            {
                Debug.LogWarning($"[UomdPatch] patch storage unavailable, downloads stay in memory: {e.Message}");
                storage = new MemoryContentStorage();
                persistent = false;
            }
            _client = new UomdPatchClient(CreateEnv(), storage, new UomdApiRemote(apiBaseUrl), _base);
            Service = new UomdPatchService(() => _client, persistent);
            await ActivateStagedAsync();
        }

        private static PatchEnv CreateEnv() => new PatchEnv
        {
            Channel = Channel,
            ClientVersion = ToSemver(Application.version),
            SupportedContentSchema = UomdClientConfig.SupportedContentSchema,
            SupportedCapabilities = UomdClientConfig.SupportedCapabilities,
            TrustedKeys = UomdClientConfig.TrustedPublicKeys,
            InstallId = InstallId(),
            StorageBudgetBytes = UomdClientConfig.PatchStorageBudgetBytes,
            Validate = (files, manifest, baseContent) =>
            {
                UomdContentOverlay.ValidateRelease(files, manifest, baseContent);
                return Task.CompletedTask;
            },
            NetworkPolicy = () => Application.internetReachability switch
            {
                NetworkReachability.NotReachable => PatchNetwork.Offline,
                NetworkReachability.ReachableViaCarrierDataNetwork => PatchNetwork.Metered,
                _ => PatchNetwork.Online
            },
            DownloadTimeoutMs = BackgroundDownloadTimeoutMs
        };

        /// <summary>"1.0" (Player Settings bundle version) → "1.0.0" for the manifest compat range.</summary>
        public static string ToSemver(string version)
        {
            var parts = new List<string>();
            foreach (string part in (version ?? "").Split('.'))
            {
                string digits = "";
                foreach (char c in part)
                {
                    if (c < '0' || c > '9') break;
                    digits += c;
                }
                parts.Add(digits.Length == 0 ? "0" : digits.TrimStart('0').Length == 0 ? "0" : digits.TrimStart('0'));
                if (parts.Count == 3) break;
            }
            while (parts.Count < 3) parts.Add("0");
            return string.Join(".", parts);
        }

        private static string InstallId()
        {
            string id = PlayerPrefs.GetString(InstallIdKey, "");
            if (id.Length == 0)
            {
                id = Guid.NewGuid().ToString("N");
                PlayerPrefs.SetString(InstallIdKey, id);
                PlayerPrefs.Save();
            }
            return id;
        }

        /// <summary>Switches on a release staged by an earlier download (boot and the post-tutorial restart). No network.</summary>
        public async Awaitable<PatchOutcome?> ActivateStagedAsync()
        {
            if (_client == null) return null;
            PatchOutcome? outcome = null;
            try
            {
                outcome = await _client.ActivateStagedAsync();
                if (outcome != null)
                {
                    LastOutcome = outcome;
                    Debug.Log($"[UomdPatch] staged release: {outcome}");
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[UomdPatch] staged activation failed: {e.Message}");
            }
            await RefreshAsync();
            return outcome;
        }

        /// <summary>Downloads and applies a newer release now (boot of a returning player, before content is shown).</summary>
        public async Awaitable<PatchOutcome> CheckForUpdatesAsync(int timeoutMs)
        {
            if (_client == null) return PatchOutcome.Offline("content service is not ready");
            using var timeout = new CancellationTokenSource(timeoutMs);
            PatchOutcome outcome;
            try
            {
                outcome = await _client.CheckAndApplyAsync(new ApplyOptions { Cancellation = timeout.Token });
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[UomdPatch] update check failed: {e.Message}");
                return PatchOutcome.Offline(e.Message);
            }
            LastOutcome = outcome;
            Debug.Log($"[UomdPatch] update check: {outcome}");
            await RefreshAsync();
            return outcome;
        }

        private async Awaitable RefreshAsync()
        {
            if (_client == null) return;
            string before = ActiveReleaseId;
            try { _state = await _client.StateAsync(); }
            catch (Exception e) { Debug.LogWarning($"[UomdPatch] state unreadable, serving the embedded release: {e.Message}"); _state = PatchState.Empty; }
            _verified.Clear();
            StatusMessage = _state.Active != null ? $"Patch {_state.Active.ReleaseId} active (gen {_state.Active.Generation})" : $"Base content active ({ActiveReleaseId})";
            if (before != ActiveReleaseId) ContentChanged?.Invoke();
        }

        /// <summary>True when a path is served by a downloaded patch object (not by the embedded release).</summary>
        public bool IsPatched(string relativePath) => PatchedObject(Normalize(relativePath)) != null;

        /// <summary>
        /// The file to read for a content path: a verified patch object (persistentDataPath, no extension) or the embedded
        /// release path (on Android a jar: URL that needs UnityWebRequest).
        /// </summary>
        public string ResolveContentPath(string relativePath)
        {
            string normalized = Normalize(relativePath);
            return PatchedObject(normalized) ?? Path.Combine(_streamingBaseDir, normalized);
        }

        private string? PatchedObject(string path)
        {
            if (_base == null || _files == null) return null;
            var entry = UomdContentOverlay.Resolve(_state, _base.Files, path);
            if (entry == null || !entry.Value.FromPatch) return null;
            string sha = entry.Value.Sha256;
            string? file = _files.ObjectPath(sha);
            if (file != null && (_verified.Contains(sha) || Verify(file, sha))) return file;
            OnDamagedObject(path);
            return PatchedObject(path);
        }

        private bool Verify(string file, string sha)
        {
            try
            {
                if (Sha256Hash.ComputeFileHex(file) != sha) return false;
                _verified.Add(sha);
                return true;
            }
            catch (IOException) { return false; }
        }

        /// <summary>Storage lost or corrupted a patched object: serve the previous release now and persist the rollback.</summary>
        private void OnDamagedObject(string path)
        {
            Debug.LogWarning($"[UomdPatch] patched '{path}' failed verification; rolling back from {_state.Active?.ReleaseId}");
            var active = _state.Active;
            _state = active == null ? _state : _state.Deny(active.ReleaseId).With(active: _state.Previous, previous: null);
            _ = PersistRollbackAsync();
        }

        private async Awaitable PersistRollbackAsync()
        {
            if (_client == null) return;
            try { await _client.RollbackAsync(); }
            catch (Exception e) { Debug.LogWarning($"[UomdPatch] rollback could not be saved: {e.Message}"); }
            await RefreshAsync();
            ContentChanged?.Invoke();
        }

        public async Awaitable<string> ReadTextAsync(string relativePath)
        {
            byte[] bytes = await ReadBytesAsync(relativePath);
            return new UTF8Encoding(false).GetString(bytes);
        }

        /// <summary>A file of the embedded base release, ignoring patches (what a patch added is "NEW" against it).</summary>
        public async Awaitable<string> ReadBaseTextAsync(string relativePath) =>
            new UTF8Encoding(false).GetString(await ReadFileAsync(Path.Combine(_streamingBaseDir, Normalize(relativePath)), relativePath));

        public Awaitable<byte[]> ReadBytesAsync(string relativePath) => ReadFileAsync(ResolveContentPath(relativePath), relativePath);

        private static async Awaitable<byte[]> ReadFileAsync(string fullPath, string relativePath)
        {
            if (fullPath.Contains("://"))
            {
                using var req = UnityWebRequest.Get(fullPath);
                await req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success) throw new IOException($"Failed to read content '{relativePath}': {req.error}");
                return req.downloadHandler.data;
            }
            return await File.ReadAllBytesAsync(fullPath);
        }

        private static string Normalize(string relativePath) => (relativePath ?? "").Replace('\\', '/').TrimStart('/');

        public static string ComputeSha256Hex(byte[] data) => Sha256Hash.ComputeHex(data ?? Array.Empty<byte>());
    }
}
