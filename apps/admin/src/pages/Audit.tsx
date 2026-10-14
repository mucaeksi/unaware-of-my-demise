import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, downloadJson, type ApprovalEntry, type AuditEntry } from '../api';
import { ErrorNotice } from '../App';

export function Audit(): ReactNode {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const [approvalsOnly, setApprovalsOnly] = useState(false);
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const buildQuery = useCallback((cursor?: string | null): string => {
    const params = new URLSearchParams({ limit: '100' });
    if (actor.trim()) params.set('actor', actor.trim());
    if (action.trim()) params.set('action', action.trim());
    if (target.trim()) params.set('target', target.trim());
    if (cursor) params.set('cursor', cursor);
    return `/audit?${params.toString()}`;
  }, [actor, action, target]);

  const load = useCallback((): void => {
    if (approvalsOnly) {
      api<{ approvals: ApprovalEntry[]; nextCursor?: string | null }>('/approvals?limit=100')
        .then((r) => {
          setRows(r.approvals);
          setNextCursor(r.nextCursor ?? null);
        })
        .catch(setErr);
      return;
    }
    api<{ entries: AuditEntry[]; nextCursor?: string | null }>(buildQuery())
      .then((r) => {
        setRows(r.entries);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  }, [approvalsOnly, buildQuery]);

  const loadMore = (): void => {
    if (!nextCursor || !rows) return;
    if (approvalsOnly) {
      api<{ approvals: ApprovalEntry[]; nextCursor?: string | null }>(`/approvals?limit=100&cursor=${encodeURIComponent(nextCursor)}`)
        .then((r) => {
          setRows([...rows, ...r.approvals]);
          setNextCursor(r.nextCursor ?? null);
        })
        .catch(setErr);
      return;
    }
    api<{ entries: AuditEntry[]; nextCursor?: string | null }>(buildQuery(nextCursor))
      .then((r) => {
        setRows([...rows, ...r.entries]);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  };

  const inspect = (id: number): void => {
    api<{ entry: AuditEntry }>(`/audit/${id}`).then((r) => setDetail(r.entry)).catch(setErr);
  };

  useEffect(load, [load]);
  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading audit trail…</p>;
  return (
    <>
      <header className="page">
        <h2>Audit trail</h2>
        <span className="badge">append-only</span>
        <button className="btn" type="button" onClick={() => setApprovalsOnly(!approvalsOnly)}>
          {approvalsOnly ? 'Show all audit entries' : 'Sensitive approvals only'}
        </button>
        <button className="btn" type="button" onClick={() => downloadJson(approvalsOnly ? 'approvals.json' : 'audit.json', rows)}>Export JSON</button>
      </header>
      {!approvalsOnly ? (
        <div className="row" role="search" aria-label="Filter audit trail">
          <input aria-label="Filter actor" placeholder="actor email" value={actor} onChange={(e) => setActor(e.target.value)} maxLength={200} />
          <input aria-label="Filter action" placeholder="action (e.g. character.update)" value={action} onChange={(e) => setAction(e.target.value)} maxLength={80} />
          <input aria-label="Filter target" placeholder="target id" value={target} onChange={(e) => setTarget(e.target.value)} maxLength={200} />
        </div>
      ) : (
        <p className="muted">Reviewable sensitive owner and operator approval records (single-owner authority model; no synthetic second reviewer).</p>
      )}
      <table>
        <thead><tr><th>#</th><th>When (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th><th /></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td className="mono">{a.at}</td>
              <td>{a.actor}</td>
              <td><code>{a.action}</code></td>
              <td>{a.target ?? '—'}</td>
              <td className="mono">{a.detail}</td>
              <td><button className="btn" type="button" onClick={() => inspect(a.id)}>Inspect</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? <div className="row"><button className="btn" type="button" onClick={loadMore}>Load more</button></div> : null}
      {detail ? (
        <section className="card" aria-label="Audit entry detail">
          <div className="row">
            <h3>Audit #{detail.id} — <code>{detail.action}</code></h3>
            <button className="btn" type="button" onClick={() => downloadJson(`audit-${detail.id}.json`, detail)}>Export entry</button>
            <button className="btn" type="button" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p className="mono">{detail.at} · actor: {detail.actor} · target: {detail.target ?? '—'}</p>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>{detail.detail}</pre>
        </section>
      ) : null}
    </>
  );
}
