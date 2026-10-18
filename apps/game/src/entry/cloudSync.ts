import { Services } from '../services';
import { noteRelease, onContinuityChange, syncContinuity, type ContinuityApi } from './continuity';

/** a cursor move (new step) reaches the cloud almost at once; line marks are batched */
const URGENT_MS = 600;
const LAZY_MS = 20_000;

const api: ContinuityApi = {
  get signedIn() {
    return Services.api.signedIn;
  },
  readSave: () => Services.api.readSave(),
  writeSaveDirect: (version, data) => Services.api.writeSaveDirect(version, data)
};

let timer = 0;
let due = 0;
let pendingKey: string | null = null;
let chain: Promise<unknown> = Promise.resolve();

function run(accountKey: string): Promise<unknown> {
  chain = chain
    .then(async () => {
      const release = await Services.content?.activeReleaseId().catch(() => null);
      if (release) noteRelease(release);
      // a record written under one account is only ever sent while that account is signed in
      if (accountKey === Services.api.accountKey) await syncContinuity(api, accountKey);
    })
    .catch(() => undefined);
  return chain;
}

function flush(): void {
  window.clearTimeout(timer);
  timer = 0;
  const key = pendingKey;
  pendingKey = null;
  if (key) void run(key);
}

/** Installs the device → cloud push for story continuity (R09). Called once by the app shell. */
export function installContinuitySync(): void {
  onContinuityChange((accountKey, urgent) => {
    if (pendingKey && pendingKey !== accountKey) flush();
    pendingKey = accountKey;
    const at = Date.now() + (urgent ? URGENT_MS : LAZY_MS);
    if (timer && due <= at) return;
    window.clearTimeout(timer);
    due = at;
    timer = window.setTimeout(flush, at - Date.now());
  });
  // backgrounding, force-stop and tab close: send what is pending now
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/**
 * Pushes anything pending, then reconciles the device with the cloud (before Continue decides where to go). Offline it
 * gives up after `timeoutMs` and the device record decides.
 */
export function syncContinuityNow(timeoutMs = 4000): Promise<unknown> {
  flush();
  return Promise.race([run(Services.api.accountKey), new Promise((resolve) => window.setTimeout(resolve, timeoutMs))]);
}
