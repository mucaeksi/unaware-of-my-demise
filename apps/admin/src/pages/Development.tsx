import { usePolling } from '../usePolling';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Item { title: string; detail: string }
interface ApprovedEntrySummary {
  asset_id: string;
  class: string;
  revision: number;
  path: string;
  sha256: string;
  bytes: number;
  dims: string;
  note: string;
}
interface BaseReleaseSummary {
  id: string;
  generation: number;
  minClient: string;
  notes: string;
  fileCount: number;
  totalBytes: number;
  approvedArtCount: number;
  approvedEntries: ApprovedEntrySummary[];
}
interface Progress {
  generatedAt: string;
  summary: { total: number; done: number; partial: number; missing: number };
  baseRelease?: BaseReleaseSummary;
  roadmap: { n: number; area: string; status: string; detail: string }[];
  decisions: { id: string; when: string; what: string; note: string }[];
  commits: { sha: string; at: string; subject: string }[];
  screens: { file: string; caption: string }[];
  now: Item[];
  next: Item[];
  blockedOnOwner: Item[];
  ideas: { from: string; date: string; text: string; status: string }[];
  // docs/DEV_TRACKER.json (spread into progress.json by tools/build_progress.ts)
  reviewedAt?: string;
  sourceCommit?: string;
  currentAssignment?: { id: string; status: string; nextProposed: string; workflow: string };
  flow?: string;
  phases?: { n: number; title: string; status: string; done: string[]; remaining: string[] }[];
  capabilities?: { id: string; title: string; taskStatus: string; implementationStatus: string; implemented: string; evidenceIds: string[]; blockerIds: string[] }[];
  evidence?: { id: string; level: string; result: string; verifiedAt: string | null }[];
  blockers?: { id: string; level: string; title: string; detail: string }[];
  media?: { kind: string; drawn: string; inGame: string; missing: string }[];
  checks?: { date: string; commit: string; items: { name: string; result: string; detail: string }[] };
}

/** package code status -> badge class; acceptance stays separate (open blockers) */
const codeBadge = (s: string): string => (s === 'COMPLETE' ? 'ok' : s === 'PARTIAL' ? 'warn' : 'bad');
const checkBadge = (r: string): string => (r === 'pass' ? 'ok' : r === 'partial' ? 'warn' : r === 'fail' ? 'bad' : 'info');
interface Note { id: number; area: string; kind: string; body: string; status: string; resolution: string; created_by: string; created_at: string; updated_by: string | null }

const TABS = ['Overview', 'Live preview', 'Screens', 'Feedback'] as const;
type Tab = (typeof TABS)[number];
const AREAS = ['General', 'Splash & Studio', 'Title', 'Prologue (120s)', 'Story', 'Battle', 'Patch Wait & Restart', 'Company hub', 'Summon', 'Roster', 'Mail', 'Shop', 'Account', 'Chapters', 'Control Center', 'Economy', 'Art direction'];

/** Where the browser build of the game lives: the sibling Worker of this admin, or the local dev server. */
function gameUrl(scene = '', target: 'worker' | 'vite' = 'worker'): string {
  const h = window.location.hostname;
  const port = target === 'vite' ? '5173' : '8787';
  const base = h === '127.0.0.1' || h === 'localhost' ? `http://127.0.0.1:${port}/` : `${window.location.protocol}//${h.replace(/^uomd-admin/, 'uomd-game')}/`;
  return scene ? `${base}?preview_scene=${encodeURIComponent(scene)}` : base;
}

