import { useEffect, useState, type ReactNode } from 'react';
import { api, type AuditEntry } from '../api';
import { ErrorNotice } from '../App';

export function Audit(): ReactNode {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    api<{ entries: AuditEntry[] }>('/audit?limit=100').then((r) => setRows(r.entries)).catch(setErr);
  }, []);
  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading audit trail…</p>;
  return (
    <>
      <header className="page"><h2>Audit trail</h2><span className="badge">append-only</span></header>
      <table>
        <thead><tr><th>#</th><th>When (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}><td>{a.id}</td><td className="mono">{a.at}</td><td>{a.actor}</td><td><code>{a.action}</code></td><td>{a.target ?? '—'}</td><td className="mono">{a.detail}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
