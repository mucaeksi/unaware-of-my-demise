#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Uomd.Core.Patching
{
    /// <summary>
    /// Content patch client: C# port of packages/patch/src/manager.ts (README "Patch manager baseline"), engine-free so the
    /// headless harness runs the same tests as Unity. Continuations stay on the caller's context (Unity main thread) because
    /// the Unity remote and storage adapters use main-thread APIs.
    ///  - only data/media described by a signed, schema-valid manifest is ever accepted;
    ///  - every object is size- and SHA-256-verified before it is stored (content addressed);
    ///  - semantic validation runs before activation; activation is ONE atomic state write;
    ///  - the previous release is kept for rollback; failures never touch the active release;
    ///  - an independent per-channel generation mark refuses replays, older kills and downgrades.
    /// </summary>
    public sealed class UomdPatchClient : IPatchSource
    {
        private const int ReservationMs = 5 * 60_000;
        private const long QuotaHeadroomBytes = 8L * 1024 * 1024;
        private const int MaxConcurrentDownloads = 6;
        private const string PartialPrefix = "partial:";

        private readonly PatchEnv _env;
        private readonly IContentStorage _storage;
        private readonly IRemoteSource _remote;
        private readonly IBaseContent _base;
        private readonly object _validatedGate = new object();
        private string? _validatedKey;
        private PatchState? _validatedState;

        public UomdPatchClient(PatchEnv env, IContentStorage storage, IRemoteSource remote, IBaseContent baseContent)
        {
            _env = env ?? throw new ArgumentNullException(nameof(env));
            _storage = storage ?? throw new ArgumentNullException(nameof(storage));
            _remote = remote ?? throw new ArgumentNullException(nameof(remote));
            _base = baseContent ?? throw new ArgumentNullException(nameof(baseContent));
        }

        public IBaseContent Base => _base;

        public async Task<PatchState> StateAsync() => ValidState(await _storage.GetStateAsync());

        /// <summary>Re-admits every stored release (signature, compat, dependency) so a tampered state record is ignored.</summary>
        private PatchState ValidState(string? raw)
        {
            if (raw == null) return PatchState.Empty;
            lock (_validatedGate)
            {
                if (_validatedKey == raw && _validatedState != null) return _validatedState;
            }
            Dictionary<string, object?> obj;
            try { obj = UomdJson.ParseObject(raw); }
            catch (FormatException) { return PatchState.Empty; }
            if (!(obj.TryGetValue("schema", out object? schema) && schema is long s && s == 1) ||
                !(obj.TryGetValue("denied", out object? deniedRaw) && deniedRaw is List<object?> deniedList) ||
                deniedList.Any(d => !(d is string)))
            {
                return PatchState.Empty;
            }
            var denied = deniedList.Cast<string>().ToList();
            var probe = new PatchState(null, null, null, denied);
            ActiveRelease? Valid(string key)
            {
                if (!obj.TryGetValue(key, out object? value) || !(value is Dictionary<string, object?> r)) return null;
                try
                {
                    var manifest = Admit(r.TryGetValue("manifest", out object? m) ? m : null, probe);
                    if (!(r.TryGetValue("releaseId", out object? id) && id is string releaseId && releaseId == manifest.ReleaseId)) return null;
                    if (!(r.TryGetValue("generation", out object? g) && g is long generation && generation == manifest.Generation)) return null;
                    if (!(r.TryGetValue("activatedAt", out object? at) && at is string activatedAt) ||
                        !DateTimeOffset.TryParse(activatedAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _)) return null;
                    return new ActiveRelease(manifest, activatedAt);
                }
                catch (PatchRejectException) { return null; }
            }
            ActiveRelease? active = Valid("active"), previous = Valid("previous"), staged = Valid("staged");
            bool hadActive = obj.TryGetValue("active", out object? rawActive) && rawActive != null;
            if (hadActive && active == null && previous != null)
            {
                active = previous;
                previous = null;
            }
            var state = new PatchState(active, previous, staged, denied);
            lock (_validatedGate)
            {
                _validatedKey = raw;
                _validatedState = state;
            }
            return state;
        }

        /// <summary>
        /// Commits a state change against the exact snapshot the change was computed from (crypto runs outside the storage
        /// transaction). The change gets the greatest known generation mark and returns the state (null clears it) and mark to write.
        /// </summary>
        private async Task<bool> CommitAsync(Func<PatchState, GenerationMark, (PatchState? State, GenerationMark Mark)?> change)
        {
            for (int attempt = 0; attempt < 3; attempt++)
            {
                string? raw = await _storage.GetStateAsync();
                var state = ValidState(raw);
                bool matched = false;
                bool result = await _storage.UpdateStateAsync(_env.Channel, current =>
                {
                    if (!string.Equals(current.State, raw, StringComparison.Ordinal)) return null;
                    matched = true;
                    var mark = current.HighWater;
                    if (mark != null && !mark.IsValid) throw new PatchRejectException(PatchRejectReason.StorageStateInvalid, "accepted generation record is corrupted");
                    var candidates = new List<GenerationMark> { new GenerationMark(_base.Generation, _base.ReleaseId, false) };
                    foreach (var r in new[] { state.Active, state.Previous, state.Staged })
                    {
                        if (r != null) candidates.Add(new GenerationMark(r.Generation, r.ReleaseId, r.Manifest.KillSwitch));
                    }
                    foreach (var candidate in candidates)
                    {
                        if (mark == null || candidate.Generation > mark.Generation) mark = candidate;
                    }
                    var next = change(state, mark!);
                    if (next == null) return null;
                    return new StorageSnapshot(next.Value.State?.ToJson(), next.Value.Mark);
                });
                if (matched) return result;
            }
            throw new PatchRejectException(PatchRejectReason.StorageBusy, "content state changed concurrently; retry the update");
        }

        private async Task<GenerationMark> HighWaterAsync()
        {
            GenerationMark? found = null;
            await CommitAsync((state, known) =>
            {
                found = known;
                return (state.IsEmpty ? null : state, known);
            });
            return found!;
        }

        private static bool SameMark(GenerationMark mark, ContentManifest m) =>
            mark.Generation == m.Generation && mark.ReleaseId == m.ReleaseId && mark.Killed == m.KillSwitch;

        private static bool Predates(GenerationMark mark, ContentManifest m) =>
            m.Generation < mark.Generation || (m.Generation == mark.Generation && !SameMark(mark, m));

        /// <summary>Looks for a newer release and applies (or, with Activate=false, stages) it. Never throws for expected failure modes.</summary>
        public async Task<PatchOutcome> CheckAndApplyAsync(ApplyOptions? options = null)
        {
            var opts = options ?? new ApplyOptions();
            var network = _env.NetworkPolicy?.Invoke() ?? PatchNetwork.Online;
            if (network == PatchNetwork.Offline) return PatchOutcome.Offline("no connection");
            if (network == PatchNetwork.Metered && !opts.AllowMetered)
                return PatchOutcome.Rejected(PatchRejectReason.NetworkPolicy, "Allow downloads on the current data-saving or metered connection to continue.");
            string owner = Guid.NewGuid().ToString("N");
            using var deadline = new CancellationTokenSource(_env.DownloadTimeoutMs);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(opts.Cancellation, deadline.Token);
            var run = new ApplyOptions { Cancellation = linked.Token, AllowMetered = opts.AllowMetered, OnProgress = opts.OnProgress, Activate = opts.Activate };
            try
            {
                return await Interrupted(CheckAsync(run, owner), linked.Token);
            }
            catch (OperationCanceledException) when (linked.IsCancellationRequested)
            {
                return opts.Cancellation.IsCancellationRequested
                    ? PatchOutcome.Rejected(PatchRejectReason.Cancelled, "download cancelled; verified content is retained")
                    : PatchOutcome.Rejected(PatchRejectReason.DownloadTimeout, "download deadline reached; completed files and partial bytes are retained");
            }
            catch (PatchRejectException e)
            {
                return PatchOutcome.Rejected(e.Reason, e.Message);
            }
            catch (StorageQuotaException)
            {
                return PatchOutcome.Rejected(PatchRejectReason.StorageQuota, "Device storage is full. Existing content is retained.");
            }
            finally
            {
                try
                {
                    await _storage.UpdateStateAsync(_env.Channel, current =>
                    {
                        var downloads = Copy(current.Downloads);
                        downloads.Remove(owner);
                        return current.WithDownloads(downloads);
                    });
                }
                catch (Exception)
                {
                    // the reservation expires on its own; a failed cleanup must not mask the outcome
                }
            }
        }

        private async Task<PatchOutcome> CheckAsync(ApplyOptions opts, string owner)
        {
            var ct = opts.Cancellation;
            ct.ThrowIfCancellationRequested();
            var state = await StateAsync();
            opts.OnProgress?.Invoke(new PatchProgress(PatchPhase.Checking, null, 0, 0, 0, 0));
            object? raw;
            try
            {
                raw = await Interrupted(_remote.FetchManifestAsync(_env.Channel, ct), ct);
            }
            catch (Exception e) when (!(e is OperationCanceledException && ct.IsCancellationRequested))
            {
                ct.ThrowIfCancellationRequested();
                return PatchOutcome.Offline(e.Message);
            }
            if (raw == null) return PatchOutcome.UpToDate(state.Active?.ReleaseId);
            try
            {
                var manifest = Admit(raw, state);
                ct.ThrowIfCancellationRequested();
                var highest = await HighWaterAsync();
                if (Predates(highest, manifest)) throw new PatchRejectException(PatchRejectReason.StaleGeneration, "manifest predates the greatest accepted generation");
                if (manifest.KillSwitch)
                {
                    bool committed = await CommitAsync((current, mark) =>
                    {
                        if (Predates(mark, manifest)) return null;
                        return (current.With(active: null, previous: current.Active ?? current.Previous, staged: null),
                            new GenerationMark(manifest.Generation, manifest.ReleaseId, true));
                    });
                    if (!committed) throw new PatchRejectException(PatchRejectReason.StaleGeneration, "a newer generation won before the kill committed");
                    return PatchOutcome.RevertedToBase();
                }
                long currentGen = state.Active?.Generation ?? _base.Generation;
                if (manifest.Generation == currentGen && manifest.ReleaseId == (state.Active?.ReleaseId ?? _base.ReleaseId))
                    return PatchOutcome.UpToDate(state.Active?.ReleaseId);
                if (manifest.Generation <= currentGen) throw new PatchRejectException(PatchRejectReason.StaleGeneration, $"generation {manifest.Generation} <= active {currentGen}");
                if (!InRollout(manifest)) return PatchOutcome.UpToDate(state.Active?.ReleaseId);
                if (state.Staged?.ReleaseId == manifest.ReleaseId && opts.Activate)
                {
                    var done = await ActivateStagedAsync(opts.OnProgress, ct);
                    if (done != null) return done;
                }
                if (SameMark(highest, manifest) && state.Staged == null)
                    throw new PatchRejectException(PatchRejectReason.StaleGeneration, "this generation cannot be reapplied after fallback");
                return await ApplyAsync(manifest, opts, owner);
            }
            catch (PatchRejectException e)
            {
                return PatchOutcome.Rejected(e.Reason, e.Message);
            }
        }

        /// <summary>Reads a content file through the overlay: active patch release first, else the embedded base.</summary>
        public async Task<byte[]> ReadAsync(string path)
        {
            while (true)
            {
                var st = await StateAsync();
                var f = st.Active?.Manifest.FindFile(path);
                if (f == null)
                {
                    if (st.Active != null && st.Active.Manifest.DependsOn == null) throw new KeyNotFoundException($"no such content file: {path}");
                    return await _base.ReadAsync(path);
                }
                byte[]? bytes = BaseHas(f) ? await _base.ReadAsync(path) : await _storage.GetObjectAsync(f.Sha256);
                if (bytes != null && Sha256Hash.ComputeHex(bytes) == f.Sha256) return bytes;
                // storage lost or corrupted a patched object: fall back to the last good state, then to base
                await RollbackAsync();
            }
        }

        /// <summary>Which layer serves a path ("base" or "patch") and the SHA-256 of the bytes it serves.</summary>
        public async Task<(string Source, string Sha256)> LocateAsync(string path)
        {
            var st = await StateAsync();
            return Locate(st, _base, path) ?? throw new KeyNotFoundException($"no such content file: {path}");
        }

        /// <summary>Overlay lookup over a known state; null when the path is not served.</summary>
        public static (string Source, string Sha256)? Locate(PatchState state, IBaseContent baseContent, string path)
        {
            var f = state.Active?.Manifest.FindFile(path);
            if (f != null) return ("patch", f.Sha256);
            if (state.Active != null && state.Active.Manifest.DependsOn == null) return null;
            return baseContent.Files.TryGetValue(path, out string? h) ? ("base", h) : ((string, string)?)null;
        }

        /// <summary>Re-activates the previous release (or the embedded base). Returns false when already on base.</summary>
        public async Task<bool> RollbackAsync()
        {
            bool changed = await CommitAsync((st, mark) =>
            {
                if (st.Active == null) return null;
                return (st.Deny(st.Active.ReleaseId).With(active: st.Previous, previous: null), mark);
            });
            if (!changed) return false;
            await CollectAsync();
            return true;
        }

        // ---------------------------------------------------------------------------------------------- internals

        private bool BaseHas(ManifestFile f) => _base.Files.TryGetValue(f.Path, out string? h) && h == f.Sha256;

        private ContentManifest Admit(object? raw, PatchState state)
        {
            ContentManifest m;
            try { m = ContentManifest.Parse(raw); }
            catch (ManifestFormatException e) { throw new PatchRejectException(PatchRejectReason.MalformedManifest, e.Message); }
            if (m.SignatureKid == null || m.SignatureAlg == null || m.SignatureValue == null ||
                _env.TrustedKeys.Count == 0 ||
                !Es256SignatureVerifier.VerifySignedPayload(new Dictionary<string, object?>(m.Raw, StringComparer.Ordinal), m.SignatureKid, m.SignatureAlg, m.SignatureValue, _env.TrustedKeys))
            {
                throw new PatchRejectException(PatchRejectReason.BadSignature, "signature missing, unknown key or invalid");
            }
            if (m.Channel != _env.Channel) throw new PatchRejectException(PatchRejectReason.WrongChannel, $"{m.Channel} != {_env.Channel}");
            if (ContentManifest.CompareSemver(_env.ClientVersion, m.MinClient) < 0) throw new PatchRejectException(PatchRejectReason.ClientTooOld, $"needs >= {m.MinClient}");
            if (m.MaxClient != null && ContentManifest.CompareSemver(_env.ClientVersion, m.MaxClient) > 0) throw new PatchRejectException(PatchRejectReason.ClientTooNew, $"needs <= {m.MaxClient}");
            if (m.ContentSchema > _env.SupportedContentSchema) throw new PatchRejectException(PatchRejectReason.SchemaTooNew, $"content schema {m.ContentSchema} > {_env.SupportedContentSchema}");
            foreach (string c in m.RequiredCapabilities)
            {
                if (_env.SupportedCapabilities == null || !_env.SupportedCapabilities.Contains(c))
                    throw new PatchRejectException(PatchRejectReason.CapabilityMissing, "This content requires a newer app capability.");
            }
            if (PatchState.Contains(state.Denied, m.ReleaseId)) throw new PatchRejectException(PatchRejectReason.DeniedRelease, $"{m.ReleaseId} previously failed on this device");
            var dep = m.DependsOn;
            if (dep != null && (dep.ReleaseId != _base.ReleaseId || dep.Generation != _base.Generation))
                throw new PatchRejectException(PatchRejectReason.DependencyMismatch, $"needs {dep.ReleaseId} g{dep.Generation}, base is {_base.ReleaseId} g{_base.Generation}");
            return m;
        }

        /// <summary>Deterministic bucket: first 32 bits of sha256("installId:releaseId") mod 100.</summary>
        public static int RolloutBucket(string installId, string releaseId)
        {
            string h = Sha256Hash.ComputeHex($"{installId}:{releaseId}");
            return (int)(uint.Parse(h.Substring(0, 8), NumberStyles.HexNumber, CultureInfo.InvariantCulture) % 100);
        }

        private bool InRollout(ContentManifest m)
        {
            if (m.RolloutPercent >= 100) return true;
            if (m.RolloutPercent <= 0) return false;
            return RolloutBucket(_env.InstallId, m.ReleaseId) < m.RolloutPercent;
        }

        private async Task<PatchOutcome> ApplyAsync(ContentManifest m, ApplyOptions opts, string owner)
        {
            var ct = opts.Cancellation;
            void Emit(string phase, int filesDone = 0, int filesTotal = 0, long bytesDone = 0, long bytesTotal = 0)
            {
                if (!ct.IsCancellationRequested) opts.OnProgress?.Invoke(new PatchProgress(phase, m.ReleaseId, filesDone, filesTotal, bytesDone, bytesTotal));
            }

            // 1. what is missing locally? (base-identical files and already-stored objects are free)
            var missing = new List<ManifestFile>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var verified = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            HashSet<string> storedKeys;
            try { storedKeys = new HashSet<string>(await _storage.ListObjectsAsync(), StringComparer.Ordinal); }
            catch (Exception e) when (!(e is StorageQuotaException)) { storedKeys = new HashSet<string>(StringComparer.Ordinal); }
            foreach (var f in m.Files)
            {
                ct.ThrowIfCancellationRequested();
                if (BaseHas(f) || !seen.Add(f.Sha256)) continue;
                if (!storedKeys.Contains(f.Sha256))
                {
                    missing.Add(f);
                    continue;
                }
                byte[]? stored = await _storage.GetObjectAsync(f.Sha256);
                if (stored == null || stored.LongLength != f.Bytes || Sha256Hash.ComputeHex(stored) != f.Sha256)
                {
                    if (stored != null)
                    {
                        await _storage.DeleteObjectAsync(f.Sha256);
                        throw new PatchRejectException(PatchRejectReason.HashMismatch, $"stored object for {f.Path} is damaged; retry to download a clean copy");
                    }
                    missing.Add(f);
                }
                else
                {
                    CheckObject(f, stored);
                    verified[f.Sha256] = f.IsJson ? stored : Array.Empty<byte>();
                }
            }
            await CollectAsync(new HashSet<string>(m.Files.Select(f => f.Sha256), StringComparer.Ordinal));
            long addBytes = missing.Sum(f => f.Bytes);
            var estimate = _env.StorageEstimate != null ? await _env.StorageEstimate() : ((long?)null, (long?)null);
            bool permitted = false;
            await _storage.UpdateStateAsync(_env.Channel, current =>
            {
                ct.ThrowIfCancellationRequested();
                long partialBytes = missing.Sum(f => current.Inventory.TryGetValue(PartialPrefix + f.Sha256, out long n) ? n : 0);
                if (estimate.Item1.HasValue && estimate.Item2.HasValue &&
                    estimate.Item2.Value - estimate.Item1.Value < Math.Max(0, addBytes - partialBytes) * 1.2 + QuotaHeadroomBytes)
                {
                    throw new PatchRejectException(PatchRejectReason.StorageQuota, "Device storage has insufficient headroom; existing content is retained.");
                }
                long now = NowMs();
                var downloads = new Dictionary<string, DownloadReservation>(StringComparer.Ordinal);
                if (current.Downloads != null)
                {
                    foreach (var kv in current.Downloads) if (kv.Value.ExpiresAtMs > now) downloads[kv.Key] = kv.Value;
                }
                var reserved = new Dictionary<string, long>(StringComparer.Ordinal);
                foreach (var f in missing) reserved[f.Sha256] = f.Bytes;
                downloads[owner] = new DownloadReservation(reserved, now + ReservationMs);
                var sizes = new Dictionary<string, long>(StringComparer.Ordinal);
                foreach (var kv in current.Inventory)
                {
                    if (kv.Value < 0) throw new PatchRejectException(PatchRejectReason.StorageStateInvalid, "content size accounting is invalid");
                    string hash = StripPartial(kv.Key);
                    sizes[hash] = (sizes.TryGetValue(hash, out long had) ? had : 0) + kv.Value;
                }
                foreach (var reservation in downloads.Values)
                {
                    foreach (var kv in reservation.Files) sizes[kv.Key] = Math.Max(sizes.TryGetValue(kv.Key, out long had) ? had : 0, kv.Value);
                }
                if (sizes.Values.Sum() > _env.StorageBudgetBytes) return null;
                permitted = true;
                return current.WithDownloads(downloads);
            });
            if (!permitted) throw new PatchRejectException(PatchRejectReason.StorageBudget, "Active, previous, staged, partial and reserved content exceeds the device budget.");
            ct.ThrowIfCancellationRequested();

            // 2. download + verify each object; completed objects survive an interruption (resume)
            long downloaded = 0, highWaterBytes = 0;
            int filesDone = 0, nextIndex = 0;
            bool stopped = false;
            var inFlight = new Dictionary<string, long>(StringComparer.Ordinal);
            var gate = new object();
            void Report()
            {
                long current = downloaded + inFlight.Values.Sum();
                highWaterBytes = Math.Max(highWaterBytes, Math.Min(addBytes, current));
                Emit(PatchPhase.Downloading, filesDone, missing.Count, highWaterBytes, addBytes);
            }
            Emit(PatchPhase.Downloading, 0, missing.Count, 0, addBytes);
            async Task Worker()
            {
                while (true)
                {
                    ManifestFile f;
                    lock (gate)
                    {
                        if (stopped || nextIndex >= missing.Count) return;
                        f = missing[nextIndex++];
                    }
                    try
                    {
                        ct.ThrowIfCancellationRequested();
                        byte[] bytes = await DownloadAsync(f, owner, ct, received =>
                        {
                            lock (gate)
                            {
                                inFlight[f.Sha256] = received;
                                Report();
                            }
                        }, storedKeys.Contains(PartialPrefix + f.Sha256));
                        ct.ThrowIfCancellationRequested();
                        await _storage.PutObjectAsync(f.Sha256, bytes, owner);
                        CheckObject(f, bytes);
                        lock (gate)
                        {
                            verified[f.Sha256] = f.IsJson ? bytes : Array.Empty<byte>();
                            inFlight.Remove(f.Sha256);
                            downloaded += bytes.LongLength;
                            filesDone++;
                            highWaterBytes = Math.Max(highWaterBytes, downloaded);
                            Report();
                        }
                    }
                    catch
                    {
                        lock (gate) stopped = true;
                        throw;
                    }
                }
            }
            int concurrency = Math.Min(MaxConcurrentDownloads, Math.Max(1, missing.Count));
            var workers = new List<Task>(concurrency);
            for (int i = 0; i < concurrency; i++) workers.Add(Worker());
            await AwaitAll(workers);

            // 3. semantic validation of the complete file set, as it would be activated
            Emit(PatchPhase.Verifying, missing.Count, missing.Count, downloaded, addBytes);
            var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var f in m.Files)
            {
                if (BaseHas(f))
                {
                    if (f.IsJson)
                    {
                        byte[] bytes = await _base.ReadAsync(f.Path);
                        if (bytes == null) throw new PatchRejectException(PatchRejectReason.DownloadFailed, $"object for {f.Path} vanished from storage");
                        if (bytes.LongLength != f.Bytes || Sha256Hash.ComputeHex(bytes) != f.Sha256) throw new PatchRejectException(PatchRejectReason.HashMismatch, $"stored object for {f.Path} is damaged");
                        CheckObject(f, bytes);
                        files[f.Path] = bytes;
                    }
                    else
                    {
                        files[f.Path] = Array.Empty<byte>();
                    }
                    continue;
                }
                if (verified.TryGetValue(f.Sha256, out byte[]? cached) && (!f.IsJson || cached.LongLength == f.Bytes))
                {
                    files[f.Path] = cached;
                    continue;
                }
                byte[]? stored = await _storage.GetObjectAsync(f.Sha256);
                if (stored == null) throw new PatchRejectException(PatchRejectReason.DownloadFailed, $"object for {f.Path} vanished from storage");
                if (stored.LongLength != f.Bytes || Sha256Hash.ComputeHex(stored) != f.Sha256) throw new PatchRejectException(PatchRejectReason.HashMismatch, $"stored object for {f.Path} is damaged");
                CheckObject(f, stored);
                files[f.Path] = f.IsJson ? stored : Array.Empty<byte>();
            }
            try
            {
                if (_env.Validate != null) await _env.Validate(files, m, _base);
                ct.ThrowIfCancellationRequested();
            }
            catch (Exception e) when (!(e is OperationCanceledException))
            {
                ct.ThrowIfCancellationRequested();
                await CommitAsync((current, mark) => (current.Deny(m.ReleaseId), mark));
                throw new PatchRejectException(PatchRejectReason.ValidationFailed, e.Message);
            }

            var next = new ActiveRelease(m, IsoNow());
            bool stored2 = await CommitAsync((current, mark) =>
            {
                ct.ThrowIfCancellationRequested();
                if (Predates(mark, m) || PatchState.Contains(current.Denied, m.ReleaseId)) return null;
                var highWater = new GenerationMark(m.Generation, m.ReleaseId, false);
                return (opts.Activate ? current.With(active: next, previous: current.Active, staged: null) : current.With(staged: next), highWater);
            });
            if (!stored2) throw new PatchRejectException(PatchRejectReason.StaleGeneration, "a newer accepted generation won during the download");
            if (!opts.Activate)
            {
                // parked: the objects stay in storage (kept by collect) and the next start switches it on without a network
                return PatchOutcome.StagedRelease(next.ReleaseId, next.Generation, downloaded, missing.Count);
            }

            // 4. atomic activation done; the old active release is the rollback target
            Emit(PatchPhase.Activating, missing.Count, missing.Count, addBytes, addBytes);
            await CollectAsync(new HashSet<string>(m.Files.Select(f => f.Sha256), StringComparer.Ordinal));
            return PatchOutcome.Applied(next.ReleaseId, next.Generation, downloaded, missing.Count);
        }

        /// <summary>
        /// Switches on the staged release without the network: every object must still be in storage and the semantic validation
        /// runs again over the exact file set. Null when nothing is staged; a broken stage is dropped (never half-applied).
        /// </summary>
        public async Task<PatchOutcome?> ActivateStagedAsync(Action<PatchProgress>? onProgress = null, CancellationToken cancellation = default)
        {
            var state = await StateAsync();
            cancellation.ThrowIfCancellationRequested();
            var staged = state.Staged;
            if (staged == null) return null;
            var m = staged.Manifest;
            onProgress?.Invoke(new PatchProgress(PatchPhase.Activating, m.ReleaseId, 0, m.Files.Count, 0, 0));
            try
            {
                Admit(m.Raw, state);
                var highest = await HighWaterAsync();
                if (Predates(highest, m)) throw new PatchRejectException(PatchRejectReason.StaleGeneration, "staged release predates the greatest accepted generation");
                long currentGen = state.Active?.Generation ?? _base.Generation;
                if (m.Generation <= currentGen || PatchState.Contains(state.Denied, m.ReleaseId))
                    throw new PatchRejectException(PatchRejectReason.StaleGeneration, "staged release is no longer newer than the active one");
                var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
                foreach (var f in m.Files)
                {
                    if (BaseHas(f) && !f.IsJson)
                    {
                        files[f.Path] = Array.Empty<byte>();
                        continue;
                    }
                    byte[]? bytes = BaseHas(f) ? await _base.ReadAsync(f.Path) : await _storage.GetObjectAsync(f.Sha256);
                    if (bytes == null || bytes.LongLength != f.Bytes || Sha256Hash.ComputeHex(bytes) != f.Sha256)
                        throw new PatchRejectException(PatchRejectReason.DownloadFailed, $"staged object for {f.Path} is missing or damaged");
                    CheckObject(f, bytes);
                    files[f.Path] = f.IsJson ? bytes : Array.Empty<byte>();
                }
                if (_env.Validate != null) await _env.Validate(files, m, _base);
                cancellation.ThrowIfCancellationRequested();
            }
            catch (Exception e) when (!cancellation.IsCancellationRequested)
            {
                await CommitAsync((current, mark) => (current.With(staged: current.Staged?.ReleaseId == staged.ReleaseId ? null : current.Staged), mark));
                await CollectAsync();
                return e is PatchRejectException r
                    ? PatchOutcome.Rejected(r.Reason, r.Message)
                    : PatchOutcome.Rejected(PatchRejectReason.ValidationFailed, e.Message);
            }
            var next = new ActiveRelease(m, IsoNow());
            bool activated = await CommitAsync((current, mark) =>
            {
                cancellation.ThrowIfCancellationRequested();
                if (current.Staged?.ReleaseId != next.ReleaseId || Predates(mark, m)) return null;
                return (current.With(active: next, previous: current.Active, staged: null), new GenerationMark(next.Generation, next.ReleaseId, false));
            });
            if (!activated) return PatchOutcome.Rejected(PatchRejectReason.StaleGeneration, "staged authority changed before activation");
            await CollectAsync();
            return PatchOutcome.Applied(next.ReleaseId, next.Generation, 0, 0);
        }

        private void CheckObject(ManifestFile file, byte[] bytes)
        {
            if (_env.ValidateObject == null) return;
            try { _env.ValidateObject(file, bytes); }
            catch (Exception e) { throw new PatchRejectException(PatchRejectReason.ValidationFailed, string.IsNullOrEmpty(e.Message) ? "media exceeds the supported resource contract" : e.Message); }
        }

        private async Task<byte[]> DownloadAsync(ManifestFile f, string owner, CancellationToken ct, Action<long> onBytes, bool hasPartial)
        {
            int attempts = Math.Max(1, _env.MaxAttempts);
            string last = "unknown";
            bool checkPartial = hasPartial;
            for (int i = 1; i <= attempts; i++)
            {
                try
                {
                    ct.ThrowIfCancellationRequested();
                    byte[]? saved = checkPartial ? await _storage.GetObjectAsync(PartialPrefix + f.Sha256) : null;
                    byte[]? partial = saved != null && saved.LongLength < f.Bytes ? saved : null;
                    async Task OnPartial(byte[] prefix)
                    {
                        ct.ThrowIfCancellationRequested();
                        checkPartial = true;
                        await _storage.PutObjectAsync(PartialPrefix + f.Sha256, prefix, owner);
                    }
                    byte[] bytes = await Interrupted(_remote.FetchObjectAsync(f.Sha256, f, onBytes, partial, OnPartial, ct), ct);
                    ct.ThrowIfCancellationRequested();
                    if (bytes.LongLength != f.Bytes)
                    {
                        last = $"size {bytes.LongLength} != {f.Bytes}";
                    }
                    else if (Sha256Hash.ComputeHex(bytes) != f.Sha256)
                    {
                        last = "sha256 mismatch";
                        await _storage.DeleteObjectAsync(PartialPrefix + f.Sha256);
                    }
                    else
                    {
                        return bytes;
                    }
                }
                catch (Exception e) when (!(e is StorageQuotaException) && !(e is OperationCanceledException && ct.IsCancellationRequested))
                {
                    ct.ThrowIfCancellationRequested();
                    last = e.Message;
                }
                if (i < attempts)
                {
                    int delay = 250 * (1 << (i - 1));
                    await Interrupted(_env.Sleep != null ? _env.Sleep(delay, ct) : Task.Delay(delay, ct), ct);
                }
            }
            bool hash = last.Contains("mismatch") || last.StartsWith("size", StringComparison.Ordinal);
            throw new PatchRejectException(hash ? PatchRejectReason.HashMismatch : PatchRejectReason.DownloadFailed, $"{f.Path}: {last}");
        }

        /// <summary>GC and reservations share one storage transaction with the pointer snapshot.</summary>
        private async Task CollectAsync(HashSet<string>? extra = null)
        {
            string? raw = await _storage.GetStateAsync();
            var st = ValidState(raw);
            var keep = extra != null ? new HashSet<string>(extra, StringComparer.Ordinal) : new HashSet<string>(StringComparer.Ordinal);
            foreach (var r in new[] { st.Active, st.Previous, st.Staged })
            {
                if (r == null) continue;
                foreach (var f in r.Manifest.Files) keep.Add(f.Sha256);
            }
            await _storage.UpdateStateAsync(_env.Channel, current =>
            {
                if (!string.Equals(current.State, raw, StringComparison.Ordinal)) return null;
                long now = NowMs();
                if (current.Downloads != null)
                {
                    foreach (var reservation in current.Downloads.Values)
                    {
                        if (reservation.ExpiresAtMs > now) foreach (string hash in reservation.Files.Keys) keep.Add(hash);
                    }
                }
                var remove = current.Inventory.Keys.Where(key => !keep.Contains(StripPartial(key))).ToList();
                return current.WithRemoveObjects(remove);
            });
        }

        private string IsoNow() => (_env.Now?.Invoke() ?? DateTimeOffset.UtcNow).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

        private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        private static string StripPartial(string key) => key.StartsWith(PartialPrefix, StringComparison.Ordinal) ? key.Substring(PartialPrefix.Length) : key;

        private static Dictionary<string, DownloadReservation> Copy(IReadOnlyDictionary<string, DownloadReservation>? source)
        {
            var copy = new Dictionary<string, DownloadReservation>(StringComparer.Ordinal);
            if (source != null) foreach (var kv in source) copy[kv.Key] = kv.Value;
            return copy;
        }

        /// <summary>Waits for every worker; rethrows the first failure (a patch reject before a generic error).</summary>
        private static async Task AwaitAll(List<Task> workers)
        {
            try
            {
                await Task.WhenAll(workers);
            }
            catch
            {
                Exception? first = null;
                foreach (var t in workers)
                {
                    if (!t.IsFaulted && !t.IsCanceled) continue;
                    Exception e = t.IsCanceled ? new OperationCanceledException() : t.Exception!.InnerException ?? t.Exception!;
                    if (first == null || (e is PatchRejectException && !(first is PatchRejectException))) first = e;
                }
                if (first != null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(first).Throw();
                throw;
            }
        }

        /// <summary>Returns the work's result, or throws OperationCanceledException as soon as the token fires (the work may ignore it).</summary>
        private static async Task<T> Interrupted<T>(Task<T> work, CancellationToken ct)
        {
            if (!ct.CanBeCanceled || work.IsCompleted) return await work;
            var cancelled = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            using (ct.Register(() => cancelled.TrySetResult(true)))
            {
                var done = await Task.WhenAny(work, cancelled.Task);
                if (done != work)
                {
                    _ = work.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously);
                    throw new OperationCanceledException(ct);
                }
            }
            return await work;
        }

        private static async Task Interrupted(Task work, CancellationToken ct)
        {
            await Interrupted(Wrap(work), ct);
        }

        private static async Task<bool> Wrap(Task work)
        {
            await work;
            return true;
        }
    }
}
