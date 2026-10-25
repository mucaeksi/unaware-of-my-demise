#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using UnityEngine;
using Uomd.Core;
using Uomd.Core.Patching;

namespace Uomd.Tests.EditMode
{
    /// <summary>
    /// C# mirror of packages/patch/src/manager.test.ts and lifecycle.test.ts over the signed scenarios in patch_vectors.json
    /// (tools/export_unity_patch_vectors.ts). Async bodies run on the thread pool so a blocking wait never deadlocks the editor.
    /// </summary>
    public sealed class PatchClientTests
    {
        private const string ChapterIndex = "chapters/chapter_index.json";
        private const string BaseAudio = "audio/bgm_ch1_ash_forest_calm.ogg";
        private const string BaseAtlas = "art/atlas_units.webp";
        private static Dictionary<string, object?>? _vectors;

        private static Dictionary<string, object?> Vectors
        {
            get
            {
                if (_vectors == null)
                {
                    string path = Path.Combine(Application.dataPath, "_UOMD/Tests/EditMode/patch_vectors.json");
                    _vectors = UomdJson.ParseObject(File.ReadAllText(path));
                }
                return _vectors;
            }
        }

        private static TrustKeyJwk Key(string name)
        {
            var k = (Dictionary<string, object?>)Vectors[name]!;
            return new TrustKeyJwk((string)Vectors["kid"]!, "EC", "P-256", (string)k["x"]!, (string)k["y"]!);
        }

        /// <summary>A fresh (deep-copied) parsed manifest graph, safe to tamper with.</summary>
        private static Dictionary<string, object?> Manifest(string name) =>
            UomdJson.ParseObject(CanonicalJson.Serialize(((Dictionary<string, object?>)Vectors["manifests"]!)[name]));

        private static Dictionary<string, byte[]> Objects()
        {
            var o = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var kv in (Dictionary<string, object?>)Vectors["objects"]!) o[kv.Key] = Convert.FromBase64String((string)kv.Value!);
            return o;
        }

