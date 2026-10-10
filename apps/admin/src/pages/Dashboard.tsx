import { useEffect, useState, type ReactNode } from 'react';
import { api, type Health, type SystemStatus } from '../api';
import { ErrorNotice } from '../App';

const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(2)} MB`;

export function Dashboard({ health }: { health: Health | null }): ReactNode {
  const [s, setS] = useState<SystemStatus | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => {
    api<SystemStatus>('/system').then(setS).catch(setErr);
  };
  useEffect(load, []);

  if (err) return <ErrorNotice error={err} />;
  if (!s) return <p>Loading system status…</p>;
  return (
    <>
      <header className="page">
        <h2>System health</h2>
        <span className={`badge ${s.d1.ok && s.r2.ok ? 'ok' : 'bad'}`}>{s.d1.ok && s.r2.ok ? 'operational' : 'degraded'}</span>
        <button className="btn" onClick={load}>Refresh</button>
      </header>
      {!s.auth.signing_configured ? <div className="notice">Content signing key is not configured — releases can be drafted but not published.</div> : null}
      <div className="grid">
        <div className="card"><h3>D1 database</h3><div className="big">{s.d1.ok ? 'OK' : 'DOWN'}</div><div className="mono">{s.d1.latency_ms} ms · {mb(s.d1.size_bytes)} · {s.d1.migrations.length} migrations</div></div>
        <div className="card"><h3>R2 content bucket</h3><div className="big">{s.r2.ok ? 'OK' : 'DOWN'}</div><div className="mono">{s.r2.ok ? `${s.r2.objects_listed ?? 0} objects · ${mb(s.r2.bytes_listed ?? 0)}` : s.r2.error}</div></div>
        <div className="card"><h3>Environment</h3><div className="big">{s.environment}</div><div className="mono">{health?.signing_configured ? 'signing key set' : 'no signing key'} · Access {s.auth.access_configured ? 'on' : 'OFF'}</div></div>
        <div className="card"><h3>Free-plan ceilings (D1)</h3><div className="mono">{(s.limits.d1_rows_read_per_day / 1e6).toFixed(0)}M reads/day · {(s.limits.d1_rows_written_per_day / 1e3).toFixed(0)}k writes/day · {(s.limits.d1_bytes_per_database / 1024 ** 2).toFixed(0)} MB/db</div><div className="mono">Live usage: {s.usage_source === 'not_connected' ? 'analytics API not connected yet' : s.usage_source}</div></div>
      </div>
      <h3>Published channels</h3>
      <table>
        <thead><tr><th>Channel</th><th>Current release</th><th>Pointer v</th><th>Updated</th><th>By</th></tr></thead>
        <tbody>
          {s.pointers.length === 0 ? <tr><td colSpan={5}>Nothing published yet.</td></tr> : s.pointers.map((p) => (
            <tr key={p.channel}><td>{p.channel}</td><td><code>{p.release_id}</code></td><td>{p.version}</td><td>{p.updated_at}</td><td>{p.updated_by}</td></tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ margin: '22px 0 8px' }}>Table row counts</h3>
      <div className="grid">
        {Object.entries(s.d1.counts).map(([k, v]) => (<div className="card" key={k}><h3>{k}</h3><div className="big">{v}</div></div>))}
      </div>
    </>
  );
}
