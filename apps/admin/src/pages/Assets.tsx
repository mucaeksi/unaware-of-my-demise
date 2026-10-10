import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, type Asset, type Me } from '../api';
import { ErrorNotice } from '../App';

export function Assets({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Asset[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => {
    api<{ assets: Asset[] }>('/assets').then((r) => setRows(r.assets)).catch(setErr);
  };
  useEffect(load, []);

  const add = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget; // React clears currentTarget after the first await
    const f = new FormData(form);
    try {
      await api('/assets', {
        method: 'POST',
        body: JSON.stringify({ path: f.get('path'), sha256: f.get('sha256'), bytes: Number(f.get('bytes')), media_type: f.get('media_type'), kind: f.get('kind'), source: f.get('source'), license: f.get('license') || 'project-owned', status: f.get('status') })
      });
      say('Asset registered');
      form.reset();
      load();
    } catch (x) {
      say((x as Error).message);
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading asset catalog…</p>;
  return (
    <>
      <header className="page"><h2>Asset catalog</h2><span className="badge">{rows.length} assets</span></header>
      <p style={{ color: 'var(--dim)' }}>Every asset needs provenance (source) and a license note. Generated media will be registered here by the Media Factory with model, prompt and cost records.</p>
      <table>
        <thead><tr><th>Path</th><th>Kind</th><th>Size</th><th>Status</th><th>License</th><th>Source</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6}>No assets registered yet.</td></tr> : rows.map((a) => (
            <tr key={a.id}><td><code>{a.path}</code><div className="mono">{a.sha256.slice(0, 16)}…</div></td><td>{a.kind}</td><td>{(a.bytes / 1024).toFixed(0)} KB</td><td><span className={`badge ${a.status === 'approved' ? 'ok' : 'warn'}`}>{a.status}</span></td><td>{a.license}</td><td className="mono">{a.source}</td></tr>
          ))}
        </tbody>
      </table>
      {me.role !== 'viewer' ? (
        <form className="row" onSubmit={add}>
          <label>Path<input name="path" required placeholder="art/atlas_x.webp" /></label>
          <label>SHA-256<input name="sha256" required pattern="[0-9a-f]{64}" size={30} /></label>
          <label>Bytes<input name="bytes" type="number" min="1" required /></label>
          <label>Media type<select name="media_type"><option>image/webp</option><option>image/png</option><option>audio/ogg</option><option>application/json</option></select></label>
          <label>Kind<input name="kind" required placeholder="atlas_image" /></label>
          <label>Source / provenance<input name="source" required size={30} /></label>
          <label>License<input name="license" defaultValue="project-owned" /></label>
          <label>Status<select name="status"><option>candidate</option><option>approved</option><option>retired</option></select></label>
          <button className="btn primary" type="submit">Register</button>
        </form>
      ) : null}
    </>
  );
}
