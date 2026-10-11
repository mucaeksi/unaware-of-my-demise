import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type ApiError, type Health, type Me } from './api';
import { Assets } from './pages/Assets';
import { Audit } from './pages/Audit';
import { Banners } from './pages/Banners';
import { Characters } from './pages/Characters';
import { Dashboard } from './pages/Dashboard';
import { Flags } from './pages/Flags';
import { Players } from './pages/Players';
import { Releases } from './pages/Releases';
import { Shop } from './pages/Shop';

const PAGES = ['Dashboard', 'Players', 'Banners', 'Shop', 'Flags', 'Characters', 'Assets', 'Patches', 'Audit'] as const;
type Page = (typeof PAGES)[number];

export function useToast(): { toast: string | null; say: (m: string) => void } {
  const [toast, setToast] = useState<string | null>(null);
  const say = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3200);
  }, []);
  return { toast, say };
}

export function ErrorNotice({ error }: { error: unknown }): ReactNode {
  if (!error) return null;
  const e = error as ApiError;
  const hint =
    e.code === 'admin_auth_not_configured'
      ? 'Cloudflare Access is not configured for this Worker (ACCESS_TEAM_DOMAIN / ACCESS_AUD). The API refuses all requests until it is.'
      : e.status === 401
        ? 'Your Cloudflare Access session is missing or expired. Reload the page to sign in again.'
        : e.status === 403
          ? 'You are signed in but have no role in the Control Center.'
          : null;
  return (
    <div className="notice bad" role="alert">
      <strong>{e.code ?? 'error'}</strong> — {e.message ?? String(error)}
      {hint ? <div>{hint}</div> : null}
    </div>
  );
}

export function App(): ReactNode {
  const [page, setPage] = useState<Page>('Dashboard');
  const [health, setHealth] = useState<Health | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const { toast, say } = useToast();

  useEffect(() => {
    api<Health>('/health').then(setHealth).catch(setErr);
    api<Me>('/me').then(setMe).catch(setErr);
  }, []);

  return (
    <div className="shell">
      <nav aria-label="Control Center">
        <div className="brand">UOMD CONTROL CENTER</div>
        {PAGES.map((p) => (
          <button key={p} aria-current={p === page ? 'page' : undefined} onClick={() => setPage(p)}>
            {p}
          </button>
        ))}
        <div className="who">
          {health ? <span className="badge">{health.environment}</span> : null}
          <div>{me ? `${me.identity} · ${me.role}` : 'not signed in'}</div>
        </div>
      </nav>
      <main>
        {!me ? <ErrorNotice error={err} /> : null}
        {me && page === 'Dashboard' ? <Dashboard health={health} /> : null}
        {me && page === 'Players' ? <Players me={me} say={say} /> : null}
        {me && page === 'Banners' ? <Banners me={me} say={say} /> : null}
        {me && page === 'Shop' ? <Shop me={me} say={say} /> : null}
        {me && page === 'Flags' ? <Flags me={me} say={say} /> : null}
        {me && page === 'Characters' ? <Characters me={me} say={say} /> : null}
        {me && page === 'Assets' ? <Assets me={me} say={say} /> : null}
        {me && page === 'Patches' ? <Releases me={me} say={say} /> : null}
        {me && page === 'Audit' ? <Audit /> : null}
      </main>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
