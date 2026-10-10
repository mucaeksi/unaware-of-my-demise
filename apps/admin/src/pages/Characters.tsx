import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Character, type Me } from '../api';
import { ErrorNotice } from '../App';

export function Characters({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Character[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [edit, setEdit] = useState<Character | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const canEdit = me.role !== 'viewer';
  const load = (): void => {
    api<{ characters: Character[] }>('/characters').then((r) => setRows(r.characters)).catch(setErr);
  };
  useEffect(load, []);
  useEffect(() => {
    if (edit) dlg.current?.showModal();
    else dlg.current?.close();
  }, [edit]);

  const save = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!edit) return;
    const f = new FormData(e.currentTarget);
    const num = (k: string): number => Number(f.get(k));
    try {
      await api(`/characters/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: edit.version, name_en: String(f.get('name_en')), status: String(f.get('status')), base_hp: num('base_hp'), base_atk: num('base_atk'), base_def: num('base_def'), base_spd: num('base_spd') })
      });
      say(`${edit.name_en} saved`);
      setEdit(null);
      load();
    } catch (x) {
      say(x instanceof ApiError && x.code === 'version_conflict' ? 'Someone else changed this character — reloaded.' : String((x as Error).message));
      if (x instanceof ApiError && x.code === 'version_conflict') {
        setEdit(null);
        load();
      }
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading characters…</p>;
  return (
    <>
      <header className="page"><h2>Characters</h2><span className="badge">{rows.length} in D1</span></header>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>★</th><th>Element</th><th>Role</th><th>HP</th><th>ATK</th><th>DEF</th><th>SPD</th><th>Status</th><th>v</th><th /></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><code>{c.id}</code></td><td>{c.name_en}</td><td>{c.rarity}</td><td>{c.element}</td><td>{c.role}</td>
              <td>{c.base_hp}</td><td>{c.base_atk}</td><td>{c.base_def}</td><td>{c.base_spd}</td>
              <td><span className={`badge ${c.status === 'active' ? 'ok' : 'warn'}`}>{c.status}</span></td><td>{c.version}</td>
              <td>{canEdit ? <button className="btn" onClick={() => setEdit(c)} aria-label={`Edit ${c.name_en}`}>Edit</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dialog ref={dlg} onClose={() => setEdit(null)}>
        {edit ? (
          <form onSubmit={save} className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <h3>Edit {edit.id} <span className="badge">v{edit.version}</span></h3>
            <label>Name<input name="name_en" defaultValue={edit.name_en} required maxLength={60} /></label>
            <label>Status<select name="status" defaultValue={edit.status}><option>active</option><option>hidden</option><option>retired</option></select></label>
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
    </>
  );
}
