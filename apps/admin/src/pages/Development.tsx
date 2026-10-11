import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Item { title: string; detail: string }
interface Progress {
  generatedAt: string;
  summary: { total: number; done: number; partial: number; missing: number };
  roadmap: { n: number; area: string; status: string; detail: string }[];
  decisions: { id: string; when: string; what: string; note: string }[];
  commits: { sha: string; at: string; subject: string }[];
  screens: { file: string; caption: string }[];
  now: Item[];
  next: Item[];
  blockedOnOwner: Item[];
  ideas: { from: string; date: string; text: string; status: string }[];
}
interface Note { id: number; area: string; kind: string; body: string; status: string; resolution: string; created_by: string; created_at: string; updated_by: string | null }

const TABS = ['Overview', 'Live preview', 'Screens', 'Feedback'] as const;
type Tab = (typeof TABS)[number];
const AREAS = ['General', 'Title', 'Company hub', 'Summon', 'Roster', 'Mail', 'Shop', 'Account', 'Battle', 'Story', 'Chapters', 'Control Center', 'Economy', 'Art direction'];

/** Where the browser build of the game lives: the sibling Worker of this admin, or the local dev server. */
function gameUrl(): string {
  const h = window.location.hostname;
  if (h === '127.0.0.1' || h === 'localhost') return 'http://127.0.0.1:8787/';
  return `${window.location.protocol}//${h.replace(/^uomd-admin/, 'uomd-game')}/`;
}

export function Development({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [tab, setTab] = useState<Tab>('Overview');
  const [p, setP] = useState<Progress | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [area, setArea] = useState('General');
  useEffect(() => {
    fetch('/dev/progress.json', { cache: 'no-cache' }).then((r) => (r.ok ? (r.json() as Promise<Progress>) : Promise.reject(new Error('progress.json missing'))), (e: unknown) => Promise.reject(e)).then(setP).catch(setErr);
  }, []);
  if (err) return <ErrorNotice error={err} />;
  if (!p) return <p>Loading development data…</p>;
  return (
    <>
      <header className="page"><h2>Development</h2><span className="badge">{p.summary.done} done · {p.summary.partial} partial · {p.summary.missing} missing</span></header>
      <div className="row" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={t === tab} className={`btn${t === tab ? ' primary' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Overview' ? <Overview p={p} /> : null}
      {tab === 'Live preview' ? <Preview /> : null}
      {tab === 'Screens' ? <Screens p={p} onNote={(a) => { setArea(a); setTab('Feedback'); }} /> : null}
      {tab === 'Feedback' ? <Feedback me={me} say={say} area={area} setArea={setArea} /> : null}
    </>
  );
}

const List = ({ title, items }: { title: string; items: Item[] }): ReactNode => (
  <section className="card"><h3>{title}</h3><ul>{items.map((i) => <li key={i.title}><strong>{i.title}</strong>{i.detail ? ` — ${i.detail}` : ''}</li>)}</ul></section>
);

function Overview({ p }: { p: Progress }): ReactNode {
  return (
    <>
      <p className="mono">Generated {p.generatedAt} from the repository (roadmap, decisions, git history).</p>
      <div className="grid">
        <List title="Working on now" items={p.now} />
        <List title="Next" items={p.next} />
        <List title="Waiting for you" items={p.blockedOnOwner} />
      </div>
      <h3>Infrastructure roadmap</h3>
      <table>
        <thead><tr><th>#</th><th>Area</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>{p.roadmap.map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.area}</td><td>{r.status}</td><td>{r.detail}</td></tr>)}</tbody>
      </table>
      <h3>Your ideas and how they were handled</h3>
      <table>
        <thead><tr><th>Date</th><th>Idea</th><th>State</th></tr></thead>
        <tbody>{p.ideas.map((i) => <tr key={i.text}><td>{i.date}</td><td>{i.text}</td><td>{i.status}</td></tr>)}</tbody>
      </table>
      <h3>Decisions</h3>
      <table>
        <thead><tr><th>ID</th><th>When / who</th><th>Decision</th></tr></thead>
        <tbody>{p.decisions.slice().reverse().map((d) => <tr key={d.id}><td>{d.id}</td><td>{d.when}</td><td>{d.what}</td></tr>)}</tbody>
      </table>
      <h3>Recent commits (every one is pushed to main)</h3>
      <table>
        <tbody>{p.commits.map((c) => <tr key={c.sha}><td><code>{c.sha}</code></td><td>{c.at.slice(0, 16).replace('T', ' ')}</td><td>{c.subject}</td></tr>)}</tbody>
      </table>
    </>
  );
}

const FRAMES: { label: string; w: number; h: number }[] = [
  { label: 'Desktop 16:9', w: 1280, h: 720 },
  { label: 'Phone 20:9', w: 1200, h: 540 }
];

function Preview(): ReactNode {
  const [f, setF] = useState(0);
  const [nonce, setNonce] = useState(0);
  const frame = FRAMES[f] as (typeof FRAMES)[number];
  const url = gameUrl();
  return (
    <>
      <p>The game as deployed on this environment (the last push to main). Phones are 20:9 landscape; the canvas letterboxes the same way a device does.</p>
      <div className="row">
        {FRAMES.map((x, i) => <button key={x.label} className={`btn${i === f ? ' primary' : ''}`} onClick={() => setF(i)}>{x.label}</button>)}
        <button className="btn" onClick={() => setNonce(nonce + 1)}>Reload</button>
        <a className="btn" href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
      </div>
      <div style={{ maxWidth: '100%', overflow: 'auto', marginTop: 12 }}>
        <iframe key={`${f}-${nonce}`} title="Game preview" src={url} width={frame.w} height={frame.h} style={{ border: '1px solid var(--edge, #444)', borderRadius: 8, background: '#0a0610', maxWidth: '100%' }} allow="autoplay; fullscreen" />
      </div>
    </>
  );
}

function Screens({ p, onNote }: { p: Progress; onNote: (area: string) => void }): ReactNode {
  return (
    <>
      <p>Curated screenshots from the automated browser tests (updated whenever a screen changes). Pick a screen and leave a note.</p>
      <div className="grid">
        {p.screens.map((s) => (
          <figure key={s.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/evidence/${s.file}`} target="_blank" rel="noreferrer"><img src={`/dev/evidence/${s.file}`} alt={s.caption} loading="lazy" style={{ width: '100%', borderRadius: 6 }} /></a>
            <figcaption className="mono">{s.caption}</figcaption>
            <button className="btn" onClick={() => onNote(AREAS.find((a) => s.caption.toLowerCase().includes(a.toLowerCase().split(' ')[0] ?? '')) ?? 'General')}>Leave a note</button>
          </figure>
        ))}
        {p.screens.length === 0 ? <p>No screenshots yet.</p> : null}
      </div>
    </>
  );
}

