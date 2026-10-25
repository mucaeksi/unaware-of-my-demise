#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Uomd.Core.Patching
{
    public enum PatchServiceKind { Idle, Running, Ready, Failed }

    /// <summary>The slice of the patch client the background download needs (a fake in tests).</summary>
    public interface IPatchSource
    {
        Task<PatchOutcome> CheckAndApplyAsync(ApplyOptions? options = null);
    }

    /// <summary>What the patch bar and the Finish page render (port of apps/game/src/patch/PatchService.ts PatchStatus).</summary>
    public sealed class PatchServiceStatus
    {
        public static readonly PatchServiceStatus Idle = new PatchServiceStatus(PatchServiceKind.Idle);

        private PatchServiceStatus(PatchServiceKind kind, PatchProgress? progress = null, PatchOutcome? outcome = null, string detail = "",
            bool updateRequired = false, bool requiresNetworkApproval = false)
        {
            Kind = kind;
            Progress = progress;
            Outcome = outcome;
            Detail = detail;
            UpdateRequired = updateRequired;
            RequiresNetworkApproval = requiresNetworkApproval;
        }

        public PatchServiceKind Kind { get; }
        public PatchProgress? Progress { get; }
        /// <summary>Ready: the outcome (staged, applied, up to date or reverted to base — nothing left to wait for).</summary>
        public PatchOutcome? Outcome { get; }
        public string Detail { get; }
        /// <summary>A release this binary can never apply: the player needs an app update, not a retry.</summary>
        public bool UpdateRequired { get; }
        public bool RequiresNetworkApproval { get; }

        public static PatchServiceStatus Running(PatchProgress? progress) => new PatchServiceStatus(PatchServiceKind.Running, progress);
        public static PatchServiceStatus Ready(PatchOutcome outcome) => new PatchServiceStatus(PatchServiceKind.Ready, outcome: outcome);
        public static PatchServiceStatus Failed(string detail, bool updateRequired = false, bool requiresNetworkApproval = false) =>
            new PatchServiceStatus(PatchServiceKind.Failed, detail: detail, updateRequired: updateRequired, requiresNetworkApproval: requiresNetworkApproval);

        /// <summary>The 0..1 fill of the progress bar (null = indeterminate), as apps/game/src/patch/barFill.ts.</summary>
        public float? BarFill
        {
            get
            {
                if (Kind == PatchServiceKind.Ready) return 1f;
                if (Kind != PatchServiceKind.Running || Progress == null) return null;
                if (Progress.Phase == PatchPhase.Verifying || Progress.Phase == PatchPhase.Activating) return 1f;
                if (Progress.BytesTotal > 0) return Math.Min(1f, (float)Progress.BytesDone / Progress.BytesTotal);
                return Progress.Phase == PatchPhase.Checking ? (float?)null : 0f;
            }
        }
    }

    /// <summary>
    /// Background download of the content patch during the first-install flow (port of PatchService.ts). It downloads, verifies
    /// and validates but only STAGES the release: the tutorial keeps running on the content it started with, and the restart at
    /// the end switches the new content on without any network. Start is idempotent; a failed run is retried by the player.
    /// </summary>
    public sealed class UomdPatchService
    {
        private readonly Func<IPatchSource?> _client;
        private readonly bool _persistent;
        private readonly List<Action<PatchServiceStatus>> _listeners = new List<Action<PatchServiceStatus>>();
        private Task<PatchServiceStatus>? _run;
        private CancellationTokenSource? _cancel;
        private bool _allowMetered;

        /// <param name="persistent">false when the client stores into memory only: a stage would not survive the restart.</param>
        public UomdPatchService(Func<IPatchSource?> client, bool persistent = true)
        {
            _client = client;
            _persistent = persistent;
        }

        public PatchServiceStatus Status { get; private set; } = PatchServiceStatus.Idle;

        /// <summary>Calls the listener now and on every change; dispose the result to unsubscribe.</summary>
        public IDisposable Subscribe(Action<PatchServiceStatus> listener)
        {
            lock (_listeners) _listeners.Add(listener);
            listener(Status);
            return new Unsubscriber(this, listener);
        }

        private sealed class Unsubscriber : IDisposable
        {
            private readonly UomdPatchService _owner;
            private readonly Action<PatchServiceStatus> _listener;
            public Unsubscriber(UomdPatchService owner, Action<PatchServiceStatus> listener) { _owner = owner; _listener = listener; }
            public void Dispose() { lock (_owner._listeners) _owner._listeners.Remove(_listener); }
        }

        private void Set(PatchServiceStatus status)
        {
            Status = status;
            Action<PatchServiceStatus>[] listeners;
            lock (_listeners) listeners = _listeners.ToArray();
            foreach (var listener in listeners) listener(status);
        }

        /// <summary>Starts the download unless it is running or already complete. Resolves with the final status.</summary>
        public Task<PatchServiceStatus> StartAsync()
        {
            if (_run != null) return _run;
            if (Status.Kind == PatchServiceKind.Ready) return Task.FromResult(Status);
            var run = RunAsync();
            _run = run;
            if (run.IsCompleted) _run = null; // finished synchronously: its finally ran before the assignment
            return run;
        }

        public void Cancel() => _cancel?.Cancel();

        /// <param name="allowMetered">null keeps the previous choice; true allows the metered connection from now on.</param>
        public Task<PatchServiceStatus> RetryAsync(bool? allowMetered = null)
        {
            if (allowMetered.HasValue) _allowMetered = allowMetered.Value;
            if (Status.Kind == PatchServiceKind.Failed) Status = PatchServiceStatus.Idle;
            return StartAsync();
        }

        private async Task<PatchServiceStatus> RunAsync()
        {
            try
            {
                return await ExecuteAsync();
            }
            finally
            {
                _run = null;
            }
        }

        private async Task<PatchServiceStatus> ExecuteAsync()
        {
            var client = _client();
            if (client == null)
            {
                Set(PatchServiceStatus.Failed("content service is not ready"));
                return Status;
            }
            _cancel?.Dispose();
            _cancel = new CancellationTokenSource();
            Set(PatchServiceStatus.Running(null));
            PatchOutcome outcome;
            try
            {
                outcome = await client.CheckAndApplyAsync(new ApplyOptions
                {
                    Activate = false,
                    Cancellation = _cancel.Token,
                    AllowMetered = _allowMetered,
                    OnProgress = p => Set(PatchServiceStatus.Running(p))
                });
            }
            catch (Exception e)
            {
                Set(PatchServiceStatus.Failed(e.Message));
                return Status;
            }
            switch (outcome.Status)
            {
                case PatchStatus.Staged:
                    Set(_persistent
                        ? PatchServiceStatus.Ready(outcome)
                        : PatchServiceStatus.Failed("Local storage is unavailable. Enable device storage and restart before entering the downloaded content."));
                    break;
                case PatchStatus.Applied:
                case PatchStatus.UpToDate:
                case PatchStatus.RevertedToBase:
                    Set(PatchServiceStatus.Ready(outcome));
                    break;
                case PatchStatus.Offline:
                    Set(PatchServiceStatus.Failed("no connection"));
                    break;
                default:
                    bool updateRequired = outcome.Reason == PatchRejectReason.ClientTooOld || outcome.Reason == PatchRejectReason.SchemaTooNew || outcome.Reason == PatchRejectReason.CapabilityMissing;
                    Set(PatchServiceStatus.Failed(outcome.Detail ?? outcome.Reason ?? "rejected", updateRequired, outcome.Reason == PatchRejectReason.NetworkPolicy));
                    break;
            }
            return Status;
        }
    }
}
