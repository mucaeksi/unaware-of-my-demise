import { Monitoring } from './pages/Monitoring';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type ApiError, type Health, type Me } from './api';
import { Animations } from './pages/Animations';
import { Assets } from './pages/Assets';
import { Audit } from './pages/Audit';
import { Banners } from './pages/Banners';
import { Catalog } from './pages/Catalog';
import { Characters } from './pages/Characters';
import { Dashboard } from './pages/Dashboard';
import { Economy } from './pages/Economy';
import { Development } from './pages/Development';
import { Flags } from './pages/Flags';
import { Players } from './pages/Players';
import { Releases } from './pages/Releases';
import { Shop } from './pages/Shop';

export const PAGES = ['Dashboard', 'Monitoring', 'Development', 'Animations', 'Players', 'Banners', 'Economy', 'Shop', 'Flags', 'Catalog', 'Characters', 'Assets', 'Patches', 'Audit'] as const;
export type Page = (typeof PAGES)[number];

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
  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      const qPage = new URLSearchParams(window.location.search).get('page');
      if (qPage && (PAGES as readonly string[]).includes(qPage)) {
        return qPage as Page;
      }
    }
    return 'Animations';
  });
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
            {p === 'Animations' ? '🎬 Animations' : p}
          </button>
        ))}
        <div className="who">
          <div className="row" style={{ margin: 0, gap: 6 }}>
            {health ? <span className="badge ok">{health.environment}</span> : null}
            {me?.role ? <span className="badge info">{me.role}</span> : null}
          </div>
          <div>{me ? `${me.identity} · ${me.role}` : 'local studio mode'}</div>
        </div>
      </nav>
      <main>
        {!me && page !== 'Animations' ? <ErrorNotice error={err} /> : null}
        {page === 'Animations' ? <Animations me={me} say={say} /> : null}
        {me && page === 'Monitoring' ? <Monitoring navigate={setPage} say={say} /> : null}
        {me && page === 'Dashboard' ? <Dashboard health={health} navigate={setPage} say={say} /> : null}
        {me && page === 'Development' ? <Development me={me} say={say} /> : null}
        {me && page === 'Players' ? <Players me={me} say={say} /> : null}
        {me && page === 'Banners' ? <Banners me={me} say={say} /> : null}
        {me && page === 'Economy' ? <Economy say={say} /> : null}
        {me && page === 'Shop' ? <Shop me={me} say={say} /> : null}
        {me && page === 'Flags' ? <Flags me={me} say={say} /> : null}
        {me && page === 'Catalog' ? <Catalog me={me} say={say} /> : null}
        {me && page === 'Characters' ? <Characters me={me} say={say} /> : null}
        {me && page === 'Assets' ? <Assets me={me} say={say} /> : null}
        {me && page === 'Patches' ? <Releases me={me} say={say} /> : null}
        {me && page === 'Audit' ? <Audit /> : null}
      </main>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