function Feedback({ me, say, area, setArea }: { me: Me; say: (m: string) => void; area: string; setArea: (a: string) => void }): ReactNode {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => { api<{ notes: Note[] }>('/dev/notes').then((r) => setNotes(r.notes)).catch(setErr); };
  useEffect(load, []);
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api('/dev/notes', { method: 'POST', body: JSON.stringify({ area, kind: String(f.get('kind')), body: String(f.get('body')) }) });
      form.reset(); say('Note saved. I read open notes at the start of every working session.'); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  const move = async (n: Note, status: string): Promise<void> => {
    const resolution = status === 'done' || status === 'wontfix' ? (window.prompt('Resolution (what was done / why not):', n.resolution) ?? '') : n.resolution;
    try { await api(`/dev/notes/${n.id}`, { method: 'PATCH', body: JSON.stringify({ status, resolution }) }); load(); } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  if (err) return <ErrorNotice error={err} />;
  return (
    <>
      <form className="row" onSubmit={submit} aria-label="New note">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select name="kind" aria-label="Kind"><option value="feedback">feedback</option><option value="change_request">change request</option><option value="approved">approved</option><option value="question">question</option><option value="idea">idea</option></select>
        <input name="body" placeholder="What should change, or what do you like?" required maxLength={4000} style={{ flex: 1, minWidth: 320 }} />
        <button className="btn primary" type="submit">Save note</button>
      </form>
      <table>
        <thead><tr><th>#</th><th>Area</th><th>Kind</th><th>Note</th><th>State</th><th>Resolution</th><th /></tr></thead>
        <tbody>{(notes ?? []).map((n) => (
          <tr key={n.id}>
            <td>{n.id}</td><td>{n.area}</td><td>{n.kind}</td><td>{n.body}<div className="mono">{n.created_by} · {n.created_at.slice(0, 16).replace('T', ' ')}</div></td>
            <td><span className={`badge ${n.status === 'done' ? 'ok' : 'warn'}`}>{n.status}</span></td><td>{n.resolution}</td>
            <td>{me.role !== 'viewer' ? <select aria-label={`State of note ${n.id}`} value={n.status} onChange={(e) => void move(n, e.target.value)}><option>open</option><option>in_progress</option><option>done</option><option>wontfix</option></select> : null}</td>
          </tr>
        ))}</tbody>
      </table>
      {notes && notes.length === 0 ? <p>No notes yet.</p> : null}
    </>
  );
}
