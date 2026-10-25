#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NUnit.Framework;
using Uomd.Core.Patching;

namespace Uomd.Tests.EditMode
{
    /// <summary>C# mirror of apps/game/src/patch/PatchService.test.ts (retired TS client, recovered from git history).</summary>
    public sealed class PatchServiceTests
    {
        private static PatchProgress Progress(long bytesDone) => new PatchProgress(PatchPhase.Downloading, "rel_0004", 0, 2, bytesDone, 100);
        private static readonly PatchOutcome Staged = PatchOutcome.StagedRelease("rel_0004", 4, 100, 2);

        private sealed class Source : IPatchSource
        {
            private readonly Queue<object> _outcomes;
            private readonly long[] _ticks;
            public Source(IEnumerable<object> outcomes, params long[] ticks)
            {
                _outcomes = new Queue<object>(outcomes);
                _ticks = ticks;
            }
            public List<ApplyOptions> Calls { get; } = new List<ApplyOptions>();
            public Task<PatchOutcome> CheckAndApplyAsync(ApplyOptions? options = null)
            {
                Calls.Add(options ?? new ApplyOptions());
                foreach (long t in _ticks) options?.OnProgress?.Invoke(Progress(t));
                if (_outcomes.Count == 0) return Task.FromException<PatchOutcome>(new InvalidOperationException("no outcome queued"));
                object next = _outcomes.Dequeue();
                return next is Exception e ? Task.FromException<PatchOutcome>(e) : Task.FromResult((PatchOutcome)next);
            }
        }

        private static T Wait<T>(Task<T> task) => task.GetAwaiter().GetResult();

        [Test]
        public void StagesInTheBackgroundAndReportsProgressThenReady()
        {
            var src = new Source(new object[] { Staged }, 10, 60, 100);
            var svc = new UomdPatchService(() => src);
            var seen = new List<PatchServiceStatus>();
            svc.Subscribe(seen.Add);
            Assert.AreEqual(PatchServiceKind.Idle, seen[0].Kind);
            var done = Wait(svc.StartAsync());
            Assert.IsFalse(src.Calls[0].Activate, "the background run stages, never activates");
            Assert.AreEqual(PatchServiceKind.Ready, done.Kind);
            var running = seen.Where(s => s.Kind == PatchServiceKind.Running).Select(s => s.Progress?.BytesDone ?? 0).ToList();
            Assert.GreaterOrEqual(running.Count, 2);
            CollectionAssert.AreEqual(running.OrderBy(b => b).ToList(), running);
            Assert.AreEqual(PatchServiceKind.Ready, seen[seen.Count - 1].Kind);
            Assert.AreEqual(1f, done.BarFill);
        }

        [Test]
        public void StartIsIdempotentWhileRunningAndAfterCompletion()
        {
            var gate = new TaskCompletionSource<PatchOutcome>();
            var calls = 0;
            var svc = new UomdPatchService(() => new Gated(gate.Task, () => calls++));
            var a = svc.StartAsync();
            var b = svc.StartAsync();
            Assert.AreSame(a, b);
            gate.SetResult(Staged);
            Wait(a);
            Wait(svc.StartAsync());
            Assert.AreEqual(1, calls);
        }

        private sealed class Gated : IPatchSource
        {
            private readonly Task<PatchOutcome> _gate;
            private readonly Action _onCall;
            public Gated(Task<PatchOutcome> gate, Action onCall) { _gate = gate; _onCall = onCall; }
            public Task<PatchOutcome> CheckAndApplyAsync(ApplyOptions? options = null) { _onCall(); return _gate; }
        }

        [Test]
        public void NothingNewerPublishedIsReady()
        {
            var svc = new UomdPatchService(() => new Source(new object[] { PatchOutcome.UpToDate(null) }));
            Assert.AreEqual(PatchServiceKind.Ready, Wait(svc.StartAsync()).Kind);
        }

        [Test]
        public void OfflineAndExceptionsFailWithARetryPath()
        {
            var src = new Source(new object[] { PatchOutcome.Offline("x"), new InvalidOperationException("boom"), Staged });
            var svc = new UomdPatchService(() => src);
            var first = Wait(svc.StartAsync());
            Assert.AreEqual(PatchServiceKind.Failed, first.Kind);
            Assert.AreEqual("no connection", first.Detail);
            Assert.IsFalse(first.UpdateRequired);
            Assert.AreEqual("boom", Wait(svc.RetryAsync()).Detail);
            Assert.AreEqual(PatchServiceKind.Ready, Wait(svc.RetryAsync()).Kind);
            Assert.AreEqual(3, src.Calls.Count);
        }

        [Test]
        public void AReleaseThisBinaryCanNeverApplyAsksForAnAppUpdate()
        {
            foreach (string reason in new[] { PatchRejectReason.ClientTooOld, PatchRejectReason.SchemaTooNew, PatchRejectReason.CapabilityMissing })
            {
                var svc = new UomdPatchService(() => new Source(new object[] { PatchOutcome.Rejected(reason, "needs >= 0.3.0") }));
                var status = Wait(svc.StartAsync());
                Assert.AreEqual(PatchServiceKind.Failed, status.Kind, reason);
                Assert.IsTrue(status.UpdateRequired, reason);
            }
        }

        [Test]
        public void FailsCleanlyWhenTheContentServiceDoesNotExistYet()
        {
            var svc = new UomdPatchService(() => null);
            Assert.AreEqual(PatchServiceKind.Failed, Wait(svc.StartAsync()).Kind);
            Assert.AreEqual(PatchServiceKind.Failed, Wait(svc.RetryAsync()).Kind, "a synchronous failure does not wedge later retries");
        }

        [Test]
        public void DoesNotPromiseARestartWillRetainAMemoryOnlyStage()
        {
            var svc = new UomdPatchService(() => new Source(new object[] { Staged }), persistent: false);
            var status = Wait(svc.StartAsync());
            Assert.AreEqual(PatchServiceKind.Failed, status.Kind);
            StringAssert.Contains("Local storage is unavailable", status.Detail);
        }

        [Test]
        public void RequiresAnExplicitRetryChoiceForMobileDataAndForwardsCancellation()
        {
            var src = new Source(new object[] { PatchOutcome.Rejected(PatchRejectReason.NetworkPolicy, "Metered connection"), Staged });
            var svc = new UomdPatchService(() => src);
            Assert.IsTrue(Wait(svc.StartAsync()).RequiresNetworkApproval);
            Assert.IsFalse(src.Calls[0].AllowMetered);
            Assert.AreEqual(PatchServiceKind.Ready, Wait(svc.RetryAsync(allowMetered: true)).Kind);
            Assert.IsTrue(src.Calls[1].AllowMetered);
            Assert.IsTrue(src.Calls[1].Cancellation.CanBeCanceled);
        }

        [Test]
        public void BarFillFollowsThePhases()
        {
            Assert.IsNull(PatchServiceStatus.Running(null).BarFill);
            Assert.IsNull(PatchServiceStatus.Running(new PatchProgress(PatchPhase.Checking, null, 0, 0, 0, 0)).BarFill);
            Assert.AreEqual(0.25f, PatchServiceStatus.Running(Progress(25)).BarFill);
            Assert.AreEqual(1f, PatchServiceStatus.Running(new PatchProgress(PatchPhase.Verifying, "r", 2, 2, 100, 100)).BarFill);
            Assert.IsNull(PatchServiceStatus.Failed("x").BarFill);
        }
    }
}
