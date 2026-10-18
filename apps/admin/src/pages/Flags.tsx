import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Flag { key: string; enabled: number; value_json: string; note: string; version: number; updated_at: string; updated_by: string }

export function Flags({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Flag[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [editor, setEditor] = useState<{ key: string; enabled: boolean; valueText: string; note: string; expectedVersion: number } | null>(null);
  const canEdit = me.role !== 'viewer';
  const load = (): void => { api<{ flags: Flag[] }>('/flags').then((r) => setRows(r.flags)).catch(setErr); };
  useEffect(load, []);
  const set = async (f: Flag): Promise<void> => {
    if (f.enabled && /^(gacha|shop|ads)\./.test(f.key) && !window.confirm(`Switch OFF ${f.key}? Players lose this feature immediately.`)) return;
    try {
      await api(`/flags/${f.key}`, { method: 'PUT', body: JSON.stringify({ enabled: !f.enabled, value: JSON.parse(f.value_json), note: f.note, expectedVersion: f.version }) });
      say(`${f.key} → ${f.enabled ? 'off' : 'on'}`); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); load(); }
  };

  const openEditor = (f?: Flag): void => {
    setEditor({
      key: f?.key ?? 'liveops.event_active',
      enabled: f ? f.enabled === 1 : true,
      valueText: f ? f.value_json : 'null',
      note: f?.note ?? '',
      expectedVersion: f ? f.version : 0
    });
  };

  const saveEditor = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!editor) return;
    try {
      const value = editor.valueText.trim() ? JSON.parse(editor.valueText) : null;
      await api(`/flags/${encodeURIComponent(editor.key.trim())}`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: editor.enabled,
          value,
          note: editor.note.trim(),
          expectedVersion: editor.expectedVersion
        })
      });
      say(editor.expectedVersion === 0 ? `Flag ${editor.key} created` : `Flag ${editor.key} updated`);
      setEditor(null);
      load();
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading flags…</p>;
  return (
    <>
      <header className="page">
        <h2>Feature flags</h2>
        <span className="badge">{rows.length}</span>
        {canEdit ? (
          <button className="btn primary" type="button" onClick={() => openEditor()}>
            + New flag
          </button>
        ) : null}
      </header>
      <p>Emergency brakes and LiveOps switches. The client reads them at boot; the server enforces the money-touching ones on every request.</p>

      {editor ? (
        <form className="card" onSubmit={(e) => void saveEditor(e)} aria-label="Flag editor" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{editor.expectedVersion === 0 ? 'Create feature flag' : `Edit flag: ${editor.key}`}</h3>
            <span className="badge">{editor.expectedVersion === 0 ? 'new' : `v${editor.expectedVersion}`}</span>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <label>Key <input value={editor.key} disabled={editor.expectedVersion > 0} onChange={(e) => setEditor({ ...editor, key: e.target.value })} required /></label>
            <label>Value (JSON) <input value={editor.valueText} onChange={(e) => setEditor({ ...editor, valueText: e.target.value })} /></label>
            <label style={{ flex: 1 }}>Note <input style={{ width: '100%' }} value={editor.note} onChange={(e) => setEditor({ ...editor, note: e.target.value })} /></label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={editor.enabled} onChange={(e) => setEditor({ ...editor, enabled: e.target.checked })} /> Enabled
            </label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" type="submit">Save flag</button>
            <button className="btn" type="button" onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      <table>
        <thead><tr><th>Key</th><th>State</th><th>Value</th><th>Note</th><th>v</th><th>Updated</th><th /></tr></thead>
        <tbody>{rows.map((f) => (
          <tr key={f.key}><td><code>{f.key}</code></td><td><span className={`badge ${f.enabled ? 'ok' : 'warn'}`}>{f.enabled ? 'on' : 'off'}</span></td><td className="mono">{f.value_json}</td><td>{f.note}</td><td>{f.version}</td><td>{f.updated_at} · {f.updated_by}</td>
            <td className="row">
              {canEdit ? <button className="btn" onClick={() => openEditor(f)}>Edit</button> : null}
              {canEdit ? <button className="btn" onClick={() => void set(f)}>Turn {f.enabled ? 'off' : 'on'}</button> : null}
            </td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

