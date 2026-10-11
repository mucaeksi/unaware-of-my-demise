import { useCallback, useState, type ReactNode } from 'react';
import { api } from '../api';
import { ErrorNotice } from '../App';
import { usePolling } from '../usePolling';

interface Version { id: string; tag?: string; timestamp?: string }
interface Operation { id: number; at: string; kind: string; ok: number; detail: { version?: Version | null; checks?: { name: string; ok: boolean; detail: string }[] } }
interface Snapshot {
  updatedAt: string; windowStart: string; retentionDays: number; maxEvents: number; environment: string;
  players: { total: number; new24h: number | null; active24h: number | null; banned: number | null };
  economy: { wallets: { currency: string; balance: number }[]; flows: { currency: string; earned: number; spent: number; transactions: number }[]; breakdown: { source: string; earned: number; spent: number }[]; pulls: { pulls: number; players: number } };
  ads: { grants: number; tokens: number; players: number };
  purchases: { total: number; new24h: number | null; unacknowledged: number | null; unrecovered: number | null };
  events: { id: string; at: string; service: string; category: string; event: string; severity: string; method: string; route: string; status: number; reason: string; ray_id: string | null; version_id: string | null; duration_ms: number | null }[];
  counts: { category: string; severity: string; count: number }[];
  operations: Operation[];
  development: { status: string; count: number }[];
  audit: { at: string; action: string; target: string | null }[];
  versions: { admin: Version | null; game: { available: boolean; ok?: boolean; status?: number; reason?: string; time?: string; version?: Version | null } };
}
interface Progress { generatedAt: string; summary: { done: number; partial: number; missing: number }; commits: { sha: string; subject: string }[] }
type Destination = 'Dashboard' | 'Development' | 'Players' | 'Economy' | 'Shop' | 'Flags' | 'Catalog' | 'Patches' | 'Audit';
const when = (at?: string): string => at ? new Date(at).toLocaleString() : 'No data yet';
const number = (n?: number | null): string => (n ?? 0).toLocaleString();
function Status({ at, ok, maxAge }: { at?: string; ok?: boolean; maxAge: number }): ReactNode {
  const fresh = at && Date.now() - Date.parse(at) <= maxAge;
  return <span className={`badge ${!at || !fresh ? 'warn' : ok ? 'ok' : 'bad'}`}>{!at ? 'No data' : !fresh ? 'Stale' : ok ? 'Healthy' : 'Attention'}</span>;
}

