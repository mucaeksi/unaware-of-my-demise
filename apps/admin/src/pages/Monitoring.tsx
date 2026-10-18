import { useCallback, useState, type ReactNode } from 'react';
import { api, ApiError, downloadJson } from '../api';
import { ErrorNotice, type Page } from '../App';
import { usePolling } from '../usePolling';

interface Version { id: string; tag?: string; timestamp?: string }
interface Operation { id: number; at: string; kind: string; ok: number; detail: { version?: Version | null; checks?: { name: string; ok: boolean; detail: string }[] } }
interface BattleRow { id: number; at: string; release_id: string; encounter: string; valid: number; complete: number; winner: string | null; stars: number | null; turns: number | null; log_hash: string; client_match: number }
interface LedgerRow { id: number; at: string; currency: string; delta: number; reason: string }
interface PullRow { id: number; at: string; banner_id: string; pull_number: number; rarity: number; item_id: string; outcome: string; duplicate: number }
interface AuditRow { id?: number; at: string; actor?: string; action: string; target: string | null; detail?: string }
interface Snapshot {
  updatedAt: string; windowStart: string; retentionDays: number; maxEvents: number; environment: string;
  freshness?: { source: string; generatedAt: string; windowStart: string; newestEventAt: string | null; lastHealthAt: string | null; lastBackupAt: string | null; lastGoodBackupAt: string | null; healthStale: boolean; backupStale: boolean };
  players: { total: number; new24h: number | null; active24h: number | null; banned: number | null };
  economy: { wallets: { currency: string; balance: number }[]; flows: { currency: string; earned: number; spent: number; transactions: number }[]; breakdown: { source: string; earned: number; spent: number }[]; pulls: { pulls: number; players: number } };
  ads: { grants: number; tokens: number; players: number };
  purchases: { total: number; new24h: number | null; unacknowledged: number | null; unrecovered: number | null };
  events: { id: string; at: string; service: string; category: string; event: string; severity: string; method: string; route: string; status: number; reason: string; ray_id: string | null; version_id: string | null; duration_ms: number | null }[];
  counts: { category: string; severity: string; count: number }[];
  operations: Operation[];
  development: { status: string; count: number }[];
  audit: AuditRow[];
  recentBattles?: BattleRow[];
  recentLedger?: LedgerRow[];
  recentPulls?: PullRow[];
  versions: { admin: Version | null; game: { available: boolean; ok?: boolean; status?: number; reason?: string; time?: string; version?: Version | null } };
}
interface Progress { generatedAt: string; summary: { done: number; partial: number; missing: number }; commits: { sha: string; subject: string }[] }
const when = (at?: string): string => at ? new Date(at).toLocaleString() : 'No data yet';
const number = (n?: number | null): string => (n ?? 0).toLocaleString();
function Status({ at, ok, maxAge }: { at?: string; ok?: boolean; maxAge: number }): ReactNode {
  const fresh = at && Date.now() - Date.parse(at) <= maxAge;
  return <span className={`badge ${!at || !fresh ? 'warn' : ok ? 'ok' : 'bad'}`}>{!at ? 'No data' : !fresh ? 'Stale' : ok ? 'Healthy' : 'Attention'}</span>;
}

const STREAM_TABS = ['Admin Audit', 'Combat & Battles', 'Economy Ledger', 'Gacha Summons'] as const;
type StreamTab = (typeof STREAM_TABS)[number];

