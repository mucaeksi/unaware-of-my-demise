import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Flag { key: string; enabled: number; value_json: string; note: string; version: number; updated_at: string; updated_by: string }

export function Flags({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Flag[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => { api<{ flags: Flag[] }>('/flags').then((r) => setRows(r.flags)).catch(setErr); };
  useEffect(load, []);
  const set = async (f: Flag): Promise<void> => {
    if (f.enabled && /^(gacha|shop|ads)\./.test(f.key) && !window.confirm(`Switch OFF ${f.key}? Players lose this feature immediately.`)) return;
    try {
      await api(`/flags/${f.key}`, { method: 'PUT', body: JSON.stringify({ enabled: !f.enabled, value: JSON.parse(f.value_json), note: f.note, expectedVersion: f.version }) });
      say(`${f.key} → ${f.enabled ? 'off' : 'on'}`); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); load(); }
  };
  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading flags…</p>;
  return (
    <>
      <header className="page"><h2>Feature flags</h2></header>
      <p>Emergency brakes and LiveOps switches. The client reads them at boot; the server enforces the money-touching ones on every request.</p>
      <table>
        <thead><tr><th>Key</th><th>State</th><th>Value</th><th>Note</th><th>v</th><th>Updated</th><th /></tr></thead>
        <tbody>{rows.map((f) => (
          <tr key={f.key}><td><code>{f.key}</code></td><td><span className={`badge ${f.enabled ? 'ok' : 'warn'}`}>{f.enabled ? 'on' : 'off'}</span></td><td className="mono">{f.value_json}</td><td>{f.note}</td><td>{f.version}</td><td>{f.updated_at} · {f.updated_by}</td>
            <td>{me.role !== 'viewer' ? <button className="btn" onClick={() => void set(f)}>Turn {f.enabled ? 'off' : 'on'}</button> : null}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}
