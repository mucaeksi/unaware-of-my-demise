import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, downloadJson, type Asset, type Me } from '../api';
import { ErrorNotice } from '../App';

export function Assets({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Asset[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<Asset | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const buildQuery = useCallback((cursor?: string | null): string => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (kindFilter.trim()) params.set('kind', kindFilter.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return `/assets${qs ? `?${qs}` : ''}`;
  }, [q, kindFilter, statusFilter]);

  const load = useCallback((): void => {
    api<{ assets: Asset[]; nextCursor?: string | null }>(buildQuery())
      .then((r) => {
        setRows(r.assets);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  }, [buildQuery]);

  const loadMore = (): void => {
    if (!nextCursor || !rows) return;
    api<{ assets: Asset[]; nextCursor?: string | null }>(buildQuery(nextCursor))
      .then((r) => {
        setRows([...rows, ...r.assets]);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  };

  const inspect = (id: number): void => {
    api<{ asset: Asset }>(`/assets/${id}`).then((r) => setDetail(r.asset)).catch(setErr);
  };

  const approve = async (a: Asset): Promise<void> => {
    try {
      await api(`/assets/${a.id}/approve`, { method: 'POST', body: '{}' });
      say(`Approved ${a.path} (verified in R2)`);
      load();
      if (detail?.id === a.id) inspect(a.id);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  useEffect(load, [load]);

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
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : (x as Error).message);
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading asset catalog…</p>;
  return (
    <>
      <header className="page">
        <h2>Asset catalog</h2>
        <span className="badge">{rows.length} assets</span>
        <button className="btn" type="button" onClick={() => downloadJson('assets.json', rows)}>Export JSON</button>
      </header>
      <p style={{ color: 'var(--dim)' }}>Every asset needs provenance (source) and a license note. Store releases require owner approval bound to a verified R2 object hash and byte size.</p>
      <div className="row" role="search" aria-label="Filter assets">
        <input aria-label="Search asset path" placeholder="path filter" value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} />
        <input aria-label="Filter asset kind" placeholder="kind (e.g. atlas_image)" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} maxLength={40} />
        <select aria-label="Filter asset status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="candidate">candidate</option>
          <option value="approved">approved</option>
          <option value="retired">retired</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Path</th><th>Kind</th><th>Size</th><th>Status</th><th>License</th><th>Source</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={7}>No assets registered yet.</td></tr> : rows.map((a) => (
            <tr key={a.id}>
              <td>
                <div className="row" style={{ gap: 10 }}>
                  {a.path.endsWith('.webp') ? (
                    <img
                      src={`/dev/media/${a.path}`}
                      alt=""
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--edge, #444)', background: '#0a0610' }}
                    />
                  ) : null}
                  <div>
                    <code>{a.path}</code>
                    <div className="mono">{a.sha256.slice(0, 16)}…</div>
                  </div>
                </div>
              </td>
              <td>{a.kind}</td>
              <td>{(a.bytes / 1024).toFixed(0)} KB</td>
              <td><span className={`badge ${a.status === 'approved' ? 'ok' : 'warn'}`}>{a.status}</span></td>
              <td>{a.license}</td>
              <td className="mono">{a.source}</td>
              <td className="row">
                <button className="btn" type="button" onClick={() => inspect(a.id)}>Inspect</button>
                {me.role === 'owner' && a.status !== 'approved' ? <button className="btn primary" type="button" onClick={() => void approve(a)}>Approve R2</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? <div className="row"><button className="btn" type="button" onClick={loadMore}>Load more</button></div> : null}
      {detail ? (
        <section className="card" aria-label="Asset detail">
          <div className="row">
            <h3><code>{detail.path}</code></h3>
            <span className={`badge ${detail.object_stored ? 'ok' : 'warn'}`}>{detail.object_stored ? 'R2 object stored' : 'Not uploaded to R2'}</span>
            <button className="btn" type="button" onClick={() => downloadJson(`asset-${detail.id}.json`, detail)}>Export detail</button>
            <button className="btn" type="button" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p className="mono">SHA-256: {detail.sha256} · {detail.bytes} bytes · {detail.media_type} · kind: {detail.kind} · status: {detail.status} · by {detail.created_by}</p>
          <p className="mono">Source: {detail.source} · License: {detail.license}</p>
          {detail.path.endsWith('.webp') ? (
            <div style={{ marginTop: 10 }}>
              <a href={`/dev/media/${detail.path}`} target="_blank" rel="noreferrer">
                <img
                  src={`/dev/media/${detail.path}`}
                  alt={detail.path}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  style={{ maxWidth: 640, maxHeight: 360, borderRadius: 6, border: '1px solid var(--edge, #444)', background: '#0a0610' }}
                />
              </a>
            </div>
          ) : null}
          {detail.path.endsWith('.ogg') ? (
            <div style={{ marginTop: 10 }}>
              <audio controls src={`/dev/media/${detail.path}`} style={{ width: '100%', maxWidth: 480 }} />
            </div>
          ) : null}
        </section>
      ) : null}
      {me.role !== 'viewer' ? (
        <form className="row" onSubmit={add}>
          <label>Path<input name="path" required placeholder="art/atlas_x.webp" /></label>
          <label>SHA-256<input name="sha256" required pattern="[0-9a-f]{64}" size={30} /></label>
          <label>Bytes<input name="bytes" type="number" min="1" required /></label>
          <label>Media type<select name="media_type"><option>image/webp</option><option>image/png</option><option>audio/ogg</option><option>application/json</option></select></label>
          <label>Kind<input name="kind" required placeholder="atlas_image" /></label>
          <label>Source / provenance<input name="source" required size={30} /></label>
          <label>License<input name="license" defaultValue="project-owned" /></label>
          <label>Status<select name="status"><option>candidate</option>{me.role === 'owner' ? <option>approved</option> : null}<option>retired</option></select></label>
          <button className="btn primary" type="submit">Register</button>
        </form>
      ) : null}
    </>
  );
}
