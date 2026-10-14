import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  api,
  ApiError,
  downloadJson,
  mediaTypeForPath,
  sha256HexBrowser,
  type CatalogSnapshot,
  type EconomicPolicyInfo,
  type Me,
  type Release,
  type ReleaseDetail,
  type ReleaseDiff
} from '../api';
import { ErrorNotice } from '../App';

interface StagedFile {
  path: string;
  sha256: string;
  bytes: number;
  mediaType: string;
  uploaded: boolean;
}

export function Releases({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Release[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [detail, setDetail] = useState<ReleaseDetail | null>(null);
  const [diff, setDiff] = useState<ReleaseDiff | null>(null);
  const [econ, setEcon] = useState<EconomicPolicyInfo | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const buildQuery = useCallback((cursor?: string | null): string => {
    const params = new URLSearchParams();
    if (channelFilter) params.set('channel', channelFilter);
    if (stateFilter) params.set('state', stateFilter);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return `/releases${qs ? `?${qs}` : ''}`;
  }, [channelFilter, stateFilter]);

  const load = useCallback((): void => {
    api<{ releases: Release[]; nextCursor?: string | null }>(buildQuery())
      .then((r) => {
        setRows(r.releases);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  }, [buildQuery]);

  useEffect(load, [load]);

  const loadMore = (): void => {
    if (!nextCursor || !rows) return;
    api<{ releases: Release[]; nextCursor?: string | null }>(buildQuery(nextCursor))
      .then((r) => {
        setRows([...rows, ...r.releases]);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  };

  const inspect = (id: string): void => {
    Promise.all([
      api<ReleaseDetail>(`/releases/${encodeURIComponent(id)}`),
      api<ReleaseDiff>(`/releases/${encodeURIComponent(id)}/diff`),
      api<EconomicPolicyInfo>(`/releases/${encodeURIComponent(id)}/economic-policy`)
    ])
      .then(([d, df, ec]) => {
        setDetail(d);
        setDiff(df);
        setEcon(ec);
      })
      .catch(setErr);
  };

  const act = async (label: string, path: string, body: unknown): Promise<void> => {
    if (!window.confirm(`${label}?\nThis changes what players on that channel receive.`)) return;
    setBusy(path);
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      say(`${label}: done`);
      load();
      if (detail) inspect(detail.id);
    } catch (x) {
      say(`${label} failed: ${x instanceof ApiError ? `${x.code}: ${x.message}` : (x as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const uploadObject = async (path: string, bytes: ArrayBuffer): Promise<StagedFile> => {
    const sha256 = await sha256HexBrowser(bytes);
    const mediaType = mediaTypeForPath(path);
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
    return { path, sha256, bytes: bytes.byteLength, mediaType, uploaded: true };
  };

  const onSelectFiles = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setBusy('upload');
    try {
      const next: StagedFile[] = [...staged];
      for (const file of Array.from(list)) {
        const prefix = window.prompt(`Release path for ${file.name}:`, file.name.endsWith('.json') ? `story/${file.name}` : `art/${file.name}`);
        if (!prefix) continue;
        const item = await uploadObject(prefix.trim(), await file.arrayBuffer());
        const idx = next.findIndex((s) => s.path === item.path);
        if (idx >= 0) next[idx] = item;
        else next.push(item);
      }
      setStaged(next);
      say(`Uploaded ${list.length} file(s) to R2`);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    } finally {
      setBusy(null);
      e.target.value = '';
    }
  };

  const attachCatalogSnapshot = async (): Promise<void> => {
    setBusy('catalog');
    try {
      const snap = await api<CatalogSnapshot>('/catalog/snapshot');
      const bytes = new TextEncoder().encode(snap.json).buffer as ArrayBuffer;
      const item = await uploadObject(snap.path, bytes);
      setStaged((prev) => [...prev.filter((f) => f.path !== item.path), item]);
      say(`Attached ${snap.path} (${snap.sha256.slice(0, 12)}…)`);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const createDraft = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (staged.length === 0) {
      say('Attach at least one file or the catalog snapshot before creating a draft.');
      return;
    }
    const f = new FormData(e.currentTarget);
    const id = String(f.get('id') ?? '').trim();
    const channel = String(f.get('channel') ?? 'dev');
    const dependsOn = String(f.get('dependsOn') ?? '').trim();
    const minClient = String(f.get('minClient') ?? '0.1.2').trim();
    const maxClient = String(f.get('maxClient') ?? '').trim();
    const rolloutPercent = Number(f.get('rolloutPercent') ?? '100');
    const notes = String(f.get('notes') ?? '').trim();
    setBusy('draft');
    try {
      await api('/releases', {
        method: 'POST',
        body: JSON.stringify({
          id,
          channel,
          ...(dependsOn ? { dependsOn } : {}),
          minClient,
          ...(maxClient ? { maxClient } : {}),
          rolloutPercent,
          notes,
          files: staged.map((s) => ({ path: s.path, sha256: s.sha256 }))
        })
      });
      say(`Draft ${id} created on ${channel}`);
      setStaged([]);
      setShowComposer(false);
      load();
      inspect(id);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const saveEconomicPolicy = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!detail || !econ) return;
    const f = new FormData(e.currentTarget);
    const mode = String(f.get('mode'));
    const validUntil = String(f.get('validUntil') ?? '').trim();
    const reason = String(f.get('reason') ?? '').trim();
    try {
      await api(`/releases/${detail.id}/economic-policy`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          expectedVersion: econ.policy?.version ?? 0,
          ...(validUntil ? { validUntil } : {}),
          reason
        })
      });
      say(`Economic policy for ${detail.id} set to ${mode}`);
      inspect(detail.id);
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading releases…</p>;
  const canWrite = me.role !== 'viewer';
  return (
    <>
      <header className="page">
        <h2>Content patches</h2>
        <span className="badge">{rows.length} releases</span>
        {canWrite ? <button className="btn primary" type="button" onClick={() => setShowComposer(!showComposer)}>{showComposer ? 'Close composer' : 'Compose release'}</button> : null}
        <button className="btn" type="button" onClick={() => downloadJson('releases.json', rows)}>Export JSON</button>
      </header>
      <div className="notice">
        Releases contain data and media only (JSON, WebP/PNG, OGG…). Executable code is rejected by the schema. Draft composition copies the complete file set from a published release on the same channel; the resulting snapshot has no runtime dependency. New snapshots require client 0.1.1 or later. Rollback preserves or tightens compatibility; kill retains the source limits. Publishing signs the manifest (ES256) and atomically moves the channel pointer; rollback and kill switch publish a <em>new, higher</em> generation so devices only ever move forward.
      </div>
      {showComposer && canWrite ? (
        <section className="card" aria-label="Release composer">
          <h3>Release composer (upload → validate → draft → preview → publish)</h3>
          <div className="row">
            <label className="btn">
              Upload files to R2
              <input type="file" multiple onChange={(e) => void onSelectFiles(e)} style={{ display: 'none' }} />
            </label>
            <button className="btn" type="button" disabled={busy !== null} onClick={() => void attachCatalogSnapshot()}>
              Attach live catalog snapshot (<code>catalog/economy.json</code>)
            </button>
            {staged.length > 0 ? <button className="btn" type="button" onClick={() => setStaged([])}>Clear staged ({staged.length})</button> : null}
          </div>
          {staged.length > 0 ? (
            <ul className="mono">
              {staged.map((s) => <li key={s.path}>{s.path} · {s.sha256.slice(0, 16)}… ({s.bytes} B, {s.mediaType})</li>)}
            </ul>
          ) : <p className="muted">No files staged yet. Attach a base release in “Compose from” to inherit unchanged files automatically.</p>}
          <form className="row" onSubmit={(e) => void createDraft(e)}>
            <label>Release ID<input name="id" required pattern="[a-z][a-z0-9_]{1,47}" placeholder="rel_0002" /></label>
            <label>Channel<select name="channel"><option value="dev">dev</option><option value="staging">staging</option><option value="production">production</option></select></label>
            <label>Compose from (optional)<input name="dependsOn" placeholder="rel_0001" /></label>
            <label>Min client<input name="minClient" defaultValue="0.1.2" required /></label>
            <label>Max client<input name="maxClient" placeholder="unbounded" /></label>
            <label>Canary rollout %<input name="rolloutPercent" type="number" min="0" max="100" defaultValue="100" required /></label>
            <label>Notes<input name="notes" maxLength={400} placeholder="Summary of changes" /></label>
            <button className="btn primary" type="submit" disabled={busy !== null}>Validate &amp; create draft</button>
          </form>
        </section>
      ) : null}
      <div className="row" role="search" aria-label="Filter releases">
        <select aria-label="Filter release channel" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="">All channels</option>
          <option value="dev">dev</option>
          <option value="staging">staging</option>
          <option value="production">production</option>
        </select>
        <select aria-label="Filter release state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">All states</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="retired">retired</option>
        </select>
      </div>
      <div className="releases-table" role="region" aria-label="Content releases" tabIndex={0}><table>
        <thead><tr><th>Channel</th><th>Gen</th><th>Release</th><th>State</th><th>Files</th><th>Compatibility</th><th>Legacy dependency</th><th>Notes</th><th>Created</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={10}>No releases yet. Upload objects and create a draft with <code>tools/publish_release.ts</code> or the API.</td></tr> : rows.map((r) => (
            <tr key={r.id}>
              <td>{r.channel}</td><td>{r.generation}</td><td><code>{r.id}</code> {r.is_current ? <span className="badge ok">current</span> : null}</td>
              <td><span className={`badge ${r.state === 'published' ? 'ok' : 'warn'}`}>{r.state}</span></td><td>{r.files}</td><td>Client {r.min_client}–{r.max_client ?? 'unbounded'}<div>Schema {r.content_schema}</div></td><td>{r.depends_on ?? '—'}</td><td>{r.notes}</td><td className="mono">{r.created_at}<div>{r.created_by}</div></td>
              <td className="row">
                <button className="btn" type="button" onClick={() => inspect(r.id)}>Inspect / Diff</button>
                {canWrite && r.state === 'draft' ? <button className="btn primary" disabled={busy !== null} onClick={() => void act(`Publish ${r.id}`, `/releases/${r.id}/publish`, {})}>Publish</button> : null}
                {canWrite && r.state === 'published' && !r.is_current ? <button className="btn" disabled={busy !== null} onClick={() => void act(`Roll ${r.channel} back to ${r.id}`, `/channels/${r.channel}/rollback`, { releaseId: r.id })}>Roll back here</button> : null}
                {canWrite && r.state === 'published' && r.is_current ? <button className="btn danger" disabled={busy !== null} onClick={() => void act(`KILL SWITCH on ${r.channel}`, `/channels/${r.channel}/kill`, { releaseId: r.id })}>Kill switch</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {nextCursor ? <div className="row"><button className="btn" type="button" onClick={loadMore}>Load more</button></div> : null}
      {detail ? (
        <section className="card" aria-label="Release detail and diff">
          <div className="row">
            <h3>Release <code>{detail.id}</code> ({detail.channel} · gen {detail.generation} · {detail.state})</h3>
            {detail.mediaProvenance && detail.mediaProvenance.pendingPreviewMedia.length > 0 ? (
              <span className="badge warn">{detail.mediaProvenance.pendingPreviewMedia.length} pending preview media (blocks production)</span>
            ) : (
              <span className="badge ok">media provenance verified</span>
            )}
            <button className="btn" type="button" onClick={() => downloadJson(`release-${detail.id}.json`, { detail, diff, economicPolicy: econ })}>Export release</button>
            <button className="btn" type="button" onClick={() => { setDetail(null); setDiff(null); setEcon(null); }}>Close</button>
          </div>
          <p className="mono">
            Client {detail.manifest.compat.min_client}–{detail.manifest.compat.max_client ?? '∞'} · schema {detail.manifest.compat.content_schema} · rollout {detail.manifest.rollout.percent}%
            {detail.manifest.compat.required_capabilities?.length ? ` · capabilities: ${detail.manifest.compat.required_capabilities.join(', ')}` : ''}
          </p>
          {diff ? (
            <div>
              <h4>Diff vs {diff.againstId ? <code>{diff.againstId}</code> : 'empty channel'}</h4>
              <p className="mono">+{diff.added.length} added · ~{diff.changed.length} changed · −{diff.removed.length} removed · ={diff.unchangedCount} unchanged</p>
              {diff.added.length + diff.changed.length + diff.removed.length > 0 ? (
                <ul className="mono">
                  {diff.added.map((f) => <li key={`a:${f.path}`}>+ {f.path} ({f.sha256.slice(0, 12)}…)</li>)}
                  {diff.changed.map((f) => <li key={`c:${f.path}`}>~ {f.path} ({f.beforeSha256.slice(0, 8)}… → {f.afterSha256.slice(0, 8)}…)</li>)}
                  {diff.removed.map((f) => <li key={`r:${f.path}`}>− {f.path}</li>)}
                </ul>
              ) : null}
              {diff.mediaProvenance.pendingPreviewMedia.length > 0 ? (
                <p className="mono">Pending preview media: {diff.mediaProvenance.pendingPreviewMedia.join(', ')}</p>
              ) : null}
            </div>
          ) : null}
          {econ ? (
            <div>
              <h4>Economic authority policy</h4>
              <p className="mono">
                Mode: {econ.policy?.mode ?? 'default (current pointer)'} · v{econ.policy?.version ?? 0}
                {econ.policy?.valid_until ? ` · valid until ${econ.policy.valid_until}` : ''}
                {econ.pointer ? ` · channel pointer ${econ.pointer.release_id} (floor gen ${econ.pointer.economic_floor})` : ''}
              </p>
              {canWrite ? (
                <form className="row" onSubmit={(e) => void saveEconomicPolicy(e)}>
                  <select name="mode" defaultValue={econ.policy?.mode ?? 'grace'}>
                    <option value="allowlisted">allowlisted (canary / manual)</option>
                    <option value="grace">grace (bounded cutover)</option>
                    <option value="revoked">revoked (immediate block)</option>
                  </select>
                  <input name="validUntil" placeholder="validUntil ISO (optional)" defaultValue={econ.policy?.valid_until ?? ''} />
                  <input name="reason" required minLength={5} maxLength={300} placeholder="reason for policy update" />
                  <button className="btn" type="submit">Update policy</button>
                </form>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