export function Development({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [tab, setTab] = useState<Tab>('Overview');
  const readProgress = useCallback(async (signal: AbortSignal): Promise<Progress> => {
    const r = await fetch('/dev/progress.json', { cache: 'no-cache', signal });
    if (!r.ok) throw new Error('progress.json missing');
    return r.json() as Promise<Progress>;
  }, []);
  const { data: p, error: err } = usePolling(readProgress);
  const [area, setArea] = useState('General');
  if (err) return <ErrorNotice error={err} />;
  if (!p) return <p>Loading development data…</p>;
  return (
    <>
      <header className="page"><h2>Development</h2><span className="badge">{packageSummary(p)}</span></header>
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

function packageSummary(p: Progress): string {
  const caps = p.capabilities ?? [];
  if (!caps.length) return `${p.summary.done} done · ${p.summary.partial} partial · ${p.summary.missing} missing`;
  const n = (s: string): number => caps.filter((c) => c.implementationStatus === s).length;
  const accepted = caps.filter((c) => c.implementationStatus === 'COMPLETE' && c.blockerIds.length === 0).length;
  return `R00–R18 · code ${n('COMPLETE')} complete, ${n('PARTIAL')} partial · ${accepted} with no open acceptance gate`;
}

const List = ({ title, items }: { title: string; items: Item[] }): ReactNode => (
  <section className="card"><h3>{title}</h3><ul>{items.map((i) => <li key={i.title}><strong>{i.title}</strong>{i.detail ? ` — ${i.detail}` : ''}</li>)}</ul></section>
);

function Overview({ p }: { p: Progress }): ReactNode {
  return (
    <>
      <p className="mono">Generated {p.generatedAt} from the repository (docs/DEV_TRACKER.json reviewed {p.reviewedAt ?? '—'} at {p.sourceCommit ?? '—'}, roadmap, decisions, git history, base release manifest).</p>
      {p.currentAssignment ? (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Current assignment {p.currentAssignment.id}</h3>
            <span className="badge ok">{p.currentAssignment.status}</span>
          </div>
          <p style={{ margin: '8px 0 0' }}>{p.currentAssignment.workflow}</p>
          <p style={{ margin: '6px 0 0', color: 'var(--dim)' }}><strong>Proposed next:</strong> {p.currentAssignment.nextProposed}</p>
        </section>
      ) : null}
      {p.baseRelease ? (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Base release (initial AAB content)</h3>
            <span className="badge ok">{p.baseRelease.id} · gen {p.baseRelease.generation}</span>
            <span className="badge ok">client ≥ {p.baseRelease.minClient}</span>
            <span className="badge ok">{p.baseRelease.fileCount} base files ({(p.baseRelease.totalBytes / (1024 * 1024)).toFixed(2)} MB)</span>
            <span className="badge ok">{p.baseRelease.approvedArtCount} approved art entries</span>
          </div>
          {p.flow ? <p style={{ margin: '8px 0 0', color: 'var(--dim)' }}><strong>Flow:</strong> {p.flow}</p> : null}
        </section>
      ) : null}
      {p.checks ? (
        <>
          <h3>Latest checks ({p.checks.date}, {p.checks.commit})</h3>
          <table>
            <tbody>{p.checks.items.map((c) => <tr key={c.name}><td>{c.name}</td><td><span className={`badge ${checkBadge(c.result)}`}>{c.result}</span></td><td>{c.detail}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <div className="grid">
        <List title="Working on now" items={p.now} />
        <List title="Next" items={p.next} />
        <List title="Waiting for you" items={p.blockedOnOwner} />
      </div>
      {p.phases?.length ? (
        <>
          <h3>Phases (README section 0)</h3>
          <div className="grid">
            {p.phases.map((ph) => (
              <section key={ph.n} className="card">
                <div className="row"><h3 style={{ margin: 0 }}>Phase {ph.n} — {ph.title}</h3><span className={`badge ${ph.status === 'active' ? 'ok' : 'warn'}`}>{ph.status}</span></div>
                <p style={{ margin: '8px 0 2px' }}><strong>Done</strong></p>
                <ul>{ph.done.map((x) => <li key={x}>{x}</li>)}</ul>
                <p style={{ margin: '8px 0 2px' }}><strong>Remaining</strong></p>
                <ul>{ph.remaining.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            ))}
          </div>
        </>
      ) : null}
      {p.capabilities?.length ? (
        <>
          <h3>Work packages R00–R18</h3>
          <p style={{ color: 'var(--dim)' }}>Code is the local source state. Acceptance stays open while a gate is listed (device, live accounts, art, owner decisions). The latest evidence shows who verified what and when.</p>
          <table>
            <thead><tr><th>ID</th><th>Package</th><th>Code</th><th>Open acceptance gates</th><th>Latest evidence</th></tr></thead>
            <tbody>{p.capabilities.map((c) => {
              const ev = (p.evidence ?? []).filter((e) => c.evidenceIds.includes(e.id) && e.verifiedAt).sort((x, y) => String(y.verifiedAt).localeCompare(String(x.verifiedAt)))[0];
              return (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.id}</td>
                  <td style={{ minWidth: 280 }}>{c.title}<div className="mono" style={{ whiteSpace: 'normal' }}>{c.implemented}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className={`badge ${codeBadge(c.implementationStatus)}`}>{c.implementationStatus}</span></td>
                  <td style={{ minWidth: 180 }}><div className="row" style={{ gap: 4, margin: 0 }}>{c.blockerIds.length ? c.blockerIds.map((b) => <span key={b} className="badge warn" style={{ whiteSpace: 'nowrap' }} title={(p.blockers ?? []).find((x) => x.id === b)?.title}>{b}</span>) : <span className="badge ok">none</span>}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{ev ? <><div>{ev.level}</div><div className="mono">{String(ev.verifiedAt).slice(0, 10)} · <span title={ev.id}>{ev.id.length > 22 ? `${ev.id.slice(0, 21)}…` : ev.id}</span></div></> : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </>
      ) : null}
      {p.media?.length ? (
        <>
          <h3>Art integration (Argon workbench to game)</h3>
          <table>
            <thead><tr><th>Kind</th><th>Drawn</th><th>In the game</th><th>Missing</th></tr></thead>
            <tbody>{p.media.map((m) => <tr key={m.kind}><td>{m.kind}</td><td>{m.drawn}</td><td>{m.inGame}</td><td>{m.missing}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      {p.blockers?.length ? (
        <>
          <h3>Acceptance gates</h3>
          <table>
            <thead><tr><th>ID</th><th>State</th><th>Gate</th></tr></thead>
            <tbody>{p.blockers.map((b) => <tr key={b.id}><td>{b.id}</td><td><span className={`badge ${b.level === 'OWNER_BLOCKED' ? 'bad' : 'warn'}`}>{b.level}</span></td><td><strong>{b.title}</strong><div className="mono">{b.detail}</div></td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <h3>Infrastructure matrix (docs/INFRA_ROADMAP.md)</h3>
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
      <h3>Recent commits (local Git on Drive; GitHub retired, D-24)</h3>
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

const SCENE_PRESETS: { id: string; label: string }[] = [
  { id: 'fresh_flow', label: '1. Full Flow (Splash → Prologue → Tutorials)' },
  { id: 'studio', label: '2. SovTaym Studios' },
  { id: 'title_fresh', label: '3. Title (Tap to Start → Prologue)' },
  { id: 'prologue', label: '4. 120s Prologue' },
  { id: 'story_t1', label: '5. LN T-1 Before' },
  { id: 'battle_t1', label: '6. Battle T-1 (Whispering Ash)' },
  { id: 'story_t1_after', label: '7. LN T-1 After' },
  { id: 'story_t2_before', label: '8. LN T-2 Before' },
  { id: 'battle_t2', label: '9. Battle T-2 (Stone Crossing)' },
  { id: 'story_t2_after', label: '10. LN T-2 After' },
  { id: 'story_t3_before', label: '11. LN T-3 Before' },
  { id: 'battle_t3', label: '12. Battle T-3 (Shelter Courtyard)' },
  { id: 'story_t3_after', label: '13. LN T-3 Finale' },
  { id: 'finish_wait', label: '14. Patch Wait (Quotes)' },
  { id: 'hub', label: '15. Company Hub' }
];

function Preview(): ReactNode {
  const [f, setF] = useState(0);
  const [scene, setScene] = useState('fresh_flow');
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
  const [target, setTarget] = useState<'worker' | 'vite'>(isLocal ? 'vite' : 'worker');
  const [nonce, setNonce] = useState(0);
  const frame = FRAMES[f] as (typeof FRAMES)[number];
  const url = gameUrl(scene, target);
  return (
    <>
      <p>The game as deployed on Cloudflare (or the dev server when local). Jump to any scene of the initial AAB flow below, or play the full entry sequence from the splash.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {FRAMES.map((x, i) => <button key={x.label} className={`btn${i === f ? ' primary' : ''}`} onClick={() => setF(i)}>{x.label}</button>)}
        {isLocal ? (
          <>
            <button className={`btn${target === 'vite' ? ' primary' : ''}`} onClick={() => setTarget('vite')}>Vite Dev (:5173)</button>
            <button className={`btn${target === 'worker' ? ' primary' : ''}`} onClick={() => setTarget('worker')}>Game Worker (:8787)</button>
          </>
        ) : (
          <span className="badge ok">Cloudflare Live Worker</span>
        )}
        <button className="btn" onClick={() => setNonce(nonce + 1)}>Reload</button>
        <a className="btn" href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {SCENE_PRESETS.map((s) => (
          <button key={s.id || 'full'} className={`btn${scene === s.id ? ' primary' : ''}`} onClick={() => { setScene(s.id); setNonce(nonce + 1); }}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: '100%', overflow: 'auto', marginTop: 12 }}>
        <iframe key={`${f}-${scene}-${target}-${nonce}`} title="Game preview" src={url} width={frame.w} height={frame.h} style={{ border: '1px solid var(--edge, #444)', borderRadius: 8, background: '#0a0610', maxWidth: '100%' }} allow="autoplay; fullscreen" />
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