export function Monitoring({ navigate, say }: { navigate: (page: Page) => void; say?: (m: string) => void }): ReactNode {
  const [category, setCategory] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [streamTab, setStreamTab] = useState<StreamTab>('Admin Audit');
  const [probing, setProbing] = useState(false);

  const read = useCallback((signal: AbortSignal) => api<Snapshot>(`/monitoring?category=${category}`, { signal }), [category]);
  const { data: s, error, loading, refresh } = usePolling(read);
  const progressRead = useCallback(async (signal: AbortSignal): Promise<Progress> => {
    const r = await fetch('/dev/progress.json', { signal, cache: 'no-cache' });
    if (!r.ok) throw new Error('Development snapshot unavailable');
    return r.json() as Promise<Progress>;
  }, []);
  const progress = usePolling(progressRead);

  const triggerProbe = async (): Promise<void> => {
    setProbing(true);
    try {
      const r = await api<{ ok: boolean; checks: { name: string; ok: boolean; detail: string }[] }>('/monitoring/probe', { method: 'POST', body: '{}' });
      say?.(`Probe ${r.ok ? 'OK' : 'WARN'}: ${r.checks.map((c) => `${c.name}=${c.detail}`).join(' · ')}`);
      refresh();
    } catch (x) {
      say?.(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    } finally {
      setProbing(false);
    }
  };

  const health = s?.operations.find((o) => o.kind === 'health');
  const backup = s?.operations.find((o) => o.kind === 'backup');
  const goodBackup = s?.operations.find((o) => o.kind === 'backup' && o.ok === 1);
  const errors = s?.counts.filter((c) => c.severity !== 'info').reduce((sum, c) => sum + c.count, 0) ?? 0;

  const filteredEvents = (s?.events ?? []).filter((e) => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (serviceFilter !== 'all' && e.service !== serviceFilter) return false;
    if (searchQ.trim()) {
      const needle = searchQ.trim().toLowerCase();
      const hay = `${e.event} ${e.reason} ${e.route} ${e.method} ${e.ray_id ?? ''} ${e.status}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return <div className="monitor-page">
    <header className="page">
      <h2>Monitoring</h2>
      <span className="badge info">Auto-polling 30s</span>
      <button className="btn" disabled={loading} onClick={() => { refresh(); progress.refresh(); }}>Refresh</button>
      <button className="btn primary" disabled={probing} onClick={() => void triggerProbe()}>{probing ? 'Probing…' : 'Run live probe'}</button>
      {s ? <button className="btn" type="button" onClick={() => downloadJson('monitoring-snapshot.json', s)}>Export snapshot JSON</button> : null}
    </header>
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
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>SSV, billing & API events</h3>
          <div className="row" style={{ margin: 0 }}>
            <label>Event category <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All</option><option value="ads">SSV / ads</option><option value="billing">Billing / RTDN</option><option value="api">API errors</option></select></label>
            <label>Severity <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}><option value="all">All</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
            <label>Service <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}><option value="all">All</option><option value="game">game</option><option value="admin">admin</option></select></label>
            <label>Filter logs <input placeholder="route, reason, event…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} /></label>
          </div>
        </div>
        <p className="muted">Latest 100 matching events (showing {filteredEvents.length}). Retained for {s.retentionDays} days, up to {number(s.maxEvents)} events. Signatures, callback URLs and tokens are excluded. “ad_unit_not_ours” acknowledges AdMob’s check without granting a reward.</p>
        <div className="monitor-table"><table><thead><tr><th>Time</th><th>Event / service</th><th>HTTP</th><th>Reason</th><th>Route</th><th>Version / Ray</th></tr></thead><tbody>{filteredEvents.map((e) => <tr key={e.id}><td>{when(e.at)}<div className="muted">{e.duration_ms === null ? 'Duration unknown' : `${e.duration_ms} ms`}</div></td><td>{e.event}<div className="muted">{e.service}</div></td><td><span className={`badge ${e.severity === 'error' ? 'bad' : e.severity === 'warning' ? 'warn' : 'ok'}`}>{e.status}</span></td><td>{e.reason}</td><td className="mono">{e.method} {e.route}</td><td className="mono"><span title={e.version_id ?? ''}>{e.version_id?.slice(0, 8) ?? 'Unknown version'}</span><div>{e.ray_id ?? '—'}</div></td></tr>)}{!filteredEvents.length ? <tr><td colSpan={6}>No recorded events in this category.</td></tr> : null}</tbody></table></div>
      </section>
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Live game &amp; admin activity logs</h3>
          <div className="row" style={{ margin: 0 }}>
            {STREAM_TABS.map((t) => (
              <button key={t} type="button" className={`btn${streamTab === t ? ' primary' : ''}`} onClick={() => setStreamTab(t)}>{t}</button>
            ))}
          </div>
        </div>
        {streamTab === 'Admin Audit' ? (
          <table>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
            <tbody>
              {s.audit.map((a, i) => (
                <tr key={a.id ?? i}>
                  <td className="mono">{when(a.at)}</td>
                  <td>{a.actor ?? 'admin'}</td>
                  <td><code>{a.action}</code></td>
                  <td>{a.target ?? '—'}</td>
                  <td className="mono">{a.detail ?? '{}'}</td>
                </tr>
              ))}
              {!s.audit.length ? <tr><td colSpan={5}>No admin audit records yet.</td></tr> : null}
            </tbody>
          </table>
        ) : null}
        {streamTab === 'Combat & Battles' ? (
          <table>
            <thead><tr><th>When</th><th>Release</th><th>Encounter</th><th>Outcome</th><th>Stars / Turns</th><th>Replay Hash</th></tr></thead>
            <tbody>
              {(s.recentBattles ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="mono">{when(b.at)}</td>
                  <td><code>{b.release_id}</code></td>
                  <td><code>{b.encounter}</code></td>
                  <td><span className={`badge ${b.valid && b.client_match ? 'ok' : 'bad'}`}>{b.winner ?? (b.complete ? 'done' : 'incomplete')}</span></td>
                  <td>{b.stars ? '★'.repeat(b.stars) : '—'} · {b.turns ?? 0} turns</td>
                  <td className="mono">{b.log_hash.slice(0, 16)}…</td>
                </tr>
              ))}
              {!(s.recentBattles ?? []).length ? <tr><td colSpan={6}>No verified battles recorded yet.</td></tr> : null}
            </tbody>
          </table>
        ) : null}
        {streamTab === 'Economy Ledger' ? (
          <table>
            <thead><tr><th>When</th><th>Currency</th><th>Delta</th><th>Reason</th></tr></thead>
            <tbody>
              {(s.recentLedger ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="mono">{when(l.at)}</td>
                  <td>{l.currency === 'eclipse_token' ? 'Bell’s Remains' : l.currency}</td>
                  <td><span className={`badge ${l.delta > 0 ? 'ok' : 'warn'}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span></td>
                  <td className="mono">{l.reason}</td>
                </tr>
              ))}
              {!(s.recentLedger ?? []).length ? <tr><td colSpan={4}>No ledger entries recorded yet.</td></tr> : null}
            </tbody>
          </table>
        ) : null}
        {streamTab === 'Gacha Summons' ? (
          <table>
            <thead><tr><th>When</th><th>Banner</th><th>Pull #</th><th>Rarity</th><th>Item</th><th>Outcome</th></tr></thead>
            <tbody>
              {(s.recentPulls ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="mono">{when(p.at)}</td>
                  <td><code>{p.banner_id}</code></td>
                  <td>#{p.pull_number}</td>
                  <td><span className={`badge ${p.rarity === 5 ? 'ok' : p.rarity === 4 ? 'info' : ''}`}>{p.rarity}★</span></td>
                  <td><code>{p.item_id}</code></td>
                  <td>{p.outcome}{p.duplicate ? ' (dup)' : ''}</td>
                </tr>
              ))}
              {!(s.recentPulls ?? []).length ? <tr><td colSpan={6}>No gacha summons recorded yet.</td></tr> : null}
            </tbody>
          </table>
        ) : null}
      </section>
      <section className="card"><h3>Development & coverage</h3><ErrorNotice error={progress.error} />
        <p>Development snapshot built: {when(progress.data?.generatedAt)}. It updates when the admin deployment completes.</p>
        {progress.data ? <p>{progress.data.summary.done} done · {progress.data.summary.partial} partial · {progress.data.summary.missing} missing. Latest source commit: <code>{progress.data.commits[0]?.sha.slice(0, 8) ?? 'Unknown'}</code></p> : null}
        <p>Feedback: {s.development.map((n) => `${n.count} ${n.status}`).join(' · ') || 'No feedback yet'}</p>
        <div className="row">{(['Players', 'Economy', 'Shop', 'Flags', 'Catalog', 'Characters', 'Assets', 'Patches', 'Audit', 'Development'] as Page[]).map((page) => <button className="btn" key={page} onClick={() => navigate(page)}>{page}</button>)}</div>
        <p className="muted">This screen follows SSV callbacks, API failures, purchase verification / RTDN, player activity, currency flow, gacha, health, backups, running versions and development feedback. Platform-wide Cloudflare usage and Android crash reports are not connected.</p>
        <h4>Recent admin activity</h4>{s.audit.slice(0, 10).map((a, i) => <p key={i}>{when(a.at)} · {a.action} · {a.target ?? '—'}</p>)}
      </section>
    </>}
  </div>;
}
function Metric({ title, value, detail }: { title: string; value: string; detail: string }): ReactNode { return <section className="card"><h3>{title}</h3><div className="big">{value}</div><p className="muted">{detail}</p></section>; }
function VersionRow({ name, version }: { name: string; version: Version | null }): ReactNode { return <p><strong>{name}</strong>: <code className="monitor-version">{version?.id ?? 'Not observed yet'}</code>{version?.tag ? ` · ${version.tag}` : ''}<br /><small>{version?.timestamp ? `Version created: ${when(version.timestamp)}` : ''}</small></p>; }
