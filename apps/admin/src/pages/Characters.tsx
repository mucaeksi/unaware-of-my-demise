import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, downloadJson, type Character, type Me } from '../api';
import { ErrorNotice } from '../App';

const ELEMENTS = ['Veil', 'Ember', 'Gale', 'Stone', 'Tide', 'Dawn'] as const;

export function Characters({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Character[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [detail, setDetail] = useState<Character | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [edit, setEdit] = useState<Character | null>(null);
  const [creating, setCreating] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const createDlg = useRef<HTMLDialogElement>(null);
  const canEdit = me.role !== 'viewer';

  const buildQuery = useCallback((cursor?: string | null): string => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (rarityFilter) params.set('rarity', rarityFilter);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return `/characters${qs ? `?${qs}` : ''}`;
  }, [q, statusFilter, rarityFilter]);

  const load = useCallback((): void => {
    api<{ characters: Character[]; nextCursor?: string | null }>(buildQuery())
      .then((r) => {
        setRows(r.characters);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  }, [buildQuery]);

  const loadMore = (): void => {
    if (!nextCursor || !rows) return;
    api<{ characters: Character[]; nextCursor?: string | null }>(buildQuery(nextCursor))
      .then((r) => {
        setRows([...rows, ...r.characters]);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  };

  const inspect = (id: string): void => {
    api<{ character: Character }>(`/characters/${encodeURIComponent(id)}`)
      .then((r) => setDetail(r.character))
      .catch(setErr);
  };

  useEffect(load, [load]);
  useEffect(() => {
    if (edit) dlg.current?.showModal();
    else dlg.current?.close();
  }, [edit]);
  useEffect(() => {
    if (creating) createDlg.current?.showModal();
    else createDlg.current?.close();
  }, [creating]);

  const save = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!edit) return;
    const f = new FormData(e.currentTarget);
    const num = (k: string): number => Number(f.get(k));
    try {
      await api(`/characters/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: edit.version,
          name_en: String(f.get('name_en')),
          status: String(f.get('status')),
          rarity: num('rarity'),
          element: String(f.get('element')),
          role: String(f.get('role')),
          age: num('age'),
          acquisition: String(f.get('acquisition')),
          base_hp: num('base_hp'),
          base_atk: num('base_atk'),
          base_def: num('base_def'),
          base_spd: num('base_spd')
        })
      });
      say(`${edit.name_en} saved`);
      setEdit(null);
      load();
      if (detail?.id === edit.id) inspect(edit.id);
    } catch (x) {
      say(x instanceof ApiError && x.code === 'version_conflict' ? 'Someone else changed this character — reloaded.' : String((x as Error).message));
      if (x instanceof ApiError && x.code === 'version_conflict') {
        setEdit(null);
        load();
      }
    }
  };

  const createCharacter = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const num = (k: string): number => Number(f.get(k));
    try {
      await api('/characters', {
        method: 'POST',
        body: JSON.stringify({
          id: String(f.get('id')).trim(),
          name_en: String(f.get('name_en')).trim(),
          rarity: num('rarity'),
          element: String(f.get('element')),
          role: String(f.get('role')).trim(),
          age: num('age'),
          acquisition: String(f.get('acquisition')).trim(),
          base_hp: num('base_hp'),
          base_atk: num('base_atk'),
          base_def: num('base_def'),
          base_spd: num('base_spd'),
          status: String(f.get('status'))
        })
      });
      say(`Character ${String(f.get('name_en'))} created`);
      form.reset();
      setCreating(false);
      load();
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading characters…</p>;
  return (
    <>
      <header className="page">
        <h2>Characters</h2>
        <span className="badge">{rows.length} in D1</span>
        {canEdit ? <button className="btn primary" type="button" onClick={() => setCreating(true)}>+ New character</button> : null}
        <button className="btn" type="button" onClick={() => downloadJson('characters.json', rows)}>Export JSON</button>
      </header>
      <div className="row" role="search" aria-label="Filter characters">
        <input aria-label="Search characters" placeholder="id or name" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} />
        <select aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="hidden">hidden</option>
          <option value="retired">retired</option>
        </select>
        <select aria-label="Filter rarity" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
          <option value="">All rarities</option>
          <option value="5">5★</option>
          <option value="4">4★</option>
          <option value="3">3★</option>
        </select>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>★</th><th>Element</th><th>Role</th><th>HP</th><th>ATK</th><th>DEF</th><th>SPD</th><th>Status</th><th>v</th><th /></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><code>{c.id}</code></td><td>{c.name_en}</td><td>{c.rarity}</td><td>{c.element}</td><td>{c.role}</td>
              <td>{c.base_hp}</td><td>{c.base_atk}</td><td>{c.base_def}</td><td>{c.base_spd}</td>
              <td><span className={`badge ${c.status === 'active' ? 'ok' : 'warn'}`}>{c.status}</span></td><td>{c.version}</td>
              <td className="row">
                <button className="btn" type="button" onClick={() => inspect(c.id)}>Inspect</button>
                {canEdit ? <button className="btn" onClick={() => setEdit(c)} aria-label={`Edit ${c.name_en}`}>Edit</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? <div className="row"><button className="btn" type="button" onClick={loadMore}>Load more</button></div> : null}
      {detail ? (
        <section className="card" aria-label="Character detail">
          <div className="row">
            <h3>{detail.name_en} (<code>{detail.id}</code>)</h3>
            <button className="btn" type="button" onClick={() => downloadJson(`character-${detail.id}.json`, detail)}>Export detail</button>
            <button className="btn" type="button" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p className="mono">{detail.rarity}★ · {detail.element} · {detail.role} · acquisition: {detail.acquisition} · age: {detail.age} · v{detail.version} ({detail.updated_by} at {detail.updated_at})</p>
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <div className="media-card" style={{ width: 220 }}>
              <div className="mono">Portrait</div>
              <img
                src={`/dev/media/art/portrait_${detail.id}_composed.webp`}
                alt={`${detail.name_en} portrait`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="media-card" style={{ width: 260 }}>
              <div className="mono">SD Chibi Atlas</div>
              <img
                src={`/dev/media/art/atlas_${detail.id}.webp`}
                alt={`${detail.name_en} chibi atlas`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>
        </section>
      ) : null}
      <dialog ref={dlg} onClose={() => setEdit(null)}>
        {edit ? (
          <form onSubmit={save} className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <h3>Edit {edit.id} <span className="badge">v{edit.version}</span></h3>
            <label>Name<input name="name_en" defaultValue={edit.name_en} required maxLength={60} /></label>
            <div className="row">
              <label>Status<select name="status" defaultValue={edit.status}><option>active</option><option>hidden</option><option>retired</option></select></label>
              <label>Rarity<select name="rarity" defaultValue={String(edit.rarity)}><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option></select></label>
              <label>Element<select name="element" defaultValue={edit.element}>{ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}</select></label>
            </div>
            <div className="row">
              <label>Role<input name="role" defaultValue={edit.role} required maxLength={40} /></label>
              <label>Age<input name="age" type="number" min="0" max="9999" defaultValue={edit.age} required /></label>
              <label>Acquisition<input name="acquisition" defaultValue={edit.acquisition} required maxLength={40} /></label>
            </div>
            <div className="row">
              <label>HP<input name="base_hp" type="number" step="0.01" min="0.01" defaultValue={edit.base_hp} required /></label>
              <label>ATK<input name="base_atk" type="number" step="0.01" min="0" defaultValue={edit.base_atk} required /></label>
              <label>DEF<input name="base_def" type="number" step="0.01" min="0" defaultValue={edit.base_def} required /></label>
              <label>SPD<input name="base_spd" type="number" step="0.01" min="0.01" defaultValue={edit.base_spd} required /></label>
            </div>
            <div className="row"><button className="btn primary" type="submit">Save</button><button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        ) : null}
      </dialog>
      <dialog ref={createDlg} onClose={() => setCreating(false)}>
        {creating ? (
          <form onSubmit={createCharacter} className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <h3>Create new character</h3>
            <div className="row">
              <label>ID (snake_case)<input name="id" required pattern="[a-z][a-z0-9_]{1,47}" placeholder="new_companion" /></label>
              <label>Name<input name="name_en" required maxLength={60} placeholder="New Companion" /></label>
            </div>
            <div className="row">
              <label>Rarity<select name="rarity" defaultValue="5"><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option></select></label>
              <label>Element<select name="element" defaultValue="Veil">{ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}</select></label>
              <label>Status<select name="status" defaultValue="active"><option>active</option><option>hidden</option><option>retired</option></select></label>
            </div>
            <div className="row">
              <label>Role<input name="role" defaultValue="dps" required maxLength={40} /></label>
              <label>Age<input name="age" type="number" min="0" max="9999" defaultValue="22" required /></label>
              <label>Acquisition<input name="acquisition" defaultValue="gacha" required maxLength={40} /></label>
            </div>
            <div className="row">
              <label>HP<input name="base_hp" type="number" step="0.01" min="0.01" defaultValue="14" required /></label>
              <label>ATK<input name="base_atk" type="number" step="0.01" min="0" defaultValue="4" required /></label>
              <label>DEF<input name="base_def" type="number" step="0.01" min="0" defaultValue="2" required /></label>
              <label>SPD<input name="base_spd" type="number" step="0.01" min="0.01" defaultValue="5" required /></label>
            </div>
            <div className="row">
              <button className="btn primary" type="submit">Create character</button>
              <button className="btn" type="button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
