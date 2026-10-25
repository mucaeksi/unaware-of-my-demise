#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Uomd.Core.Patching
{
    /// <summary>Reject reasons, spelled exactly like packages/patch/src/types.ts RejectReason (logs and telemetry match).</summary>
    public static class PatchRejectReason
    {
        public const string CapabilityMissing = "capability_missing";
        public const string Cancelled = "cancelled";
        public const string DownloadTimeout = "download_timeout";
        public const string NetworkPolicy = "network_policy";
        public const string StorageQuota = "storage_quota";
        public const string MalformedManifest = "malformed_manifest";
        public const string BadSignature = "bad_signature";
        public const string WrongChannel = "wrong_channel";
        public const string ClientTooOld = "client_too_old";
        public const string ClientTooNew = "client_too_new";
        public const string SchemaTooNew = "schema_too_new";
        public const string DependencyMismatch = "dependency_mismatch";
        public const string StaleGeneration = "stale_generation";
        public const string DeniedRelease = "denied_release";
        public const string StorageBudget = "storage_budget";
        public const string DownloadFailed = "download_failed";
        public const string HashMismatch = "hash_mismatch";
        public const string ValidationFailed = "validation_failed";
        public const string StorageBusy = "storage_busy";
        public const string StorageStateInvalid = "storage_state_invalid";
    }

    /// <summary>An expected failure of a patch step; UomdPatchClient turns it into a rejected PatchOutcome.</summary>
    public sealed class PatchRejectException : Exception
    {
        public PatchRejectException(string reason, string detail) : base(detail) => Reason = reason;
        public string Reason { get; }
    }

    /// <summary>Thrown by a storage adapter when the device is out of space (the browser's QuotaExceededError).</summary>
    public sealed class StorageQuotaException : Exception
    {
        public StorageQuotaException(string message, Exception? inner = null) : base(message, inner) { }
    }

    public sealed class ActiveRelease
    {
        public ActiveRelease(ContentManifest manifest, string activatedAt)
        {
            Manifest = manifest;
            ActivatedAt = activatedAt;
        }

        public string ReleaseId => Manifest.ReleaseId;
        public long Generation => Manifest.Generation;
        public ContentManifest Manifest { get; }
        public string ActivatedAt { get; }

        internal Dictionary<string, object?> ToJson() => new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["releaseId"] = ReleaseId,
            ["generation"] = Generation,
            ["manifest"] = Manifest.Raw,
            ["activatedAt"] = ActivatedAt
        };
    }

    /// <summary>Everything the patch client persists (port of PatchState). Immutable: changes go through With.</summary>
    public sealed class PatchState
    {
        public static readonly PatchState Empty = new PatchState(null, null, null, Array.Empty<string>());

        public PatchState(ActiveRelease? active, ActiveRelease? previous, ActiveRelease? staged, IReadOnlyList<string> denied)
        {
            Active = active;
            Previous = previous;
            Staged = staged;
            Denied = denied;
        }

        public ActiveRelease? Active { get; }
        public ActiveRelease? Previous { get; }
        /// <summary>Fully downloaded, verified and validated but not switched on; activates at the next start.</summary>
        public ActiveRelease? Staged { get; }
        /// <summary>Releases that failed validation or crashed on activation; never auto-applied again.</summary>
        public IReadOnlyList<string> Denied { get; }

        public bool IsEmpty => Active == null && Previous == null && Staged == null && Denied.Count == 0;

        public PatchState With(Optional<ActiveRelease?> active = default, Optional<ActiveRelease?> previous = default,
            Optional<ActiveRelease?> staged = default, IReadOnlyList<string>? denied = null) =>
            new PatchState(active.Or(Active), previous.Or(Previous), staged.Or(Staged), denied ?? Denied);

        public PatchState Deny(string releaseId)
        {
            if (Contains(Denied, releaseId)) return this;
            var list = new List<string>(Denied) { releaseId };
            return With(denied: list);
        }

        public string ToJson()
        {
            var denied = new List<object?>();
            foreach (string id in Denied) denied.Add(id);
            return CanonicalJson.Serialize(new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["schema"] = 1L,
                ["active"] = Active?.ToJson(),
                ["previous"] = Previous?.ToJson(),
                ["staged"] = Staged?.ToJson(),
                ["denied"] = denied
            });
        }

        internal static bool Contains(IReadOnlyList<string> list, string value)
        {
            for (int i = 0; i < list.Count; i++) if (string.Equals(list[i], value, StringComparison.Ordinal)) return true;
            return false;
        }
    }

    /// <summary>"Leave unchanged" vs "set (possibly to null)" for PatchState.With.</summary>
    public readonly struct Optional<T>
    {
        private readonly bool _set;
        private readonly T _value;
        private Optional(T value) { _set = true; _value = value; }
        public static implicit operator Optional<T>(T value) => new Optional<T>(value);
        public T Or(T fallback) => _set ? _value : fallback;
    }

    /// <summary>Greatest accepted generation per channel; kept apart from the overlay state so a lost state cannot erase it.</summary>
    public sealed class GenerationMark
    {
        public GenerationMark(long generation, string releaseId, bool killed)
        {
            Generation = generation;
            ReleaseId = releaseId;
            Killed = killed;
        }

        public long Generation { get; }
        public string ReleaseId { get; }
        public bool Killed { get; }
        /// <summary>A storage adapter hands over a mark it could not read as Generation 0 so the client fails closed.</summary>
        public bool IsValid => Generation >= 1 && Generation <= 9007199254740991L && ReleaseId != null;
    }

    public sealed class DownloadReservation
    {
        public DownloadReservation(IReadOnlyDictionary<string, long> files, long expiresAtMs)
        {
            Files = files;
            ExpiresAtMs = expiresAtMs;
        }

        /// <summary>sha256 → byte limit the reserving download may write.</summary>
        public IReadOnlyDictionary<string, long> Files { get; }
        public long ExpiresAtMs { get; }
    }

    /// <summary>
    /// One storage transaction (port of StorageSnapshot). Input: everything current. Output: State and HighWater are written
    /// (a null HighWater keeps the stored mark), Downloads replaces the reservations when non-null, RemoveObjects are deleted.
    /// </summary>
    public sealed class StorageSnapshot
    {
        public StorageSnapshot(string? state, GenerationMark? highWater, IReadOnlyDictionary<string, long>? inventory = null,
            IReadOnlyDictionary<string, DownloadReservation>? downloads = null, IReadOnlyList<string>? removeObjects = null)
        {
            State = state;
            HighWater = highWater;
            Inventory = inventory ?? new Dictionary<string, long>();
            Downloads = downloads;
            RemoveObjects = removeObjects;
        }

        /// <summary>The serialized PatchState exactly as stored (compared verbatim to fence concurrent writers).</summary>
        public string? State { get; }
        public GenerationMark? HighWater { get; }
        /// <summary>Stored object key ("sha" or "partial:sha") → byte length.</summary>
        public IReadOnlyDictionary<string, long> Inventory { get; }
        public IReadOnlyDictionary<string, DownloadReservation>? Downloads { get; }
        public IReadOnlyList<string>? RemoveObjects { get; }

        public StorageSnapshot WithDownloads(IReadOnlyDictionary<string, DownloadReservation> downloads) =>
            new StorageSnapshot(State, HighWater, Inventory, downloads, RemoveObjects);

        public StorageSnapshot WithRemoveObjects(IReadOnlyList<string> keys) =>
            new StorageSnapshot(State, HighWater, Inventory, Downloads, keys);
    }

    /// <summary>Content-addressed object store plus the atomic patch state record (port of ContentStorage).</summary>
    public interface IContentStorage
    {
        Task<byte[]?> GetObjectAsync(string key);
        /// <summary>With a reservation, the write must fit inside that live download reservation (else throw).</summary>
        Task PutObjectAsync(string key, byte[] bytes, string? reservation = null);
        Task<bool> HasObjectAsync(string key);
        Task<IReadOnlyList<string>> ListObjectsAsync();
        Task DeleteObjectAsync(string key);
        Task<string?> GetStateAsync();
        Task<GenerationMark?> GetHighWaterAsync(string channel);
        /// <summary>Reads state, mark, inventory and reservations and commits the change atomically; null makes no change.</summary>
        Task<bool> UpdateStateAsync(string channel, Func<StorageSnapshot, StorageSnapshot?> change);
    }

    public interface IRemoteSource
    {
        /// <summary>The latest published manifest as a parsed JSON object graph (UomdJson), or null when none is published.</summary>
        Task<object?> FetchManifestAsync(string channel, CancellationToken cancellation);
        /// <summary>
        /// The object's bytes. onBytes reports bytes received so far; partial is a saved prefix to resume from and
        /// onPartial persists a received prefix when the transfer breaks.
        /// </summary>
        Task<byte[]> FetchObjectAsync(string sha256, ManifestFile file, Action<long>? onBytes, byte[]? partial,
            Func<byte[], Task>? onPartial, CancellationToken cancellation);
    }

    /// <summary>The release shipped inside the app binary.</summary>
    public interface IBaseContent
    {
        string ReleaseId { get; }
        long Generation { get; }
        /// <summary>path → sha256 of each base file.</summary>
        IReadOnlyDictionary<string, string> Files { get; }
        Task<byte[]> ReadAsync(string path);
    }

    public enum PatchNetwork { Online, Offline, Metered }

    public sealed class PatchEnv
    {
        public string Channel { get; set; } = "staging";
        /// <summary>Binary version of this client, compared with manifest.compat.</summary>
        public string ClientVersion { get; set; } = "0.0.0";
        public int SupportedContentSchema { get; set; } = 1;
        public IReadOnlyCollection<string>? SupportedCapabilities { get; set; }
        public IReadOnlyList<TrustKeyJwk> TrustedKeys { get; set; } = Array.Empty<TrustKeyJwk>();
        /// <summary>Stable random install id; drives percentage rollout buckets.</summary>
        public string InstallId { get; set; } = "";
        public long StorageBudgetBytes { get; set; } = 120L * 1024 * 1024;
        /// <summary>Semantic validation of the release as it would be activated (JSON bytes; media as empty arrays). Throw to reject.</summary>
        public Func<IReadOnlyDictionary<string, byte[]>, ContentManifest, IBaseContent, Task>? Validate { get; set; }
        /// <summary>Optional media header/resource checks per verified object. Throw to reject.</summary>
        public Action<ManifestFile, byte[]>? ValidateObject { get; set; }
        public int MaxAttempts { get; set; } = 3;
        public Func<int, CancellationToken, Task>? Sleep { get; set; }
        public Func<DateTimeOffset>? Now { get; set; }
        public Func<Task<(long? Usage, long? Quota)>>? StorageEstimate { get; set; }
        public Func<PatchNetwork>? NetworkPolicy { get; set; }
        public int DownloadTimeoutMs { get; set; } = 240_000;
    }

    public static class PatchPhase
    {
        public const string Checking = "checking";
        public const string Downloading = "downloading";
        public const string Verifying = "verifying";
        public const string Activating = "activating";
    }

    public sealed class PatchProgress
    {
        public PatchProgress(string phase, string? releaseId, int filesDone, int filesTotal, long bytesDone, long bytesTotal)
        {
            Phase = phase;
            ReleaseId = releaseId;
            FilesDone = filesDone;
            FilesTotal = filesTotal;
            BytesDone = bytesDone;
            BytesTotal = bytesTotal;
        }

        public string Phase { get; }
        public string? ReleaseId { get; }
        public int FilesDone { get; }
        public int FilesTotal { get; }
        public long BytesDone { get; }
        public long BytesTotal { get; }
    }

    public sealed class ApplyOptions
    {
        public CancellationToken Cancellation { get; set; }
        public bool AllowMetered { get; set; }
        public Action<PatchProgress>? OnProgress { get; set; }
        /// <summary>false: download, verify and validate, then park the release as staged. Default true.</summary>
        public bool Activate { get; set; } = true;
    }

    public enum PatchStatus { UpToDate, Applied, Staged, RevertedToBase, Offline, Rejected }

    public sealed class PatchOutcome
    {
        private PatchOutcome(PatchStatus status, string? releaseId = null, long generation = 0, long downloadedBytes = 0,
            int downloadedFiles = 0, string? reason = null, string? detail = null)
        {
            Status = status;
            ReleaseId = releaseId;
            Generation = generation;
            DownloadedBytes = downloadedBytes;
            DownloadedFiles = downloadedFiles;
            Reason = reason;
            Detail = detail;
        }

        public PatchStatus Status { get; }
        public string? ReleaseId { get; }
        public long Generation { get; }
        public long DownloadedBytes { get; }
        public int DownloadedFiles { get; }
        /// <summary>A PatchRejectReason for Rejected; "kill_switch" for RevertedToBase.</summary>
        public string? Reason { get; }
        public string? Detail { get; }

        public static PatchOutcome UpToDate(string? releaseId) => new PatchOutcome(PatchStatus.UpToDate, releaseId);
        public static PatchOutcome Applied(string releaseId, long generation, long bytes, int files) => new PatchOutcome(PatchStatus.Applied, releaseId, generation, bytes, files);
        public static PatchOutcome StagedRelease(string releaseId, long generation, long bytes, int files) => new PatchOutcome(PatchStatus.Staged, releaseId, generation, bytes, files);
        public static PatchOutcome RevertedToBase() => new PatchOutcome(PatchStatus.RevertedToBase, reason: "kill_switch");
        public static PatchOutcome Offline(string detail) => new PatchOutcome(PatchStatus.Offline, detail: detail);
        public static PatchOutcome Rejected(string reason, string detail) => new PatchOutcome(PatchStatus.Rejected, reason: reason, detail: detail);

        public override string ToString() => Status switch
        {
            PatchStatus.Rejected => $"rejected:{Reason} ({Detail})",
            PatchStatus.Offline => $"offline ({Detail})",
            PatchStatus.Applied or PatchStatus.Staged => $"{Status} {ReleaseId} g{Generation} ({DownloadedFiles} files, {DownloadedBytes} bytes)",
            _ => $"{Status} {ReleaseId}"
        };
    }
}
