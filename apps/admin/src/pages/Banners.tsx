import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, downloadJson, newRequestId, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Banner {
  id: string; title_en: string; status: string; version: number; starts_at: string | null; ends_at: string | null; updated_by: string;
  config: { kind: string; artKey?: string; pityGroup?: string; hardPity: number; baseFiveStarRate: number; baseFourStarRate?: number; fourStarPity?: number; softPity: { startPull: number; increment: number } | null; featured: { chance: number; lossesToGuarantee: number } | null; pools: { fiveFeatured: string[]; fiveOther: string[]; four: string[]; three: string[] } };
  analysis: { consolidatedFiveStarRate: number; expectedPullsPerFiveStar: number; expectedPullsPerTarget: number | null; worstCasePullsForTarget: number | null };
}
interface SimOut {
  exact: { expectedPullsPerFiveStar: number; consolidatedFiveStarRate: number; expectedPullsPerTarget: number | null; worstCasePullsForTarget: number | null; targetWithin: { pulls: number; probability: number }[] | null };
  simulated: { accounts: number; pullsPerAccount: number; rarity: { three: number; four: number; five: number }; targetRate: number | null; pullsToTarget: { p50: number; p90: number; p99: number; max: number } | null };
}
const pct = (x: number): string => `${(x * 100).toFixed(2)} %`;