export function Monitoring({ navigate }: { navigate: (page: Destination) => void }): ReactNode {
  const [category, setCategory] = useState('all');
  const read = useCallback((signal: AbortSignal) => api<Snapshot>(`/monitoring?category=${category}`, { signal }), [category]);
  const { data: s, error, loading, refresh } = usePolling(read);
  const progressRead = useCallback(async (signal: AbortSignal): Promise<Progress> => {
    const r = await fetch('/dev/progress.json', { signal, cache: 'no-cache' });
    if (!r.ok) throw new Error('Development snapshot unavailable');
    return r.json() as Promise<Progress>;
  }, []);
  const progress = usePolling(progressRead);
  const health = s?.operations.find((o) => o.kind === 'health');
  const backup = s?.operations.find((o) => o.kind === 'backup');
  const goodBackup = s?.operations.find((o) => o.kind === 'backup' && o.ok === 1);
  const errors = s?.counts.filter((c) => c.severity !== 'info').reduce((sum, c) => sum + c.count, 0) ?? 0;
  return <div className="monitor-page">
    <header className="page"><h2>Monitoring</h2><button className="btn" disabled={loading} onClick={() => { refresh(); progress.refresh(); }}>Refresh</button></header>
    <p className="muted">Updates every 30 seconds while this page is visible. Last successful update: <time dateTime={s?.updatedAt}>{when(s?.updatedAt)}</time>. Statistics cover the rolling 24 hours since {when(s?.windowStart)}.</p>
    <ErrorNotice error={error} />
    {error && s ? <div className="notice bad">Refresh failed. The values below are from the last successful update.</div> : null}
    {!s ? <p>{loading ? 'Loading monitoring…' : 'Monitoring data unavailable.'}</p> : <>
      <div className="grid monitor-metrics">
        <Metric title="Players" value={number(s.players.total)} detail={`${number(s.players.new24h)} new · ${number(s.players.active24h)} active / 24h`} />
        <Metric title="Bell’s Remains in wallets" value={number(s.economy.wallets.find((w) => w.currency === 'eclipse_token')?.balance)} detail={`${number(s.players.banned)} banned players`} />
        <Metric title="Ad rewards / 24h" value={number(s.ads.grants)} detail={`${number(s.ads.tokens)} tokens · ${number(s.ads.players)} players`} />
        <Metric title="Gacha pulls / 24h" value={number(s.economy.pulls.pulls)} detail={`${number(s.economy.pulls.players)} players`} />
        <Metric title="Purchase follow-up" value={number((s.purchases.unacknowledged ?? 0) + (s.purchases.unrecovered ?? 0))} detail={`${number(s.purchases.unacknowledged)} unacknowledged · ${number(s.purchases.unrecovered)} refunds with unrecovered rewards`} />
        <Metric title="Recorded warnings / errors / 24h" value={number(errors)} detail={`${number(s.purchases.new24h)} new purchases / 24h`} />
      </div>
      <section className="card"><h3>Economy flow / 24h</h3><p className="muted">Active players means an active account seen by the API in the last 24 hours. Money flow comes from the immutable ledger.</p>
        <table><thead><tr><th>Currency</th><th>In wallets</th><th>Earned</th><th>Spent</th><th>Net flow</th><th>Transactions</th></tr></thead><tbody>{s.economy.wallets.map((w) => { const f = s.economy.flows.find((r) => r.currency === w.currency); return <tr key={w.currency}><td>{w.currency === 'eclipse_token' ? 'Bell’s Remains' : w.currency}</td><td>{number(w.balance)}</td><td>{number(f?.earned)}</td><td>{number(f?.spent)}</td><td>{number((f?.earned ?? 0) - (f?.spent ?? 0))}</td><td>{number(f?.transactions)}</td></tr>; })}{!s.economy.wallets.length ? <tr><td colSpan={6}>No wallet activity yet.</td></tr> : null}</tbody></table>
        <h4>Top sources & spending reasons</h4><table><thead><tr><th>Source</th><th>Earned</th><th>Spent</th></tr></thead><tbody>{s.economy.breakdown.map((r) => <tr key={r.source}><td>{r.source}</td><td>{number(r.earned)}</td><td>{number(r.spent)}</td></tr>)}{!s.economy.breakdown.length ? <tr><td colSpan={3}>No ledger transactions in the last 24 hours.</td></tr> : null}</tbody></table>
      </section>
      <div className="grid">
        <section className="card"><h3>Health & backups</h3>
          <p>Game now: <Status at={s.versions.game.available ? s.updatedAt : undefined} ok={s.versions.game.ok} maxAge={60_000} /> {s.versions.game.status ? `HTTP ${s.versions.game.status}` : s.versions.game.reason}</p>
          <p>Scheduled health: <Status at={health?.at} ok={health?.ok === 1} maxAge={30 * 60_000} /> · {when(health?.at)}</p>
          {health?.detail.checks?.map((ch) => <p key={ch.name}><span className={`badge ${ch.ok ? 'ok' : 'bad'}`}>{ch.name}</span> {ch.detail}</p>)}
          <p>Latest backup attempt: <Status at={backup?.at} ok={backup?.ok === 1} maxAge={36 * 3_600_000} /> · {when(backup?.at)}</p>
          <p>Last successful backup: <Status at={goodBackup?.at} ok maxAge={36 * 3_600_000} /> · {when(goodBackup?.at)}</p>
          <button className="btn" onClick={() => navigate('Dashboard')}>System & backup details</button>
        </section>
        <section className="card"><h3>Observed deployment versions</h3><p className="muted">Game and admin versions are read from running Workers. Ops is the version recorded by its latest scheduled run.</p>
          <VersionRow name="Game" version={s.versions.game.version ?? null} />
          <VersionRow name="Admin" version={s.versions.admin} />
          <VersionRow name="Ops" version={s.operations[0]?.detail.version ?? null} />
        </section>
      </div>
      <section className="card"><div className="row"><h3>SSV, billing & API events</h3><label>Event category <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All</option><option value="ads">SSV / ads</option><option value="billing">Billing / RTDN</option><option value="api">API errors</option></select></label></div>
        <p className="muted">Latest 100 matching events. Retained for {s.retentionDays} days, up to {number(s.maxEvents)} events. Signatures, callback URLs and tokens are excluded. “ad_unit_not_ours” acknowledges AdMob’s check without granting a reward.</p>
        <div className="monitor-table"><table><thead><tr><th>Time</th><th>Event / service</th><th>HTTP</th><th>Reason</th><th>Route</th><th>Version / Ray</th></tr></thead><tbody>{s.events.map((e) => <tr key={e.id}><td>{when(e.at)}<div className="muted">{e.duration_ms === null ? 'Duration unknown' : `${e.duration_ms} ms`}</div></td><td>{e.event}<div className="muted">{e.service}</div></td><td><span className={`badge ${e.severity === 'error' ? 'bad' : e.severity === 'warning' ? 'warn' : 'ok'}`}>{e.status}</span></td><td>{e.reason}</td><td className="mono">{e.method} {e.route}</td><td className="mono"><span title={e.version_id ?? ''}>{e.version_id?.slice(0, 8) ?? 'Unknown version'}</span><div>{e.ray_id ?? '—'}</div></td></tr>)}{!s.events.length ? <tr><td colSpan={6}>No recorded events in this category.</td></tr> : null}</tbody></table></div>
      </section>
      <section className="card"><h3>Development & coverage</h3><ErrorNotice error={progress.error} />
        <p>Development snapshot built: {when(progress.data?.generatedAt)}. It updates when the admin deployment completes.</p>
        {progress.data ? <p>{progress.data.summary.done} done · {progress.data.summary.partial} partial · {progress.data.summary.missing} missing. Latest source commit: <code>{progress.data.commits[0]?.sha.slice(0, 8) ?? 'Unknown'}</code></p> : null}
        <p>Feedback: {s.development.map((n) => `${n.count} ${n.status}`).join(' · ') || 'No feedback yet'}</p>
        <div className="row">{(['Players', 'Economy', 'Shop', 'Flags', 'Catalog', 'Patches', 'Audit', 'Development'] as Destination[]).map((page) => <button className="btn" key={page} onClick={() => navigate(page)}>{page}</button>)}</div>
        <p className="muted">This screen follows SSV callbacks, API failures, purchase verification / RTDN, player activity, currency flow, gacha, health, backups, running versions and development feedback. Platform-wide Cloudflare usage and Android crash reports are not connected.</p>
        <h4>Recent admin activity</h4>{s.audit.map((a, i) => <p key={i}>{when(a.at)} · {a.action} · {a.target ?? '—'}</p>)}
      </section>
    </>}
  </div>;
}
function Metric({ title, value, detail }: { title: string; value: string; detail: string }): ReactNode { return <section className="card"><h3>{title}</h3><div className="big">{value}</div><p className="muted">{detail}</p></section>; }
function VersionRow({ name, version }: { name: string; version: Version | null }): ReactNode { return <p><strong>{name}</strong>: <code className="monitor-version">{version?.id ?? 'Not observed yet'}</code>{version?.tag ? ` · ${version.tag}` : ''}<br /><small>{version?.timestamp ? `Version created: ${when(version.timestamp)}` : ''}</small></p>; }
