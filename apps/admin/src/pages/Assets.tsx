import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, downloadJson, mediaTypeForPath, sha256HexBrowser, type Asset, type Me } from '../api';
import { ErrorNotice } from '../App';

const QUICK_FILTERS: { label: string; q: string; kind: string }[] = [
  { label: 'All Assets', q: '', kind: '' },
  { label: 'Music / BGM', q: 'audio/bgm_', kind: '' },
  { label: 'Voiceovers', q: 'voices/', kind: '' },
  { label: 'Sound Effects', q: 'sounds/', kind: '' },
  { label: 'Portraits', q: 'art/portrait_', kind: '' },
  { label: 'Chibi Atlases', q: 'art/atlas_', kind: '' },
  { label: 'Prologue & Story Stills', q: 'art/still_', kind: '' },
  { label: 'Locations & BGs', q: 'art/bg_', kind: '' },
  { label: 'UI & Logos', q: 'art/ui_', kind: '' },
  { label: 'JSON Data', q: '.json', kind: '' }
];

export function Assets({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Asset[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');
  const [detail, setDetail] = useState<Asset | null>(null);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const buildQuery = useCallback((cursor?: string | null): string => {
    const params = new URLSearchParams({ limit: '100' });
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

  const updateStatusOrMeta = async (a: Asset, patch: { status?: string; kind?: string; source?: string; license?: string }): Promise<void> => {
    try {
      await api(`/assets/${a.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      say(`Updated ${a.path}`);
      setEditAsset(null);
      load();
      if (detail?.id === a.id) inspect(a.id);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  const onUploadFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256HexBrowser(bytes);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const defaultPrefix = ext === 'ogg' ? 'audio' : ext === 'webp' || ext === 'png' ? 'art' : 'story';
      const suggestedPath = `${defaultPrefix}/${file.name}`;
      const mediaType = mediaTypeForPath(suggestedPath);
      const res = await fetch(`/admin/api/objects/${sha256}`, {
        method: 'PUT',
        headers: { 'Content-Type': mediaType },
        body: bytes,
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new ApiError(res.status, b.error ?? 'upload_failed', b.message ?? `Upload failed (${res.status})`);
      }
      if (formRef.current) {
        const setVal = (name: string, val: string): void => {
          const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
          if (el) el.value = val;
        };
        setVal('path', suggestedPath);
        setVal('sha256', sha256);
        setVal('bytes', String(bytes.byteLength));
        setVal('media_type', mediaType);
        setVal('kind', ext === 'ogg' ? 'music' : ext === 'webp' ? 'background' : 'other_data');
        setVal('source', `upload:${file.name}`);
      }
      say(`Uploaded ${file.name} to R2 (${sha256.slice(0, 12)}…) — click Register to save metadata.`);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    } finally {
      setUploading(false);
      e.target.value = '';
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
        <button className={`btn${viewMode === 'table' ? ' primary' : ''}`} type="button" onClick={() => setViewMode('table')}>Table view</button>
        <button className={`btn${viewMode === 'gallery' ? ' primary' : ''}`} type="button" onClick={() => setViewMode('gallery')}>Media gallery &amp; Audio studio</button>
        <button className="btn" type="button" onClick={() => downloadJson('assets.json', rows)}>Export JSON</button>
      </header>
      <p style={{ color: 'var(--dim)' }}>Every asset needs provenance (source) and a license note. Store releases require owner approval bound to a verified R2 object hash and byte size.</p>
      <div className="row" style={{ gap: 6 }}>
        {QUICK_FILTERS.map((qf) => (
          <button
            key={qf.label}
            type="button"
            className={`btn${q === qf.q && kindFilter === qf.kind ? ' primary' : ''}`}
            onClick={() => { setQ(qf.q); setKindFilter(qf.kind); }}
          >
            {qf.label}
          </button>
        ))}
      </div>
      <div className="row" role="search" aria-label="Filter assets">
        <input aria-label="Search assets" placeholder="path filter" value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} />
        <input aria-label="Filter by category" placeholder="kind (e.g. atlas_image)" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} maxLength={40} />
        <select aria-label="Filter by approval state" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="candidate">candidate</option>
          <option value="approved">approved</option>
          <option value="retired">retired</option>
        </select>
      </div>
      {me.role !== 'viewer' ? (
        <form ref={formRef} className="row card" onSubmit={add} style={{ marginBottom: 18 }}>
          <label className="btn">
            {uploading ? 'Uploading…' : 'Upload file & auto-fill'}
            <input type="file" accept=".webp,.png,.ogg,.json" onChange={(e) => void onUploadFile(e)} style={{ display: 'none' }} />
          </label>
          <label>Path<input name="path" required placeholder="art/atlas_x.webp" /></label>
          <label>SHA-256<input name="sha256" required pattern="[0-9a-f]{64}" size={30} /></label>
          <label>Bytes<input name="bytes" type="number" min="1" required /></label>
          <label>Media type<select name="media_type"><option>image/webp</option><option>image/png</option><option>audio/ogg</option><option>application/json</option></select></label>
          <label>Kind<input name="kind" required placeholder="atlas_image" /></label>
          <label>Source / provenance<input name="source" required size={30} /></label>
          <label>License<input name="license" defaultValue="project-owned" /></label>
          <label>Status<select name="status"><option>candidate</option><option>retired</option></select></label>
          <button className="btn primary" type="submit">Register</button>
        </form>
      ) : null}
      {viewMode === 'gallery' ? (
        <div className="media-grid">
          {rows.map((a) => (
            <div key={a.id} className="media-card">
              <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}>
                <span className={`badge ${a.status === 'approved' ? 'ok' : 'warn'}`}>{a.status}</span>
                <span className="mono">{(a.bytes / 1024).toFixed(0)} KB</span>
              </div>
              <code style={{ fontSize: 11.5 }}>{a.path}</code>
              {(a.path.endsWith('.webp') || a.path.endsWith('.png')) ? (
                <a href={`/dev/media/${a.path}`} target="_blank" rel="noreferrer">
                  <img
                    src={`/dev/media/${a.path}`}
                    alt={a.path}
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </a>
              ) : null}
              {a.path.endsWith('.ogg') ? (
                <audio controls preload="none" src={`/dev/media/${a.path}`} />
              ) : null}
              <div className="mono" style={{ fontSize: 11 }}>{a.kind} · {a.source.slice(0, 64)}</div>
              <div className="row" style={{ marginTop: 'auto', marginBottom: 0 }}>
                <button className="btn" type="button" onClick={() => inspect(a.id)}>Inspect</button>
                {me.role !== 'viewer' ? <button className="btn" type="button" onClick={() => setEditAsset(a)}>Edit</button> : null}
                {me.role === 'owner' && a.status !== 'approved' ? <button className="btn primary" type="button" onClick={() => void approve(a)}>Approve R2</button> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <table>
        <thead><tr><th>Path</th><th>Kind</th><th>Size</th><th>Status</th><th>License</th><th>Source</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={7}>No assets registered yet.</td></tr> : rows.map((a) => (
            <tr key={a.id}>
              <td>
                <code>{a.path}</code>
                <div className="mono">{a.sha256.slice(0, 16)}…</div>
              </td>
              <td>{a.kind}</td>
              <td>{(a.bytes / 1024).toFixed(0)} KB</td>
              <td><span className={`badge ${a.status === 'approved' ? 'ok' : 'warn'}`}>{a.status}</span></td>
              <td>{a.license}</td>
              <td className="mono">{a.source}</td>
              <td className="row">
                <button className="btn" type="button" onClick={() => inspect(a.id)}>Inspect</button>
                {me.role !== 'viewer' ? <button className="btn" type="button" onClick={() => setEditAsset(a)}>Edit</button> : null}
                {me.role === 'owner' && a.status !== 'approved' ? <button className="btn primary" type="button" onClick={() => void approve(a)}>Approve R2</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? <div className="row"><button className="btn" type="button" onClick={loadMore}>Load more</button></div> : null}
      {editAsset ? (
        <section className="card" aria-label="Edit asset metadata">
          <div className="row">
            <h3>Edit asset <code>{editAsset.path}</code></h3>
            <button className="btn" type="button" onClick={() => setEditAsset(null)}>Close</button>
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void updateStatusOrMeta(editAsset, {
                kind: String(f.get('kind')),
                source: String(f.get('source')),
                license: String(f.get('license')),
                status: String(f.get('status'))
              });
            }}
          >
            <label>Kind<input name="kind" defaultValue={editAsset.kind} required /></label>
            <label>Source<input name="source" defaultValue={editAsset.source} size={36} required /></label>
            <label>License<input name="license" defaultValue={editAsset.license} required /></label>
            <label>
              Status
              <select name="status" defaultValue={editAsset.status}>
                <option value="candidate">candidate</option>
                {/* approval happens only through "Approve R2" (server verifies the stored object) */}
                {editAsset.status === 'approved' ? <option value="approved">approved</option> : null}
                <option value="retired">retired</option>
              </select>
            </label>
            <button className="btn primary" type="submit">Save metadata</button>
            {editAsset.status !== 'retired' ? (
              <button className="btn danger" type="button" onClick={() => void updateStatusOrMeta(editAsset, { status: 'retired' })}>Retire asset</button>
            ) : null}
          </form>
        </section>
      ) : null}
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
          {(detail.path.endsWith('.webp') || detail.path.endsWith('.png')) ? (
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
    </>
  );
}
