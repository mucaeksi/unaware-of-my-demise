import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, mediaTypeForPath, sha256HexBrowser, type Me, type CatalogSnapshot } from '../api';
import { ErrorNotice } from '../App';

const TABS = ['Summary', 'Items', 'Gear', 'Rules', 'Game Content (Scenes & Units)'] as const;
type Tab = (typeof TABS)[number];
const msg = (x: unknown): string => (x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));

export function Catalog({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [tab, setTab] = useState<Tab>('Summary');
  return (
    <>
      <header className="page"><h2>Catalog &amp; rules</h2></header>
      <p>Materials, gear templates, tunable rule sets, and live game content (story scripts, combat units, encounters, chapters, and audio cues). Everything here is data: no deploy needed.</p>
      <div className="row" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={t === tab} className={`btn${t === tab ? ' primary' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Summary' ? <><SnapshotExport /><Summary /></> : null}
      {tab === 'Items' ? <Items me={me} say={say} /> : null}
      {tab === 'Gear' ? <Gear me={me} say={say} /> : null}
      {tab === 'Rules' ? <Rules me={me} say={say} /> : null}
      {tab === 'Game Content (Scenes & Units)' ? <GameContentStudio me={me} say={say} /> : null}
    </>
  );
}

function SnapshotExport(): ReactNode {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CatalogSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const download = async (): Promise<void> => {
    setBusy(true); setError(null); setResult(null);
    try {
      const snapshot = await api<CatalogSnapshot>('/catalog/snapshot');
      const url = URL.createObjectURL(new Blob([snapshot.json], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'economy.json';
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResult(snapshot);
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };
  return <section className="card catalog-export" aria-labelledby="catalog-export-title">
    <h3 id="catalog-export-title">Catalog snapshot for a content draft</h3>
    <p>Export one validated copy of the current character, skill, item, gear, banner and rule definitions. Save it as <code>catalog/economy.json</code> in a complete content draft. Publication signs this snapshot for compatible clients (0.1.2 or later). Game operations use the selected release; later edits affect future drafts.</p>
    <button className="btn primary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing snapshot…' : 'Export catalog snapshot'}</button>
    {error ? <div role="alert"><p>{error}</p><button className="btn" onClick={() => void download()}>Retry export</button></div> : null}
    {result ? <div role="status"><p>Snapshot exported · {result.bytes.toLocaleString('en-US')} bytes</p><p>{Object.entries(result.counts).map(([key, count]) => `${key}: ${count}`).join(' · ')}</p><p>SHA-256: <code>{result.sha256}</code></p></div> : null}
  </section>;
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
  const [edit, setEdit] = useState<{ id: string; name: string; xp: string; cap: string; status: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const load = (): void => { api<{ items: Item[] }>('/catalog/items').then((r) => setRows(r.items)).catch(setErr); };
  useEffect(load, []);
  const save = async (it: Item): Promise<void> => {
    if (!edit) return;
    try {
      await api(`/catalog/items/${it.item_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: it.version,
          name_en: edit.name,
          status: edit.status,
          stack_cap: Number(edit.cap) || it.stack_cap,
          ...(edit.xp !== '' ? { xp_value: Number(edit.xp) } : {})
        })
      });
      say(`${it.item_id} saved`); setEdit(null); load();
    } catch (x) { say(msg(x)); load(); }
  };
  const createItem = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const rarityRaw = String(f.get('rarity') ?? '');
    const xpRaw = String(f.get('xp_value') ?? '');
    try {
      await api('/catalog/items', {
        method: 'POST',
        body: JSON.stringify({
          item_id: String(f.get('item_id')).trim(),
          name_en: String(f.get('name_en')).trim(),
          kind: String(f.get('kind')).trim(),
          rarity: rarityRaw ? Number(rarityRaw) : null,
          stack_cap: Number(f.get('stack_cap')) || 9999,
          xp_value: xpRaw ? Number(xpRaw) : null,
          status: String(f.get('status'))
        })
      });
      say('Item created');
      form.reset();
      setShowAdd(false);
      load();
    } catch (x) { say(msg(x)); }
  };
  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading items…</p>;
  const can = me.role !== 'viewer';
  return (
    <>
      {can ? (
        <div className="row">
          <button className="btn primary" type="button" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close form' : '+ New item'}</button>
        </div>
      ) : null}
      {showAdd && can ? (
        <form className="row card" onSubmit={(e) => void createItem(e)}>
          <label>Item ID<input name="item_id" required pattern="[a-z][a-z0-9_]{1,63}" placeholder="ember_shard" /></label>
          <label>Name<input name="name_en" required placeholder="Ember Shard" /></label>
          <label>Kind<input name="kind" required defaultValue="ascension_material" /></label>
          <label>Rarity<select name="rarity" defaultValue="4"><option value="">—</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option></select></label>
          <label>Stack cap<input name="stack_cap" type="number" min="1" defaultValue="9999" required /></label>
          <label>XP value<input name="xp_value" type="number" min="0" placeholder="optional" /></label>
          <label>Status<select name="status" defaultValue="active"><option>active</option><option>hidden</option><option>retired</option></select></label>
          <button className="btn primary" type="submit">Create item</button>
        </form>
      ) : null}
      <table>
        <thead><tr><th>Item</th><th>Name</th><th>Kind</th><th>★</th><th>Cap</th><th>XP</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((it) => {
          const e = edit?.id === it.item_id ? edit : null;
          return (
            <tr key={it.item_id}>
              <td><code>{it.item_id}</code></td>
              <td>{e ? <input value={e.name} onChange={(ev) => setEdit({ ...e, name: ev.target.value })} /> : it.name_en}</td>
              <td>{it.kind}</td><td>{it.rarity ?? '–'}</td>
              <td>{e ? <input size={6} value={e.cap} onChange={(ev) => setEdit({ ...e, cap: ev.target.value })} /> : it.stack_cap}</td>
              <td>{e ? <input size={6} value={e.xp} onChange={(ev) => setEdit({ ...e, xp: ev.target.value })} /> : (it.xp_value ?? '–')}</td>
              <td>{e ? <select value={e.status} onChange={(ev) => setEdit({ ...e, status: ev.target.value })}>{['active', 'hidden', 'retired'].map((s) => <option key={s}>{s}</option>)}</select> : <span className={`badge ${it.status === 'active' ? 'ok' : 'warn'}`}>{it.status}</span>}</td>
              <td>{can ? (e ? <><button className="btn primary" onClick={() => void save(it)}>Save</button> <button className="btn" onClick={() => setEdit(null)}>Cancel</button></> : <button className="btn" onClick={() => setEdit({ id: it.item_id, name: it.name_en, xp: it.xp_value === null ? '' : String(it.xp_value), cap: String(it.stack_cap), status: it.status })}>Edit</button>) : null}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </>
  );
}

interface GearRow { gear_id: string; slot: string; name_en: string; rarity: number; family: string; set_id: string | null; owner_character_id: string | null; banner_id: string | null; level_cap: number; status: string; version: number }

function Gear({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [slot, setSlot] = useState('weapon');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<GearRow[] | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string; cap: string; status: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => { setRows(null); api<{ gear: GearRow[] }>(`/catalog/gear?slot=${slot}`).then((r) => setRows(r.gear)).catch(setErr); };
  useEffect(load, [slot]);
  const save = async (g: GearRow): Promise<void> => {
    if (!edit) return;
    try {
      await api(`/catalog/gear/${g.gear_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: g.version, name_en: edit.name, level_cap: Number(edit.cap), status: edit.status })
      });
      say(`${g.gear_id} saved`);
      setEdit(null);
      load();
    } catch (x) { say(msg(x)); load(); }
  };
  if (err) return <ErrorNotice error={err} />;
  const can = me.role !== 'viewer';
  const filtered = (rows ?? []).filter((g) => !q.trim() || `${g.gear_id} ${g.name_en} ${g.family} ${g.set_id ?? ''} ${g.owner_character_id ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <div className="row">
        {['weapon', 'armor', 'necklace', 'ring'].map((s) => <button key={s} className={`btn${s === slot ? ' primary' : ''}`} onClick={() => setSlot(s)}>{s}</button>)}
        <input placeholder="Filter gear by id, name, owner…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!rows ? <p>Loading…</p> : (
        <table>
          <thead><tr><th>Id</th><th>Name</th><th>★</th><th>Family / set</th><th>Owner</th><th>Banner</th><th>Cap</th><th>Status</th><th /></tr></thead>
          <tbody>{filtered.map((g) => {
            const e = edit?.id === g.gear_id ? edit : null;
            return (
              <tr key={g.gear_id}>
                <td><code>{g.gear_id}</code></td>
                <td>{e ? <input value={e.name} onChange={(ev) => setEdit({ ...e, name: ev.target.value })} /> : g.name_en}</td>
                <td>{g.rarity}</td><td>{g.set_id ?? g.family}</td><td>{g.owner_character_id ?? '–'}</td><td>{g.banner_id ?? '–'}</td>
                <td>{e ? <input size={5} value={e.cap} onChange={(ev) => setEdit({ ...e, cap: ev.target.value })} /> : g.level_cap}</td>
                <td>{e ? <select value={e.status} onChange={(ev) => setEdit({ ...e, status: ev.target.value })}>{['active', 'hidden', 'retired'].map((s) => <option key={s}>{s}</option>)}</select> : <span className={`badge ${g.status === 'active' ? 'ok' : 'warn'}`}>{g.status}</span>}</td>
                <td>{can ? (e ? <><button className="btn primary" onClick={() => void save(g)}>Save</button> <button className="btn" onClick={() => setEdit(null)}>Cancel</button></> : <button className="btn" onClick={() => setEdit({ id: g.gear_id, name: g.name_en, cap: String(g.level_cap), status: g.status })}>Edit</button>) : null}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      <p className="muted">Showing {filtered.length} of {rows?.length ?? 0} templates in this slot. Rules that use them are under <em>Rules</em>.</p>
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

const CONTENT_FILES: { path: string; label: string; group: string }[] = [
  { path: 'entry/prologue.json', label: 'Prologue · Before the Road (120s 9-Shot Script)', group: 'Story & Scenes' },
  { path: 'story/tutorial_t1_before.json', label: 'Tutorial T-1 · Before Battle (The First Step)', group: 'Story & Scenes' },
  { path: 'story/tutorial_t1_after.json', label: 'Tutorial T-1 · After Battle', group: 'Story & Scenes' },
  { path: 'story/tutorial_t2_before.json', label: 'Tutorial T-2 · Before Battle (A Road Forgotten)', group: 'Story & Scenes' },
  { path: 'story/tutorial_t2_after.json', label: 'Tutorial T-2 · After Battle', group: 'Story & Scenes' },
  { path: 'story/tutorial_t3_before.json', label: 'Tutorial T-3 · Before Battle (A Roof Before Dawn)', group: 'Story & Scenes' },
  { path: 'story/tutorial_t3_after.json', label: 'Tutorial T-3 · Finale After Battle', group: 'Story & Scenes' },
  { path: 'units/unit_pack.json', label: 'Combat Units & Skills (unit_pack.json)', group: 'Combat & Encounters' },
  { path: 'encounters/tutorial_t1.json', label: 'Encounter · Tutorial T-1 (Whispering Ash)', group: 'Combat & Encounters' },
  { path: 'encounters/tutorial_t2.json', label: 'Encounter · Tutorial T-2 (Stone Crossing)', group: 'Combat & Encounters' },
  { path: 'encounters/tutorial_t3.json', label: 'Encounter · Tutorial T-3 (Shelter Courtyard)', group: 'Combat & Encounters' },
  { path: 'entry/entry_index.json', label: 'Entry Sequence Graph (entry_index.json)', group: 'Progression & Audio' },
  { path: 'chapters/chapter_index.json', label: 'Chapters & Stage Graph (chapter_index.json)', group: 'Progression & Audio' },
  { path: 'presentation/presentation.json', label: 'Audio, Voiceovers & Cues (presentation.json)', group: 'Progression & Audio' },
  { path: 'art/art_manifest.json', label: 'Art & Music Manifest (art_manifest.json)', group: 'Progression & Audio' }
];

function GameContentStudio({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [selectedPath, setSelectedPath] = useState(CONTENT_FILES[0]!.path);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const canEdit = me.role !== 'viewer';

  const loadFile = async (path: string): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch(`/dev/media/${path}`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`Could not load /dev/media/${path} (HTTP ${r.status})`);
      const raw = await r.text();
      const obj = JSON.parse(raw) as unknown;
      setText(JSON.stringify(obj, null, 2));
      setParsed(obj);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadFile(selectedPath);
  }, [selectedPath]);

  const publishLiveEdit = async (publishNow: boolean): Promise<void> => {
    let val: unknown;
    try {
      val = JSON.parse(text);
      setParsed(val);
    } catch (e) {
      setProblem(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(val, null, 2)).buffer as ArrayBuffer;
      const sha256 = await sha256HexBrowser(bytes);
      const mediaType = mediaTypeForPath(selectedPath);
      const up = await fetch(`/admin/api/objects/${sha256}`, {
        method: 'PUT',
        headers: { 'Content-Type': mediaType },
        body: bytes,
        credentials: 'same-origin'
      });
      if (!up.ok) throw new Error(`Object upload failed (HTTP ${up.status})`);

      const sys = await api<{ environment: string; pointers: { channel: string; release_id: string }[] }>('/system');
      const channel = sys.environment || 'dev';
      const baseId = sys.pointers.find((p) => p.channel === channel)?.release_id ?? 'rel_0001';
      const draftId = `rel_edit_${Date.now().toString(36).slice(-6)}`;
      await api('/releases', {
        method: 'POST',
        body: JSON.stringify({
          id: draftId,
          channel,
          dependsOn: baseId,
          minClient: '0.1.2',
          notes: `Control Center edit of ${selectedPath}`,
          files: [{ path: selectedPath, sha256 }]
        })
      });
      if (publishNow) {
        await api(`/releases/${draftId}/publish`, { method: 'POST', body: '{}' });
        say(`Published live patch ${draftId} on ${channel} with updated ${selectedPath}`);
      } else {
        say(`Created draft release ${draftId} on ${channel} for ${selectedPath}`);
      }
    } catch (e) {
      setProblem(msg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split-pane" style={{ marginTop: 14 }}>
      <aside className="card">
        <h3>Game Files</h3>
        <p className="muted">Select any scene, unit pack, encounter, or audio manifest to inspect and edit.</p>
        {CONTENT_FILES.map((f) => (
          <button
            key={f.path}
            type="button"
            className={`btn${selectedPath === f.path ? ' primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, textAlign: 'left' }}
            onClick={() => setSelectedPath(f.path)}
          >
            <div>
              <div>{f.label}</div>
              <div className="mono" style={{ fontSize: 11 }}>{f.path}</div>
            </div>
          </button>
        ))}
      </aside>
      <div>
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Visual Inspector — <code>{selectedPath}</code></h3>
            <button className="btn" type="button" disabled={busy} onClick={() => void loadFile(selectedPath)}>Reload default</button>
          </div>
          <VisualContentSummary path={selectedPath} data={parsed} />
        </section>
        <section className="card">
          <h3>Live JSON Editor — <code>{selectedPath}</code></h3>
          <p className="muted">Edit the JSON structure below. Clicking “Stage Draft” or “Save &amp; Publish Patch” validates the schema against the server and creates a signed content release.</p>
          <textarea
            aria-label={`${selectedPath} JSON editor`}
            spellCheck={false}
            value={text}
            readOnly={!canEdit}
            onChange={(e) => { setText(e.target.value); setProblem(null); }}
            style={{ width: '100%', minHeight: 420, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          />
          {problem ? <div className="notice bad" role="alert">{problem}</div> : null}
          {canEdit ? (
            <div className="row">
              <button className="btn" type="button" disabled={busy} onClick={() => void publishLiveEdit(false)}>
                {busy ? 'Working…' : 'Stage as Release Draft'}
              </button>
              <button className="btn primary" type="button" disabled={busy} onClick={() => void publishLiveEdit(true)}>
                {busy ? 'Publishing…' : 'Save & Publish Live Patch'}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function VisualContentSummary({ path, data }: { path: string; data: unknown }): ReactNode {
  if (!data || typeof data !== 'object') return <p className="muted">No structured preview available.</p>;
  const obj = data as Record<string, unknown>;

  // Prologue scenes
  if (Array.isArray(obj.scenes)) {
    const scenes = obj.scenes as {
      id?: string;
      duration_seconds?: number;
      visual?: string;
      caption_en?: string;
      line_id?: string;
      text_en?: string;
      audio_cue?: string;
    }[];
    return (
      <table>
        <thead><tr><th>Shot</th><th>Duration</th><th>Visual Plate</th><th>Caption &amp; Narration</th><th>Voice Preview</th></tr></thead>
        <tbody>
          {scenes.map((s, i) => (
            <tr key={s.id ?? i}>
              <td><code>{s.id ?? `shot_${i + 1}`}</code></td>
              <td className="mono">{s.duration_seconds ?? 0}s</td>
              <td><span className="badge info">{s.visual ?? '—'}</span></td>
              <td>
                {s.caption_en ? <div><strong>{s.caption_en}</strong></div> : null}
                <div>“{s.text_en ?? ''}”</div>
              </td>
              <td>
                {s.line_id ? (
                  <audio controls preload="none" src={`/dev/media/voices/${s.line_id}.ogg`} style={{ height: 28, maxWidth: 210 }} />
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Story dialogue script
  if (Array.isArray(obj.commands)) {
    const cmds = obj.commands as {
      op?: string;
      speaker?: string;
      speaker_display?: string;
      character?: string;
      location_id?: string;
      cue_id?: string;
      text?: string;
      line_id?: string;
      emotion?: string;
    }[];
    return (
      <table>
        <thead><tr><th>#</th><th>Op</th><th>Speaker / Cue</th><th>Dialogue / Target</th></tr></thead>
        <tbody>
          {cmds.slice(0, 40).map((c, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td><span className="badge info">{c.op}</span></td>
              <td>
                {c.speaker_display || c.speaker ? <strong>{c.speaker_display ?? c.speaker}</strong> : <code>{c.character ?? c.location_id ?? c.cue_id ?? '—'}</code>}
                {c.emotion ? <div className="mono">{c.emotion}</div> : null}
              </td>
              <td>
                {c.text ?? c.location_id ?? c.cue_id ?? c.character ?? '—'}
                {c.line_id ? (
                  <div style={{ marginTop: 4 }}>
                    <audio controls preload="none" src={`/dev/media/voices/${c.line_id}.ogg`} style={{ height: 28, maxWidth: 240 }} />
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Unit pack
  if (Array.isArray(obj.units)) {
    const units = obj.units as {
      unit_id: string;
      name_en: string;
      kind: string;
      element: string;
      role?: string;
      base_stats?: { hp: number; atk: number; def: number; spd: number };
      attributes?: { power: string; base: { str: number; int: number; vit: number; agi: number }; armor?: number };
      skills: { skill_id: string; name_en: string; type: string; cooldown_turns: number }[];
    }[];
    return (
      <table>
        <thead><tr><th>Unit ID</th><th>Name</th><th>Kind / Element</th><th>Stats (STR/INT/VIT/AGI or legacy HP/ATK/DEF/SPD)</th><th>Skills</th></tr></thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.unit_id}>
              <td><code>{u.unit_id}</code></td>
              <td><strong>{u.name_en}</strong></td>
              <td><span className={`badge ${u.kind === 'character' ? 'ok' : 'warn'}`}>{u.kind}</span> · {u.element}</td>
              <td className="mono">{u.attributes ? `${u.attributes.base.str} / ${u.attributes.base.int} / ${u.attributes.base.vit} / ${u.attributes.base.agi} · ${u.attributes.power.toUpperCase()}${u.attributes.armor ? ` · armor ${u.attributes.armor}` : ''}` : u.base_stats ? `${u.base_stats.hp} / ${u.base_stats.atk} / ${u.base_stats.def} / ${u.base_stats.spd}` : '—'}</td>
              <td>{u.skills.map((sk) => <div key={sk.skill_id}><code>{sk.type}</code>: {sk.name_en} (CD {sk.cooldown_turns})</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Encounter
  if (Array.isArray(obj.enemies)) {
    const party = (obj.party as { unit_id: string; slot: number; level?: number; row?: string }[] | undefined) ?? [];
    const enemies = obj.enemies as { unit_id: string; slot: number; level?: number; row?: string }[];
    return (
      <div>
        <p className="mono">
          Encounter: <code>{String(obj.encounter_id ?? path)}</code> ({String(obj.stage_id ?? '')} · {String(obj.title_en ?? '')}) · Location: <code>{String(obj.location_id ?? 'default')}</code>
        </p>
        <table>
          <thead><tr><th>Side</th><th>Slot &amp; Row</th><th>Unit ID</th><th>Level</th></tr></thead>
          <tbody>
            {party.map((p, i) => <tr key={`p_${i}`}><td><span className="badge ok">Party</span></td><td>Slot {p.slot} ({p.row ?? 'front'})</td><td><code>{p.unit_id}</code></td><td>Lv {p.level ?? 1}</td></tr>)}
            {enemies.map((e, i) => <tr key={`e_${i}`}><td><span className="badge warn">Enemy</span></td><td>Slot {e.slot} ({e.row ?? 'front'})</td><td><code>{e.unit_id}</code></td><td>Lv {e.level ?? 1}</td></tr>)}
          </tbody>
        </table>
      </div>
    );
  }

  // Chapters
  if (Array.isArray(obj.chapters)) {
    const chapters = obj.chapters as { chapter_id: string; title_en: string; nodes: { node_id: string; kind: string; title_en: string; encounter?: string; requires?: string }[] }[];
    return (
      <div>
        {chapters.map((ch) => (
          <div key={ch.chapter_id} style={{ marginBottom: 12 }}>
            <h4>{ch.title_en} (<code>{ch.chapter_id}</code>) — {ch.nodes.length} nodes</h4>
            <table>
              <thead><tr><th>Node ID</th><th>Kind</th><th>Title</th><th>Encounter</th><th>Requires</th></tr></thead>
              <tbody>
                {ch.nodes.map((n) => <tr key={n.node_id}><td><code>{n.node_id}</code></td><td><span className="badge info">{n.kind}</span></td><td>{n.title_en}</td><td><code>{n.encounter ?? '—'}</code></td><td><code>{n.requires ?? '—'}</code></td></tr>)}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  return <p className="mono">Loaded {path} ({Object.keys(obj).join(', ')})</p>;
}