        private static readonly Lazy<TestBase> BaseContent = new Lazy<TestBase>(() =>
        {
            var b = (Dictionary<string, object?>)Vectors["base"]!;
            var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var kv in (Dictionary<string, object?>)b["files"]!) files[kv.Key] = Convert.FromBase64String((string)kv.Value!);
            return new TestBase((string)b["release_id"]!, (long)b["generation"]!, files);
        });

        private sealed class TestBase : IBaseContent
        {
            private readonly Dictionary<string, byte[]> _bytes;
            public TestBase(string releaseId, long generation, Dictionary<string, byte[]> bytes)
            {
                ReleaseId = releaseId;
                Generation = generation;
                _bytes = bytes;
                var files = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var kv in bytes) files[kv.Key] = Sha256Hash.ComputeHex(kv.Value);
                Files = files;
            }
            public string ReleaseId { get; }
            public long Generation { get; }
            public IReadOnlyDictionary<string, string> Files { get; }
            public Task<byte[]> ReadAsync(string path) =>
                _bytes.TryGetValue(path, out var b) ? Task.FromResult(b) : throw new FileNotFoundException($"base has no {path}");
        }

        private sealed class FakeRemote : IRemoteSource
        {
            private readonly object _gate = new object();
            private readonly List<string> _fetched = new List<string>();
            public FakeRemote(object? manifest, Dictionary<string, byte[]> objects)
            {
                Manifest = manifest;
                Objects = objects;
            }
            public object? Manifest { get; set; }
            public Dictionary<string, byte[]> Objects { get; }
            public Dictionary<string, int> FailFirst { get; } = new Dictionary<string, int>();
            public HashSet<string> Corrupt { get; } = new HashSet<string>();
            public bool Offline { get; set; }
            public Func<Task<object?>>? ManifestOverride { get; set; }
            /// <summary>Runs before an object is served (gates, partial checks); may replace the bytes.</summary>
            public Func<string, ManifestFile, byte[]?, Func<byte[], Task>?, Task<byte[]?>>? Hook { get; set; }
            public List<string> Fetched { get { lock (_gate) return new List<string>(_fetched); } }
            public void ClearFetched() { lock (_gate) _fetched.Clear(); }

            public Task<object?> FetchManifestAsync(string channel, CancellationToken cancellation)
            {
                if (ManifestOverride != null) return ManifestOverride();
                if (Offline) throw new IOException("network down");
                return Task.FromResult(Manifest);
            }

            public async Task<byte[]> FetchObjectAsync(string sha256, ManifestFile file, Action<long>? onBytes, byte[]? partial, Func<byte[], Task>? onPartial, CancellationToken cancellation)
            {
                lock (_gate) _fetched.Add(file.Path);
                onBytes?.Invoke(file.Bytes / 2);
                if (Hook != null)
                {
                    var replaced = await Hook(sha256, file, partial, onPartial);
                    if (replaced != null) return replaced;
                }
                lock (_gate)
                {
                    if (FailFirst.TryGetValue(sha256, out int left) && left > 0)
                    {
                        FailFirst[sha256] = left - 1;
                        throw new IOException("connection reset");
                    }
                }
                if (!Objects.TryGetValue(sha256, out var bytes)) throw new IOException("404");
                if (Corrupt.Contains(sha256))
                {
                    var c = (byte[])bytes.Clone();
                    c[0] ^= 0xff;
                    return c;
                }
                return bytes;
            }
        }

        private static PatchEnv Env(Action<PatchEnv>? over = null)
        {
            var env = new PatchEnv
            {
                Channel = "staging",
                ClientVersion = "0.1.2",
                SupportedContentSchema = 1,
                TrustedKeys = new[] { Key("trusted_key") },
                InstallId = "install-a",
                StorageBudgetBytes = 120L * 1024 * 1024,
                SupportedCapabilities = new[] { "attributes_v1", "hard_mode_v1", "presentation_v1", "sprite_animation_v1", "world_map_v1" },
                Sleep = (ms, ct) => Task.CompletedTask
            };
            over?.Invoke(env);
            return env;
        }

        private sealed class Rig
        {
            public Rig(UomdPatchClient client, FakeRemote remote, MemoryContentStorage storage, ContentManifest manifest)
            {
                Client = client;
                Remote = remote;
                Storage = storage;
                Manifest = manifest;
            }
            public UomdPatchClient Client { get; }
            public FakeRemote Remote { get; }
            public MemoryContentStorage Storage { get; }
            public ContentManifest Manifest { get; }
            public UomdPatchClient Fresh(Action<PatchEnv>? over = null, IRemoteSource? remote = null) => new UomdPatchClient(Env(over), Storage, remote ?? Remote, BaseContent.Value);
        }

        private static (UomdPatchClient Client, FakeRemote Remote) SetupOn(IContentStorage storage, string manifest = "r2", Action<PatchEnv>? over = null)
        {
            var remote = new FakeRemote(Manifest(manifest), Objects());
            return (new UomdPatchClient(Env(over), storage, remote, BaseContent.Value), remote);
        }

        private static Rig Setup(string manifest = "r2", Action<PatchEnv>? over = null, MemoryContentStorage? storage = null)
        {
            var raw = Manifest(manifest);
            var remote = new FakeRemote(raw, Objects());
            var store = storage ?? new MemoryContentStorage();
            return new Rig(new UomdPatchClient(Env(over), store, remote, BaseContent.Value), remote, store, ContentManifest.Parse(raw));
        }

        private static void Run(Func<Task> body) => Task.Run(body).GetAwaiter().GetResult();

        private static int Chapters(byte[] json) => ((List<object?>)UomdJson.ParseObject(Encoding.UTF8.GetString(json))["chapters"]!).Count;

        private static void Expect(PatchOutcome outcome, PatchStatus status, string? reason = null)
        {
            Assert.AreEqual(status, outcome.Status, outcome.ToString());
            if (reason != null) Assert.AreEqual(reason, outcome.Reason, outcome.ToString());
        }

        private static async Task Throws<T>(Func<Task> body) where T : Exception
        {
            try { await body(); }
            catch (T) { return; }
            Assert.Fail($"expected {typeof(T).Name}");
        }

        // ------------------------------------------------------------------------------------- manager.test.ts

        [Test]
        public void AppliesSignedPatchDownloadsOnlyMissingBytesAndServesOverlay() => Run(async () =>
        {
            var rig = Setup();
            var outcome = await rig.Client.CheckAndApplyAsync();
            Expect(outcome, PatchStatus.Applied);
            Assert.AreEqual("rel_0002", outcome.ReleaseId);
            Assert.AreEqual(2, outcome.Generation);
            CollectionAssert.DoesNotContain(rig.Remote.Fetched, BaseAtlas, "base-identical files are never downloaded");
            Assert.AreEqual("rel_0002", (await rig.Client.StateAsync()).Active?.ReleaseId);
            Assert.AreEqual(2, Chapters(await rig.Client.ReadAsync(ChapterIndex)));
            Assert.AreEqual(2400, (await rig.Client.ReadAsync(BaseAudio)).Length, "an untouched path still comes from the base");
            Assert.AreEqual(("patch", rig.Manifest.FindFile(ChapterIndex)!.Sha256), await rig.Client.LocateAsync(ChapterIndex));
            Assert.AreEqual("base", (await rig.Client.LocateAsync(BaseAudio)).Source);
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.UpToDate);
        });

        [Test]
        public void FullSnapshotReadsBaseIdenticalFilesWithoutDownloading() => Run(async () =>
        {
            var rig = Setup("r2_snapshot");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Applied);
            CollectionAssert.DoesNotContain(rig.Remote.Fetched, BaseAudio);
            CollectionAssert.AreEqual(await BaseContent.Value.ReadAsync(BaseAudio), await rig.Client.ReadAsync(BaseAudio));
            Assert.AreEqual("rel_0002", (await rig.Client.StateAsync()).Active?.ReleaseId);
        });

        [Test]
        public void SelfContainedSnapshotDoesNotServeUndeclaredBaseFiles() => Run(async () =>
        {
            var rig = Setup("r2_self_contained");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Applied);
            await Throws<KeyNotFoundException>(() => rig.Client.ReadAsync(BaseAudio));
            await Throws<KeyNotFoundException>(() => rig.Client.LocateAsync(BaseAudio));
        });

        [Test]
        public void RejectsUntrustedSignatureAndLeavesStateUntouched() => Run(async () =>
        {
            var rig = Setup(over: e => e.TrustedKeys = new[] { Key("other_key") });
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.BadSignature);
            Assert.IsNull(rig.Storage.State);
        });

        [Test]
        public void RejectsTamperedManifestContents() => Run(async () =>
        {
            var rig = Setup();
            var tampered = Manifest("r2");
            ((Dictionary<string, object?>)tampered["release"]!)["notes"] = "evil";
            rig.Remote.Manifest = tampered;
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.BadSignature);
        });

        [Test]
        public void RejectsUnsignedManifestsAndHostilePaths() => Run(async () =>
        {
            var rig = Setup("r2_unsigned");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.BadSignature);
            foreach (string hostile in new[] { "../../escape.json", "/abs.json", "a/./b.json", "a/.hidden.json", "a\\b.json", "x.exe" })
            {
                var m = Manifest("r2");
                ((Dictionary<string, object?>)((List<object?>)m["files"]!)[0]!)["path"] = hostile;
                rig.Remote.Manifest = m;
                Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.MalformedManifest);
            }
        });

        [Test]
        public void RetriesFlakyDownloadAndRejectsPersistentCorruption() => Run(async () =>
        {
            var flaky = Setup();
            flaky.Remote.FailFirst[flaky.Manifest.FindFile("encounters/stage_1_1.json")!.Sha256] = 2;
            Expect(await flaky.Client.CheckAndApplyAsync(), PatchStatus.Applied);

            var bad = Setup();
            string target = bad.Manifest.FindFile("encounters/stage_1_2.json")!.Sha256;
            bad.Remote.Corrupt.Add(target);
            Expect(await bad.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.HashMismatch);
            Assert.IsNull((await bad.Client.StateAsync()).Active);
            Assert.IsFalse(await bad.Storage.HasObjectAsync(target), "the corrupt object was never stored");
        });

        [Test]
        public void ResumesAfterInterruptionWithoutDownloadingStoredObjectsAgain() => Run(async () =>
        {
            var rig = Setup();
            var last = rig.Manifest.Files[rig.Manifest.Files.Count - 1];
            rig.Remote.FailFirst[last.Sha256] = 99;
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.DownloadFailed);
            Assert.Greater((await rig.Storage.ListObjectsAsync()).Count, 0);
            rig.Remote.FailFirst.Clear();
            rig.Remote.ClearFetched();
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Applied);
            Assert.Less(rig.Remote.Fetched.Count, rig.Manifest.Files.Count);
        });

        [Test]
        public void EnforcesCompatibility() => Run(async () =>
        {
            Expect(await Setup(over: e => e.ClientVersion = "0.0.9").Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.ClientTooOld);
            Expect(await Setup("r2_max_client", e => e.ClientVersion = "2.0.0").Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.ClientTooNew);
            Expect(await Setup("r2_dev").Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.WrongChannel);
            Expect(await Setup("r2_schema2").Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.SchemaTooNew);
            Expect(await Setup("r2_dep_mismatch").Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.DependencyMismatch);
            var cap = Setup("r2_capability");
            Expect(await cap.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.CapabilityMissing);
            Assert.IsEmpty(cap.Remote.Fetched, "no object is requested before admission");
        });

        [Test]
        public void RefusesDowngradesAndPatchesOverTheStorageBudget() => Run(async () =>
        {
            Expect(await Setup("g1_stale").Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            Expect(await Setup(over: e => e.StorageBudgetBytes = 100).Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StorageBudget);
        });

        [Test]
        public void ValidationFailureKeepsOldReleaseAndDeniesTheNewOne() => Run(async () =>
        {
            var rig = Setup(over: e => e.Validate = (files, m, b) => throw new InvalidDataException("encounter references unknown unit"));
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.ValidationFailed);
            var st = await rig.Client.StateAsync();
            Assert.IsNull(st.Active);
            CollectionAssert.Contains(st.Denied.ToList(), "rel_0002");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.DeniedRelease);
        });

        [Test]
        public void ValidationSeesJsonBytesAndEmptyMedia() => Run(async () =>
        {
            IReadOnlyDictionary<string, byte[]>? seen = null;
            var rig = Setup(over: e => e.Validate = (files, m, b) => { seen = files; return Task.CompletedTask; });
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Applied);
            Assert.IsNotNull(seen);
            Assert.AreEqual(rig.Manifest.Files.Count, seen!.Count);
            Assert.AreEqual(2, Chapters(seen[ChapterIndex]));
            Assert.AreEqual(0, seen[BaseAtlas].Length);
            Assert.AreEqual(0, seen["art/bg_ash_forest.webp"].Length);
        });

        [Test]
        public void OfflineKeepsServingTheActiveRelease() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync();
            rig.Remote.Offline = true;
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Offline);
            Assert.AreEqual(2, Chapters(await rig.Client.ReadAsync(ChapterIndex)));
        });

        [Test]
        public void PercentageRolloutBucketsMatchTheReferenceClient() => Run(async () =>
        {
            int applied = 0;
            foreach (object? item in (List<object?>)Vectors["rollout"]!)
            {
                var row = (Dictionary<string, object?>)item!;
                string install = (string)row["install_id"]!;
                long bucket = (long)row["bucket"]!;
                Assert.AreEqual(bucket, UomdPatchClient.RolloutBucket(install, "rel_0002"), install);
                var outcome = await Setup("r2_rollout50", e => e.InstallId = install).Client.CheckAndApplyAsync();
                Assert.AreEqual(bucket < 50 ? PatchStatus.Applied : PatchStatus.UpToDate, outcome.Status, install);
                if (outcome.Status == PatchStatus.Applied) applied++;
            }
            Assert.Greater(applied, 8);
            Assert.Less(applied, 32);
            Expect(await Setup("r2_rollout0").Client.CheckAndApplyAsync(), PatchStatus.UpToDate);
        });

        [Test]
        public void KillSwitchReturnsToTheEmbeddedBase() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync();
            rig.Remote.Manifest = Manifest("kill3");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.RevertedToBase);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
            Assert.AreEqual(1, Chapters(await rig.Client.ReadAsync(ChapterIndex)));
        });

        [Test]
        public void RollsBackWhenAStoredObjectIsCorruptedOnDisk() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync();
            var victim = (await rig.Client.StateAsync()).Active!.Manifest.FindFile(ChapterIndex)!;
            await rig.Storage.PutObjectAsync(victim.Sha256, Encoding.UTF8.GetBytes("{\"tampered\":true}"));
            Assert.AreEqual(1, Chapters(await rig.Client.ReadAsync(ChapterIndex)), "detects, rolls back, serves base");
            var st = await rig.Client.StateAsync();
            Assert.IsNull(st.Active);
            CollectionAssert.Contains(st.Denied.ToList(), "rel_0002");
        });

        [Test]
        public void ReportsMonotonicProgress() => Run(async () =>
        {
            var rig = Setup();
            var seen = new List<PatchProgress>();
            var outcome = await rig.Client.CheckAndApplyAsync(new ApplyOptions { OnProgress = p => { lock (seen) seen.Add(p); } });
            Expect(outcome, PatchStatus.Applied);
            Assert.AreEqual(PatchPhase.Checking, seen[0].Phase);
            foreach (string phase in new[] { PatchPhase.Checking, PatchPhase.Downloading, PatchPhase.Verifying, PatchPhase.Activating })
                Assert.IsTrue(seen.Any(p => p.Phase == phase), phase);
            var dl = seen.Where(p => p.Phase == PatchPhase.Downloading).ToList();
            long total = dl[0].BytesTotal;
            Assert.Greater(total, 0);
            Assert.AreEqual(dl[dl.Count - 1].BytesTotal, dl[dl.Count - 1].BytesDone);
            Assert.AreEqual(dl[dl.Count - 1].FilesTotal, dl[dl.Count - 1].FilesDone);
            long last = 0;
            foreach (var p in dl)
            {
                Assert.LessOrEqual(p.BytesDone, total);
                Assert.GreaterOrEqual(p.BytesDone, last, "the byte counter never moves backwards");
                last = p.BytesDone;
            }
        });

        [Test]
        public void StagedReleaseActivatesAtNextStartWithoutNetwork() => Run(async () =>
        {
            var rig = Setup();
            var outcome = await rig.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false });
            Expect(outcome, PatchStatus.Staged);
            Assert.AreEqual("rel_0002", outcome.ReleaseId);
            var st = await rig.Client.StateAsync();
            Assert.IsNull(st.Active);
            Assert.AreEqual("rel_0002", st.Staged?.ReleaseId);
            Assert.AreEqual(1, Chapters(await rig.Client.ReadAsync(ChapterIndex)));

            rig.Remote.Offline = true;
            rig.Remote.ClearFetched();
            var activated = await rig.Client.ActivateStagedAsync();
            Expect(activated!, PatchStatus.Applied);
            Assert.IsEmpty(rig.Remote.Fetched);
            var after = await rig.Client.StateAsync();
            Assert.AreEqual("rel_0002", after.Active?.ReleaseId);
            Assert.IsNull(after.Staged);
            Assert.AreEqual(2, Chapters(await rig.Client.ReadAsync(ChapterIndex)));
            Assert.IsNull(await rig.Client.ActivateStagedAsync());
        });

        [Test]
        public void StagedReleaseIsActivatedFromStorageByANormalCheck() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false });
            rig.Remote.ClearFetched();
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Applied);
            Assert.IsEmpty(rig.Remote.Fetched);
        });

        [Test]
        public void DamagedStagedObjectDropsTheStage() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false });
            await rig.Storage.PutObjectAsync(rig.Manifest.FindFile(ChapterIndex)!.Sha256, Encoding.UTF8.GetBytes("{\"tampered\":true}"));
            Expect((await rig.Client.ActivateStagedAsync())!, PatchStatus.Rejected, PatchRejectReason.DownloadFailed);
            var st = await rig.Client.StateAsync();
            Assert.IsNull(st.Active);
            Assert.IsNull(st.Staged);
        });

        [Test]
        public void StagedObjectsSurviveGarbageCollection() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false });
            var staged = rig.Manifest.Files.Where(f => BaseContent.Value.Files.TryGetValue(f.Path, out string? h) ? h != f.Sha256 : true).Select(f => f.Sha256).ToList();
            Assert.Greater(staged.Count, 0);
            foreach (string h in staged) Assert.IsTrue(await rig.Storage.HasObjectAsync(h));
            Assert.IsFalse(await rig.Client.RollbackAsync());
            foreach (string h in staged) Assert.IsTrue(await rig.Storage.HasObjectAsync(h));
        });

        [Test]
        public void RejectsAnOlderAuthenticKillAfterAHigherGeneration() => Run(async () =>
        {
            var rig = Setup("r4");
            await rig.Client.CheckAndApplyAsync();
            rig.Remote.Manifest = Manifest("kill2");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            Assert.AreEqual("rel_0004", (await rig.Client.StateAsync()).Active?.ReleaseId);
        });

        [Test]
        public void FreshClientRemembersTheKillGeneration() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync();
            rig.Remote.Manifest = Manifest("kill3");
            await rig.Client.CheckAndApplyAsync();
            rig.Remote.Manifest = Manifest("r2");
            Expect(await rig.Fresh().CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
        });

        [Test]
        public void KeepsTheGreatestGenerationAfterLocalRollback() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync();
            rig.Remote.Manifest = Manifest("r4");
            await rig.Client.CheckAndApplyAsync();
            await rig.Client.RollbackAsync();
            Assert.AreEqual(2, (await rig.Client.StateAsync()).Active?.Generation);
            rig.Remote.Manifest = Manifest("r3");
            Expect(await rig.Fresh().CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            Assert.AreEqual(2, (await rig.Client.StateAsync()).Active?.Generation);
        });

        [Test]
        public void AllowsANewerSignedReleaseAfterRollback() => Run(async () =>
        {
            var rig = Setup("r4");
            await rig.Client.CheckAndApplyAsync();
            await rig.Client.RollbackAsync();
            rig.Remote.Manifest = Manifest("rollback5");
            var outcome = await rig.Client.CheckAndApplyAsync();
            Expect(outcome, PatchStatus.Applied);
            Assert.AreEqual(5, outcome.Generation);
            Assert.AreEqual(5, (await rig.Storage.GetHighWaterAsync("staging"))!.Generation);
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.UpToDate);
        });

        [Test]
        public void KeepsAuthorityWhenTheOverlayStateIsLostAndIsolatesChannels() => Run(async () =>
        {
            var rig = Setup("r4");
            await rig.Client.CheckAndApplyAsync();
            Assert.IsNull(await rig.Storage.GetHighWaterAsync("dev"));
            foreach (string? state in new[] { null, "{\"schema\":99}", "not json" })
            {
                rig.Storage.State = state;
                rig.Remote.Manifest = Manifest("r3");
                Expect(await rig.Fresh().CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
                Assert.AreEqual(4, (await rig.Storage.GetHighWaterAsync("staging"))!.Generation);
            }
        });

        [Test]
        public void MigratesTheRetainedOverlayGenerationBeforeAdmittingAnOlderKill() => Run(async () =>
        {
            var rig = Setup("r4");
            await rig.Client.CheckAndApplyAsync();
            rig.Storage.ClearHighWater();
            rig.Remote.Manifest = Manifest("kill3");
            Expect(await rig.Fresh().CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            Assert.AreEqual(4, (await rig.Storage.GetHighWaterAsync("staging"))!.Generation);
        });

        [Test]
        public void KillClearsStagedContentAndKeepsItsTombstone() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false });
            rig.Remote.Manifest = Manifest("kill3");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.RevertedToBase);
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.RevertedToBase);
            Assert.IsNull(await rig.Fresh().ActivateStagedAsync());
            rig.Remote.Manifest = Manifest("different3");
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            var mark = await rig.Storage.GetHighWaterAsync("staging");
            Assert.AreEqual(3, mark!.Generation);
            Assert.IsTrue(mark.Killed);
        });

        [Test]
        public void RejectsTamperedStoredStagesWithoutRaisingTheTrustedGeneration() => Run(async () =>
        {
            var rig = Setup();
            await rig.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false });
            var state = UomdJson.ParseObject(rig.Storage.State!);
            var release = (Dictionary<string, object?>)((Dictionary<string, object?>)((Dictionary<string, object?>)state["staged"]!)["manifest"]!)["release"]!;
            release["generation"] = 100L;
            rig.Storage.State = CanonicalJson.Serialize(state);
            var restarted = rig.Fresh();
            Assert.IsNull(await restarted.ActivateStagedAsync());
            rig.Remote.Manifest = Manifest("r3");
            var outcome = await restarted.CheckAndApplyAsync();
            Expect(outcome, PatchStatus.Applied);
            Assert.AreEqual(3, outcome.Generation);
        });

        [Test]
        public void FailsClosedWhenTheAcceptedGenerationRecordIsDamaged() => Run(async () =>
        {
            var rig = Setup();
            rig.Storage.SetHighWater("staging", new GenerationMark(0, "damaged", false));
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StorageStateInvalid);
            Assert.IsNull(rig.Storage.State);
        });

        [Test]
        public void FencesADelayedDownloadAgainstANewerKill() => Run(async () =>
        {
            var rig = Setup("r3");
            var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            var gate = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            rig.Remote.Hook = async (sha, file, partial, onPartial) =>
            {
                started.TrySetResult(true);
                await gate.Task;
                return null;
            };
            var applying = rig.Client.CheckAndApplyAsync();
            await started.Task;
            var killer = rig.Fresh(remote: new FakeRemote(Manifest("kill4"), new Dictionary<string, byte[]>()));
            Expect(await killer.CheckAndApplyAsync(), PatchStatus.RevertedToBase);
            gate.SetResult(true);
            Expect(await applying, PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
            var mark = await rig.Storage.GetHighWaterAsync("staging");
            Assert.AreEqual(4, mark!.Generation);
            Assert.IsTrue(mark.Killed);
        });

        [Test]
        public void VerifiesCachedObjectBytesBeforeReuse() => Run(async () =>
        {
            var rig = Setup();
            var victim = rig.Manifest.Files.First(f => !BaseContent.Value.Files.ContainsKey(f.Path));
            await rig.Storage.PutObjectAsync(victim.Sha256, new byte[victim.Bytes]);
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.HashMismatch);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
        });

        // ----------------------------------------------------------------------------------- lifecycle.test.ts

        [Test]
        public void CancelsAHangingSourceAndIgnoresItsLateSuccess() => Run(async () =>
        {
            var rig = Setup();
            var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            var complete = new TaskCompletionSource<byte[]?>(TaskCreationOptions.RunContinuationsAsynchronously);
            rig.Remote.Hook = (sha, file, partial, onPartial) => { started.TrySetResult(true); return complete.Task; };
            using var cancel = new CancellationTokenSource();
            var pending = rig.Client.CheckAndApplyAsync(new ApplyOptions { Cancellation = cancel.Token });
            await started.Task;
            cancel.Cancel();
            Expect(await pending, PatchStatus.Rejected, PatchRejectReason.Cancelled);
            var first = rig.Manifest.Files.First(f => !BaseContent.Value.Files.ContainsKey(f.Path));
            complete.SetResult(rig.Remote.Objects[first.Sha256]);
            await Task.Delay(20);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
            Assert.IsFalse(await rig.Storage.HasObjectAsync(first.Sha256));
        });

        [Test]
        public void TimesOutASourceThatIgnoresCancellation() => Run(async () =>
        {
            var rig = Setup(over: e => e.DownloadTimeoutMs = 30);
            rig.Remote.ManifestOverride = () => new TaskCompletionSource<object?>().Task;
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.DownloadTimeout);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
        });

        [Test]
        public void RequiresMeteredConsentAndRefusesLowStorageQuota() => Run(async () =>
        {
            var metered = Setup(over: e => e.NetworkPolicy = () => PatchNetwork.Metered);
            Expect(await metered.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.NetworkPolicy);
            Assert.IsEmpty(metered.Remote.Fetched);
            Expect(await metered.Client.CheckAndApplyAsync(new ApplyOptions { AllowMetered = true }), PatchStatus.Applied);
            var quota = Setup(over: e => e.StorageEstimate = () => Task.FromResult<(long?, long?)>((99, 100)));
            Expect(await quota.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StorageQuota);
            Assert.IsEmpty(quota.Remote.Fetched);
            Expect(await Setup(over: e => e.NetworkPolicy = () => PatchNetwork.Offline).Client.CheckAndApplyAsync(), PatchStatus.Offline);
        });

        [Test]
        public void ResumesARetainedPrefixButHashesTheCompleteObject() => Run(async () =>
        {
            var rig = Setup();
            var file = rig.Manifest.FindFile("art/bg_ash_forest.webp")!;
            byte[] full = rig.Remote.Objects[file.Sha256];
            await rig.Storage.PutObjectAsync("partial:" + file.Sha256, full.Take(4).ToArray());
            byte[]? seenPartial = null;
            rig.Remote.Hook = (sha, f, partial, onPartial) =>
            {
                if (sha == file.Sha256) seenPartial = partial;
                return Task.FromResult<byte[]?>(null);
            };
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Applied);
            CollectionAssert.AreEqual(full.Take(4).ToArray(), seenPartial);
            Assert.IsFalse(await rig.Storage.HasObjectAsync("partial:" + file.Sha256));
            CollectionAssert.AreEqual(full, await rig.Storage.GetObjectAsync(file.Sha256));
        });

        [Test]
        public void ReservationProtectsAnInFlightDownloadFromCompetingStorage() => Run(async () =>
        {
            var storage = new MemoryContentStorage();
            var r2 = ContentManifest.Parse(Manifest("r2"));
            long r2Missing = r2.Files.Where(f => !BaseContent.Value.Files.ContainsKey(f.Path) || BaseContent.Value.Files[f.Path] != f.Sha256).Sum(f => f.Bytes);
            long budget = r2Missing + 10;
            var slow = Setup("r2", e => e.StorageBudgetBytes = budget, storage);
            var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            var gate = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            var big = r2.FindFile("art/bg_ash_forest.webp")!;
            slow.Remote.Hook = async (sha, f, partial, onPartial) =>
            {
                if (sha != big.Sha256) return null;
                await onPartial!(slow.Remote.Objects[sha].Take(3).ToArray());
                started.TrySetResult(true);
                await gate.Task;
                return null;
            };
            var first = slow.Client.CheckAndApplyAsync();
            await started.Task;
            var competitor = Setup("r3_alt", e => e.StorageBudgetBytes = budget, storage);
            Expect(await competitor.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StorageBudget);
            Assert.IsTrue(await storage.HasObjectAsync("partial:" + big.Sha256));
            gate.SetResult(true);
            Expect(await first, PatchStatus.Applied);
        });

        [Test]
        public void ChargesActiveAndPreviousTogether() => Run(async () =>
        {
            var storage = new MemoryContentStorage();
            Expect(await Setup("r2", null, storage).Client.CheckAndApplyAsync(), PatchStatus.Applied);
            long used = (await storage.ListObjectsAsync()).Sum(k => storage.GetObjectAsync(k).Result!.LongLength);
            Expect(await Setup("r3_alt", e => e.StorageBudgetBytes = used + 100, storage).Client.CheckAndApplyAsync(new ApplyOptions { Activate = false }), PatchStatus.Rejected, PatchRejectReason.StorageBudget);
            var st = await Setup("r2", null, storage).Client.StateAsync();
            Assert.AreEqual("rel_0002", st.Active?.ReleaseId);
            Assert.AreEqual(used, (await storage.ListObjectsAsync()).Sum(k => storage.GetObjectAsync(k).Result!.LongLength), "healthy objects are retained");
        });

        private sealed class QuotaStorage : IContentStorage
        {
            private readonly MemoryContentStorage _inner;
            private readonly string _failOn;
            public QuotaStorage(MemoryContentStorage inner, string failOn) { _inner = inner; _failOn = failOn; }
            public Task<byte[]?> GetObjectAsync(string key) => _inner.GetObjectAsync(key);
            public Task PutObjectAsync(string key, byte[] bytes, string? reservation = null) =>
                key == _failOn ? throw new StorageQuotaException("Synthetic low disk fault") : _inner.PutObjectAsync(key, bytes, reservation);
            public Task<bool> HasObjectAsync(string key) => _inner.HasObjectAsync(key);
            public Task<IReadOnlyList<string>> ListObjectsAsync() => _inner.ListObjectsAsync();
            public Task DeleteObjectAsync(string key) => _inner.DeleteObjectAsync(key);
            public Task<string?> GetStateAsync() => _inner.GetStateAsync();
            public Task<GenerationMark?> GetHighWaterAsync(string channel) => _inner.GetHighWaterAsync(channel);
            public Task<bool> UpdateStateAsync(string channel, Func<StorageSnapshot, StorageSnapshot?> change) => _inner.UpdateStateAsync(channel, change);
        }

        [Test]
        public void RetainsTheHealthyStateWhenStorageIsFull() => Run(async () =>
        {
            var storage = new MemoryContentStorage();
            Expect(await Setup("r2", null, storage).Client.CheckAndApplyAsync(), PatchStatus.Applied);
            string? original = storage.State;
            var alt = ContentManifest.Parse(Manifest("r3_alt"));
            var remote = new FakeRemote(Manifest("r3_alt"), Objects());
            var client = new UomdPatchClient(Env(), new QuotaStorage(storage, alt.Files[0].Sha256), remote, BaseContent.Value);
            Expect(await client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StorageQuota);
            Assert.AreEqual(original, storage.State);
        });

        [Test]
        public void RefusesAHashValidResourceThatFailsObjectValidation() => Run(async () =>
        {
            var rig = Setup(over: e => e.ValidateObject = (f, b) => throw new InvalidDataException("Synthetic oversized bitmap"));
            Expect(await rig.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.ValidationFailed);
            Assert.IsNull((await rig.Client.StateAsync()).Active);
        });

        // ------------------------------------------------------------------------------------ manifest schema

        [Test]
        public void ManifestParserIsStrict()
        {
            Assert.DoesNotThrow(() => ContentManifest.Parse(Manifest("r2")));
            void Rejects(Action<Dictionary<string, object?>> tamper, string why)
            {
                var m = Manifest("r2");
                tamper(m);
                Assert.Throws<ManifestFormatException>(() => ContentManifest.Parse(m), why);
            }
            Dictionary<string, object?> File0(Dictionary<string, object?> m) => (Dictionary<string, object?>)((List<object?>)m["files"]!)[0]!;
            Dictionary<string, object?> Release(Dictionary<string, object?> m) => (Dictionary<string, object?>)m["release"]!;
            Rejects(m => m["extra"] = 1L, "unknown top-level key");
            Rejects(m => m["schema_version"] = 2L, "schema version");
            Rejects(m => File0(m)["sha256"] = "ABC", "bad hash");
            Rejects(m => File0(m)["bytes"] = 0L, "empty file");
            Rejects(m => File0(m)["bytes"] = 1.5, "fractional size");
            Rejects(m => File0(m)["media_type"] = "image/png", "media type mismatch");
            Rejects(m => File0(m)["kind"] = "binary", "unknown kind");
            Rejects(m => ((List<object?>)m["files"]!).Add(File0(m)), "duplicate path");
            Rejects(m => Release(m)["id"] = "Rel-2", "id pattern");
            Rejects(m => Release(m)["generation"] = 0L, "generation >= 1");
            Rejects(m => Release(m)["created_at"] = "2026-10-25 00:00:00", "datetime");
            Rejects(m => Release(m)["channel"] = "beta", "channel");
            Rejects(m => ((Dictionary<string, object?>)m["compat"]!)["min_client"] = "1.0", "semver");
            Rejects(m => ((Dictionary<string, object?>)m["compat"]!)["max_client"] = "0.0.1", "empty client range");
            Rejects(m => ((Dictionary<string, object?>)m["depends_on"]!)["generation"] = 2L, "dependency generation");
            Rejects(m => ((Dictionary<string, object?>)m["rollout"]!)["percent"] = 101L, "rollout percent");
            Rejects(m => m["files"] = new List<object?>(), "no files");
        }
    
        // ----------------------------------------------------------------------------- FileContentStorage

        private static string TempRoot()
        {
            string root = Path.Combine(Path.GetTempPath(), "uomd-patch-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            return root;
        }

        [Test]
        public void FileStoragePersistsStateAndAuthorityAcrossRestarts() => Run(async () =>
        {
            string root = TempRoot();
            try
            {
                var first = SetupOn(new FileContentStorage(root));
                Expect(await first.Client.CheckAndApplyAsync(), PatchStatus.Applied);
                Assert.IsEmpty(Directory.GetFiles(root, "*.tmp", SearchOption.AllDirectories), "no temporary file survives a commit");

                var restarted = SetupOn(new FileContentStorage(root), "r2");
                Assert.AreEqual("rel_0002", (await restarted.Client.StateAsync()).Active?.ReleaseId);
                Assert.AreEqual(2, Chapters(await restarted.Client.ReadAsync(ChapterIndex)));
                Expect(await restarted.Client.CheckAndApplyAsync(), PatchStatus.UpToDate);
                Assert.IsEmpty(restarted.Remote.Fetched);

                var storage = new FileContentStorage(root);
                var index = ContentManifest.Parse(Manifest("r2")).FindFile(ChapterIndex)!;
                Assert.IsNotNull(storage.ObjectPath(index.Sha256));
                var killed = SetupOn(storage, "kill3");
                Expect(await killed.Client.CheckAndApplyAsync(), PatchStatus.RevertedToBase);
                var replay = SetupOn(new FileContentStorage(root), "r2");
                Expect(await replay.Client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StaleGeneration);
                var mark = await new FileContentStorage(root).GetHighWaterAsync("staging");
                Assert.AreEqual(3, mark!.Generation);
                Assert.IsTrue(mark.Killed);
            }
            finally { Directory.Delete(root, true); }
        });

        [Test]
        public void FileStorageStagesResumesAndCollectsGarbage() => Run(async () =>
        {
            string root = TempRoot();
            try
            {
                var storage = new FileContentStorage(root);
                var m = ContentManifest.Parse(Manifest("r2"));
                var big = m.FindFile("art/bg_ash_forest.webp")!;
                await storage.PutObjectAsync("partial:" + big.Sha256, Objects()[big.Sha256].Take(10).ToArray());
                Assert.IsTrue(File.Exists(Path.Combine(root, "objects", "partial-" + big.Sha256)));
                CollectionAssert.Contains((await storage.ListObjectsAsync()).ToList(), "partial:" + big.Sha256);
                var staged = SetupOn(storage);
                Expect(await staged.Client.CheckAndApplyAsync(new ApplyOptions { Activate = false }), PatchStatus.Staged);
                Assert.IsFalse(await storage.HasObjectAsync("partial:" + big.Sha256), "the completed object replaces its prefix");

                var boot = SetupOn(new FileContentStorage(root));
                boot.Remote.Offline = true;
                Expect((await boot.Client.ActivateStagedAsync())!, PatchStatus.Applied);
                var alt = SetupOn(new FileContentStorage(root), "r4");
                Expect(await alt.Client.CheckAndApplyAsync(), PatchStatus.Applied);
                await alt.Client.RollbackAsync();
                await alt.Client.RollbackAsync();
                Assert.IsEmpty(await new FileContentStorage(root).ListObjectsAsync(), "objects of denied releases are collected");
            }
            finally { Directory.Delete(root, true); }
        });

        [Test]
        public void FileStorageFailsClosedOnAnUnreadableRecord() => Run(async () =>
        {
            string root = TempRoot();
            try
            {
                Expect(await SetupOn(new FileContentStorage(root)).Client.CheckAndApplyAsync(), PatchStatus.Applied);
                File.WriteAllText(Path.Combine(root, "state.json"), "{ torn");
                var client = SetupOn(new FileContentStorage(root), "r3").Client;
                Expect(await client.CheckAndApplyAsync(), PatchStatus.Rejected, PatchRejectReason.StorageStateInvalid);
                Assert.IsNull((await client.StateAsync()).Active, "an unreadable record serves the embedded base");
                Assert.AreEqual(1, Chapters(await client.ReadAsync(ChapterIndex)));
                Assert.Throws<ArgumentException>(() => new FileContentStorage(root).ObjectPath("../state.json"));
            }
            finally { Directory.Delete(root, true); }
        });
    
        // ------------------------------------------------------------------------------ UomdContentOverlay

        [Test]
        public void OverlayFollowsDependentSnapshotAndStaleBaseRules() => Run(async () =>
        {
            var files = BaseContent.Value.Files;
            var dependent = Setup("r2");
            await dependent.Client.CheckAndApplyAsync();
            var st = await dependent.Client.StateAsync();
            Assert.IsTrue(UomdContentOverlay.Resolve(st, files, ChapterIndex)!.Value.FromPatch);
            Assert.IsFalse(UomdContentOverlay.Resolve(st, files, BaseAtlas)!.Value.FromPatch, "a base-identical file is served from the base");
            Assert.IsFalse(UomdContentOverlay.Resolve(st, files, BaseAudio)!.Value.FromPatch, "a dependent overlay inherits the base");
            Assert.IsNull(UomdContentOverlay.Resolve(st, files, "art/none.webp"));

            var snapshot = Setup("r2_snapshot");
            await snapshot.Client.CheckAndApplyAsync();
            st = await snapshot.Client.StateAsync();
            Assert.IsFalse(UomdContentOverlay.BuiltOnOlderBase(st.Active!.Manifest, files));
            Assert.IsTrue(UomdContentOverlay.Resolve(st, files, ChapterIndex)!.Value.FromPatch);
            Assert.IsFalse(UomdContentOverlay.Resolve(st, files, BaseAudio)!.Value.FromPatch);

            var stale = Setup("r2_self_contained");
            await stale.Client.CheckAndApplyAsync();
            st = await stale.Client.StateAsync();
            Assert.IsTrue(UomdContentOverlay.BuiltOnOlderBase(st.Active!.Manifest, files), "it omits paths the base declares");
            Assert.IsFalse(UomdContentOverlay.Resolve(st, files, ChapterIndex)!.Value.FromPatch, "the newer embedded base wins on its own paths");
            Assert.IsTrue(UomdContentOverlay.Resolve(st, files, "units/units_ch1.json")!.Value.FromPatch);
            Assert.IsNotNull(UomdContentOverlay.Resolve(PatchState.Empty, files, BaseAudio));
        });

        [Test]
        public void DeviceValidationRejectsBrokenJsonAndMissingIndexes()
        {
            var manifest = ContentManifest.Parse(Manifest("r2_self_contained"));
            var good = new Dictionary<string, byte[]>
            {
                ["chapters/chapter_index.json"] = Encoding.UTF8.GetBytes("{\"chapters\":[]}"),
                ["units/unit_pack.json"] = Encoding.UTF8.GetBytes("{}"),
                ["art/art_manifest.json"] = Encoding.UTF8.GetBytes("{}"),
                ["art/bg.webp"] = new byte[0]
            };
            Assert.DoesNotThrow(() => UomdContentOverlay.ValidateRelease(good, manifest, BaseContent.Value));
            var broken = new Dictionary<string, byte[]>(good) { ["units/unit_pack.json"] = Encoding.UTF8.GetBytes("{\"a\":") };
            Assert.Throws<FormatException>(() => UomdContentOverlay.ValidateRelease(broken, manifest, BaseContent.Value));
            var badUtf8 = new Dictionary<string, byte[]>(good) { ["units/unit_pack.json"] = new byte[] { 0x7b, 0xff, 0x7d } };
            Assert.Throws<FormatException>(() => UomdContentOverlay.ValidateRelease(badUtf8, manifest, BaseContent.Value));
            var missing = new Dictionary<string, byte[]>(good);
            missing.Remove("art/art_manifest.json");
            Assert.Throws<FormatException>(() => UomdContentOverlay.ValidateRelease(missing, manifest, BaseContent.Value));
        }
    }
}
