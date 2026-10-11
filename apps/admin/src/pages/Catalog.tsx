import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

const TABS = ['Summary', 'Items', 'Gear', 'Rules'] as const;
type Tab = (typeof TABS)[number];
const msg = (x: unknown): string => (x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));

export function Catalog({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [tab, setTab] = useState<Tab>('Summary');
  return (
    <>
      <header className="page"><h2>Catalog &amp; rules</h2></header>
      <p>Materials, gear templates and the tunable rule sets (level curves, fees, drop tables, task payouts). Everything here is data: no deploy needed. Every change is audited and uses optimistic concurrency.</p>
      <div className="row" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={t === tab} className={`btn${t === tab ? ' primary' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Summary' ? <Summary /> : null}
      {tab === 'Items' ? <Items me={me} say={say} /> : null}
      {tab === 'Gear' ? <Gear /> : null}
      {tab === 'Rules' ? <Rules me={me} say={say} /> : null}
    </>
  );
}

function Summary(): ReactNode {
  const [d, setD] = useState<{ items: { kind: string; n: number }[]; gear: { slot: string; rarity: number; n: number }[]; sets: { set_id: string; name_en: string; pieces_for_bonus: number }[] } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { api<NonNullable<typeof d>>('/catalog/summary').then(setD).catch(setErr); }, []);
  if (err) return <ErrorNotice error={err} />;
  if (!d) return <p>Loading…</p>;
  return (
    <div className="grid">
      <section className="card"><h3>Materials</h3><table><tbody>{d.items.map((i) => <tr key={i.kind}><td>{i.kind}</td><td>{i.n}</td></tr>)}</tbody></table></section>
      <section className="card"><h3>Gear templates</h3><table><thead><tr><th>Slot</th><th>★</th><th>#</th></tr></thead><tbody>{d.gear.map((g) => <tr key={`${g.slot}${g.rarity}`}><td>{g.slot}</td><td>{g.rarity}</td><td>{g.n}</td></tr>)}</tbody></table></section>
      <section className="card"><h3>Accessory sets</h3><table><tbody>{d.sets.map((s) => <tr key={s.set_id}><td>{s.name_en}</td><td>{s.pieces_for_bonus}-piece</td></tr>)}</tbody></table></section>
    </div>
  );
}

interface Item { item_id: string; name_en: string; kind: string; rarity: number | null; stack_cap: number; xp_value: number | null; status: string; version: number }

function Items({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Item[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [edit, setEdit] = useState<{ id: string; name: string; xp: string; status: string } | null>(null);
  const load = (): void => { api<{ items: Item[] }>('/catalog/items').then((r) => setRows(r.items)).catch(setErr); };
  useEffect(load, []);
  const save = async (it: Item): Promise<void> => {
    if (!edit) return;
    try {
      await api(`/catalog/items/${it.item_id}`, { method: 'PATCH', body: JSON.stringify({ expectedVersion: it.version, name_en: edit.name, status: edit.status, ...(edit.xp !== '' ? { xp_value: Number(edit.xp) } : {}) }) });
      say(`${it.item_id} saved`); setEdit(null); load();
    } catch (x) { say(msg(x)); load(); }
  };
  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading items…</p>;
  const can = me.role !== 'viewer';
  return (
    <table>
      <thead><tr><th>Item</th><th>Name</th><th>Kind</th><th>★</th><th>Cap</th><th>XP</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((it) => {
        const e = edit?.id === it.item_id ? edit : null;
        return (
          <tr key={it.item_id}>
            <td><code>{it.item_id}</code></td>
            <td>{e ? <input value={e.name} onChange={(ev) => setEdit({ ...e, name: ev.target.value })} /> : it.name_en}</td>
            <td>{it.kind}</td><td>{it.rarity ?? '–'}</td><td>{it.stack_cap}</td>
            <td>{e ? <input size={6} value={e.xp} onChange={(ev) => setEdit({ ...e, xp: ev.target.value })} /> : (it.xp_value ?? '–')}</td>
            <td>{e ? <select value={e.status} onChange={(ev) => setEdit({ ...e, status: ev.target.value })}>{['active', 'hidden', 'retired'].map((s) => <option key={s}>{s}</option>)}</select> : <span className={`badge ${it.status === 'active' ? 'ok' : 'warn'}`}>{it.status}</span>}</td>
            <td>{can ? (e ? <><button className="btn primary" onClick={() => void save(it)}>Save</button> <button className="btn" onClick={() => setEdit(null)}>Cancel</button></> : <button className="btn" onClick={() => setEdit({ id: it.item_id, name: it.name_en, xp: it.xp_value === null ? '' : String(it.xp_value), status: it.status })}>Edit</button>) : null}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

interface GearRow { gear_id: string; slot: string; name_en: string; rarity: number; family: string; set_id: string | null; owner_character_id: string | null; banner_id: string | null; level_cap: number; status: string }

function Gear(): ReactNode {
  const [slot, setSlot] = useState('weapon');
  const [rows, setRows] = useState<GearRow[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { setRows(null); api<{ gear: GearRow[] }>(`/catalog/gear?slot=${slot}`).then((r) => setRows(r.gear)).catch(setErr); }, [slot]);
  if (err) return <ErrorNotice error={err} />;
  return (
    <>
      <div className="row">{['weapon', 'armor', 'necklace', 'ring'].map((s) => <button key={s} className={`btn${s === slot ? ' primary' : ''}`} onClick={() => setSlot(s)}>{s}</button>)}</div>
      {!rows ? <p>Loading…</p> : (
        <table>
          <thead><tr><th>Id</th><th>Name</th><th>★</th><th>Family / set</th><th>Owner</th><th>Banner</th><th>Cap</th><th>Status</th></tr></thead>
          <tbody>{rows.map((g) => <tr key={g.gear_id}><td><code>{g.gear_id}</code></td><td>{g.name_en}</td><td>{g.rarity}</td><td>{g.set_id ?? g.family}</td><td>{g.owner_character_id ?? '–'}</td><td>{g.banner_id ?? '–'}</td><td>{g.level_cap}</td><td>{g.status}</td></tr>)}</tbody>
        </table>
      )}
      <p className="muted">Showing up to 400 templates of this slot. Template stats are canon data; rules that use them are under <em>Rules</em>.</p>
    </>
  );
}

const KEYS = [
  { key: 'progression', label: 'Progression', hint: 'Level curves, ascension steps, skill ranks, account levels, equipment milestones and all upgrade fees (placeholders until the math pass).' },
  { key: 'gear', label: 'Gear', hint: 'Role-to-stat map for weapon secondary stats, equip slots, accessory reroll cost.' },
  { key: 'drops', label: 'Drop tables', hint: 'Per-table repeat and first-clear entries (chance, quantity, pools, boss-set guarantees). Concrete ids are checked against the catalog.' },
  { key: 'tasks', label: 'Tasks', hint: '12-hour window tasks, window completion bonus and the weekly cycle with payouts.' }
] as const;

function Rules({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [key, setKey] = useState<(typeof KEYS)[number]['key']>('progression');
  const [doc, setDoc] = useState<{ value: unknown; version: number; updated_at: string; updated_by: string } | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = (): void => {
    setDoc(null); setProblem(null);
    api<NonNullable<typeof doc>>(`/config/${key}`).then((d) => { setDoc(d); setText(JSON.stringify(d.value, null, 2)); }).catch(setErr);
  };
  useEffect(load, [key]);
  const save = async (): Promise<void> => {
    if (!doc) return;
    let value: unknown;
    try { value = JSON.parse(text); } catch (x) { setProblem(`Not valid JSON: ${(x as Error).message}`); return; }
    if (!window.confirm(`Save ${key} (v${doc.version} → v${doc.version + 1})? This changes live game rules.`)) return;
    try {
      await api(`/config/${key}`, { method: 'PUT', body: JSON.stringify({ value, expectedVersion: doc.version }) });
      say(`${key} saved`); load();
    } catch (x) { setProblem(msg(x)); }
  };
  if (err) return <ErrorNotice error={err} />;
  const meta = KEYS.find((k) => k.key === key);
  return (
    <>
      <div className="row">{KEYS.map((k) => <button key={k.key} className={`btn${k.key === key ? ' primary' : ''}`} onClick={() => setKey(k.key)}>{k.label}</button>)}</div>
      <p>{meta?.hint}</p>
      {!doc ? <p>Loading…</p> : (
        <>
          <p className="muted">v{doc.version} · updated {doc.updated_at} by {doc.updated_by}</p>
          <textarea aria-label={`${key} JSON`} spellCheck={false} value={text} onChange={(e) => { setText(e.target.value); setProblem(null); }} style={{ width: '100%', minHeight: 420, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} readOnly={me.role === 'viewer'} />
          {problem ? <div className="notice bad" role="alert">{problem}</div> : null}
          <div className="row">
            {me.role !== 'viewer' ? <button className="btn primary" onClick={() => void save()}>Validate &amp; save</button> : null}
            <button className="btn" onClick={load}>Reload</button>
          </div>
        </>
      )}
    </>
  );
}