export function Banners({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<Banner[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [sim, setSim] = useState<{ id: string; out: SimOut } | null>(null);
  const [editor, setEditor] = useState<{ id: string; title_en: string; expectedVersion: number; configText: string } | null>(null);
  const canEdit = me.role !== 'viewer';
  const load = (): void => { api<{ banners: Banner[] }>('/banners').then((r) => setRows(r.banners)).catch(setErr); };
  useEffect(load, []);
  const fail = (x: unknown): void => say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));

  const simulate = async (b: Banner): Promise<void> => {
    try { setSim({ id: b.id, out: await api<SimOut>('/banners/simulate', { method: 'POST', body: JSON.stringify({ bannerId: b.id, accounts: 2000, pullsPerAccount: 200, seed: 1 }) }) }); } catch (x) { fail(x); }
  };
  const state = async (b: Banner, action: 'activate' | 'retire'): Promise<void> => {
    let body: Record<string, unknown> = { action, expectedVersion: b.version, requestId: newRequestId('ban') };
    if (action === 'activate') {
      const ends = window.prompt('Banner ends at (ISO date-time, canon: 15 days after the start). Leave empty for no end:', new Date(Date.now() + 15 * 86_400_000).toISOString());
      if (ends === null) return;
      body = { action, expectedVersion: b.version, requestId: newRequestId('ban'), startsAt: new Date().toISOString(), ...(ends ? { endsAt: ends } : {}) };
    } else if (!window.confirm(`Retire ${b.id}? Players can no longer pull on it.`)) return;
    try { await api(`/banners/${b.id}/state`, { method: 'POST', body: JSON.stringify(body) }); say(`${b.id}: ${action}d`); load(); } catch (x) { fail(x); load(); }
  };

  const openCloneOrEdit = (b?: Banner, asNew = false): void => {
    const baseCfg = b?.config ?? {
      id: 'char_featured_new',
      kind: 'character',
      pityGroup: 'character_featured',
      hardPity: 80,
      baseFiveStarRate: 0.008,
      baseFourStarRate: 0.06,
      fourStarPity: 10,
      softPity: { startPull: 65, increment: 0.05 },
      featured: { chance: 0.5, lossesToGuarantee: 1 },
      pools: {
        fiveFeatured: ['nyx_sable'],
        fiveOther: ['seraphine_voss', 'isolde_vane', 'vesper_kane'],
        four: ['iris_kael', 'lysander_cole', 'mira_vance', 'orion_thorne'],
        three: ['ash_vanguard', 'cinder_acolyte', 'dusk_warden', 'gloam_archer']
      }
    };
    const nextId = b && !asNew ? b.id : b ? `${b.id}_v${b.version + 1}` : 'char_featured_new';
    const cfgCopy = { ...baseCfg, id: nextId };
    setEditor({
      id: nextId,
      title_en: b ? (asNew ? `${b.title_en} (Copy)` : b.title_en) : 'New Featured Banner',
      expectedVersion: b && !asNew ? b.version : 0,
      configText: JSON.stringify(cfgCopy, null, 2)
    });
  };

  const saveBanner = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!editor) return;
    try {
      const parsed = JSON.parse(editor.configText) as Record<string, unknown>;
      parsed.id = editor.id.trim();
      await api(`/banners/${encodeURIComponent(editor.id.trim())}`, {
        method: 'PUT',
        body: JSON.stringify({
          title_en: editor.title_en.trim(),
          config: parsed,
          expectedVersion: editor.expectedVersion
        })
      });
      say(editor.expectedVersion === 0 ? `Draft banner ${editor.id} created` : `Draft banner ${editor.id} updated`);
      setEditor(null);
      load();
    } catch (x) {
      fail(x);
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!rows) return <p>Loading banners…</p>;
  return (
    <>
      <header className="page">
        <h2>Banners</h2>
        <span className="badge">{rows.length}</span>
        {canEdit ? (
          <button className="btn primary" type="button" onClick={() => openCloneOrEdit(rows[0], true)}>
            + New draft banner
          </button>
        ) : null}
        <button className="btn" type="button" onClick={() => downloadJson('banners.json', rows)}>Export JSON</button>
      </header>
      <p>Rates and pity are data. A live banner cannot be edited in-place (clone it as a draft to create a new rotation); the simulator runs the real engine.</p>

      {editor ? (
        <form className="card" onSubmit={(e) => void saveBanner(e)} aria-label="Banner editor" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{editor.expectedVersion === 0 ? 'Create draft banner' : `Edit draft banner: ${editor.id}`}</h3>
            <span className="badge warn">{editor.expectedVersion === 0 ? 'new draft' : `v${editor.expectedVersion}`}</span>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <label>Banner ID <input value={editor.id} disabled={editor.expectedVersion > 0} onChange={(e) => setEditor({ ...editor, id: e.target.value })} required /></label>
            <label style={{ flex: 1 }}>Title (EN) <input style={{ width: '100%' }} value={editor.title_en} onChange={(e) => setEditor({ ...editor, title_en: e.target.value })} required /></label>
          </div>
          <label style={{ display: 'block', marginTop: 10 }}>
            Banner Config JSON (pools, pity, rates)
            <textarea
              className="code-editor"
              style={{ minHeight: 240, marginTop: 6 }}
              value={editor.configText}
              onChange={(e) => setEditor({ ...editor, configText: e.target.value })}
            />
          </label>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" type="submit">{editor.expectedVersion === 0 ? 'Create draft' : 'Save draft'}</button>
            <button className="btn" type="button" onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      <table>
        <thead><tr><th>ID</th><th>Title</th><th>Art Key</th><th>Status</th><th>5★ base</th><th>Pity</th><th>≈ pulls / 5★</th><th>≈ pulls / target</th><th>Window</th><th /></tr></thead>
        <tbody>{rows.map((b) => (
          <tr key={b.id}>
            <td><code>{b.id}</code></td><td>{b.title_en}</td>
            <td><code>{b.config.artKey ?? `banner_${b.id}`}</code></td>
            <td><span className={`badge ${b.status === 'active' ? 'ok' : 'warn'}`}>{b.status}</span></td>
            <td>{pct(b.config.baseFiveStarRate)}</td>
            <td>{b.config.softPity ? `soft ${b.config.softPity.startPull}, ` : ''}hard {b.config.hardPity}</td>
            <td>{b.analysis.expectedPullsPerFiveStar.toFixed(1)}</td>
            <td>{b.analysis.expectedPullsPerTarget ? b.analysis.expectedPullsPerTarget.toFixed(1) : '—'}</td>
            <td>{b.starts_at ? `${b.starts_at.slice(0, 10)} → ${b.ends_at ? b.ends_at.slice(0, 10) : '∞'}` : '—'}</td>
            <td className="row">
              <button className="btn" onClick={() => void simulate(b)}>Simulate</button>
              {canEdit && b.status === 'draft' ? <button className="btn" onClick={() => openCloneOrEdit(b, false)}>Edit</button> : null}
              {canEdit ? <button className="btn" onClick={() => openCloneOrEdit(b, true)}>Clone</button> : null}
              {canEdit && b.status !== 'retired' ? <button className="btn primary" onClick={() => void state(b, 'activate')}>{b.status === 'active' ? 'Reschedule' : 'Activate'}</button> : null}
              {canEdit && b.status !== 'retired' ? <button className="btn danger" onClick={() => void state(b, 'retire')}>Retire</button> : null}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {sim ? (
        <section className="card" aria-label="Simulation result">
          <h3>Simulation — {sim.id}</h3>
          <p>Exact: {pct(sim.out.exact.consolidatedFiveStarRate)} overall 5★ rate · {sim.out.exact.expectedPullsPerFiveStar.toFixed(2)} pulls per 5★{sim.out.exact.expectedPullsPerTarget ? ` · ${sim.out.exact.expectedPullsPerTarget.toFixed(2)} per target (worst ${sim.out.exact.worstCasePullsForTarget})` : ''}</p>
          <p>Seeded run of the real engine ({sim.out.simulated.accounts} accounts × {sim.out.simulated.pullsPerAccount} pulls): 3★ {pct(sim.out.simulated.rarity.three)} · 4★ {pct(sim.out.simulated.rarity.four)} · 5★ {pct(sim.out.simulated.rarity.five)}</p>
          {sim.out.simulated.pullsToTarget ? <p>Pulls to the target — median {sim.out.simulated.pullsToTarget.p50}, p90 {sim.out.simulated.pullsToTarget.p90}, p99 {sim.out.simulated.pullsToTarget.p99}, max {sim.out.simulated.pullsToTarget.max}</p> : null}
          {sim.out.exact.targetWithin ? <p>Chance of the target within: {sim.out.exact.targetWithin.filter((t) => t.pulls % 40 === 0 || t.pulls === sim.out.exact.worstCasePullsForTarget).map((t) => `${t.pulls} → ${pct(t.probability)}`).join(' · ')}</p> : null}
        </section>
      ) : null}
    </>
  );
}

