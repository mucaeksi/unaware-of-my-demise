import { useEffect, useState, type ReactNode } from 'react';
import { api, type Me, type Release } from '../api';
import { ErrorNotice } from '../App';

export function Releases({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Release[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = (): void => {
    api<{ releases: Release[] }>('/releases').then((r) => setRows(r.releases)).catch(setErr);
  };
  useEffect(load, []);

  const act = async (label: string, path: string, body: unknown): Promise<void> => {
    if (!window.confirm(`${label}?\nThis changes what players on that channel receive.`)) return;
    setBusy(path);
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      say(`${label}: done`);
      load();
    } catch (x) {
      say(`${label} failed: ${(x as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading releases…</p>;
  const canWrite = me.role !== 'viewer';
  return (
    <>
      <header className="page"><h2>Content patches</h2><span className="badge">{rows.length} releases</span></header>
      <div className="notice">
        Releases contain data and media only (JSON, WebP/PNG, OGG…). Executable code is rejected by the schema. Publishing signs the manifest (ES256) and atomically moves the channel pointer; rollback and kill switch publish a <em>new, higher</em> generation so devices only ever move forward.
      </div>
      <table>
        <thead><tr><th>Channel</th><th>Gen</th><th>Release</th><th>State</th><th>Files</th><th>Depends on</th><th>Notes</th><th>Created</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={9}>No releases yet. Upload objects and create a draft with <code>tools/publish_release.ts</code> or the API.</td></tr> : rows.map((r) => (
            <tr key={r.id}>
              <td>{r.channel}</td><td>{r.generation}</td><td><code>{r.id}</code> {r.is_current ? <span className="badge ok">current</span> : null}</td>
              <td><span className={`badge ${r.state === 'published' ? 'ok' : 'warn'}`}>{r.state}</span></td><td>{r.files}</td><td>{r.depends_on ?? '—'}</td><td>{r.notes}</td><td className="mono">{r.created_at}<div>{r.created_by}</div></td>
              <td>
                {canWrite && r.state === 'draft' ? <button className="btn primary" disabled={busy !== null} onClick={() => act(`Publish ${r.id}`, `/releases/${r.id}/publish`, {})}>Publish</button> : null}
                {canWrite && r.state === 'published' && !r.is_current ? <button className="btn" disabled={busy !== null} onClick={() => act(`Roll ${r.channel} back to ${r.id}`, `/channels/${r.channel}/rollback`, { releaseId: r.id })}>Roll back here</button> : null}
                {canWrite && r.state === 'published' && r.is_current ? <button className="btn danger" disabled={busy !== null} onClick={() => act(`KILL SWITCH on ${r.channel}`, `/channels/${r.channel}/kill`, { releaseId: r.id })}>Kill switch</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
