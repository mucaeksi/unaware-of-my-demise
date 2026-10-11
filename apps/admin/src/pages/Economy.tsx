import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api';
import { ErrorNotice } from '../App';

interface Model { days: number; startBalance: number; income: { tasks: number; weekly: number; ads: number; subscription: number }; pullCost: number; upgradeStepFee: number; upgradeStepsWantedPerDay: number; upgradeStepsAvailable: number; shopSpendPerDay: number }
interface Report { incomePerDay: number; recoveryDays: number; floorHolds: boolean; maxSafeStepFee: number; stepFeeInPulls: number; results: { archetype: string; pulls: number; upgradeSteps: number; blockedDays: number; longestBlockedRun: number; endBalance: number; totalIncome: number }[] }

const NAMES: Record<string, string> = { all_in_wishes: 'Everything on wishes first', balanced: 'Upgrades first, wishes with the rest', never_wishes: 'Never wishes' };

export function Economy({ say }: { say: (m: string) => void }): ReactNode {
  const [m, setM] = useState<Model | null>(null);
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { api<{ model: Model }>('/economy/defaults').then((d) => setM(d.model)).catch(setErr); }, []);
  const run = (model: Model): void => { api<Report>('/economy/flow', { method: 'POST', body: JSON.stringify(model) }).then(setR).catch((x) => say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message))); };
  useEffect(() => { if (m) run(m); }, [m]);
  if (err) return <ErrorNotice error={err} />;
  if (!m) return <p>Loading…</p>;
  const num = (label: string, get: () => number, set: (v: number) => void): ReactNode => (
    <label>{label}<input type="number" min="0" step="any" value={get()} onChange={(e) => set(Number(e.target.value))} /></label>
  );
  return (
    <>
      <header className="page"><h2>Economy (one currency)</h2></header>
      <p>Everything is paid in Eclipse Tokens. Change a price or an income and see what happens to a player who puts everything into wishes, a balanced player and one who never wishes. Income defaults are the canon values; the upgrade and shop numbers are placeholders to tune.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {num('Days', () => m.days, (v) => setM({ ...m, days: v }))}
        {num('Pull cost', () => m.pullCost, (v) => setM({ ...m, pullCost: v }))}
        {num('Tasks / day', () => m.income.tasks, (v) => setM({ ...m, income: { ...m.income, tasks: v } }))}
        {num('Weekly cycle / day', () => Math.round(m.income.weekly), (v) => setM({ ...m, income: { ...m.income, weekly: v } }))}
        {num('Ads / day', () => m.income.ads, (v) => setM({ ...m, income: { ...m.income, ads: v } }))}
        {num('Subscription / day', () => Math.round(m.income.subscription), (v) => setM({ ...m, income: { ...m.income, subscription: v } }))}
        {num('Upgrade step fee', () => m.upgradeStepFee, (v) => setM({ ...m, upgradeStepFee: v }))}
        {num('Steps wanted / day', () => m.upgradeStepsWantedPerDay, (v) => setM({ ...m, upgradeStepsWantedPerDay: v }))}
        {num('Steps before the gate', () => m.upgradeStepsAvailable, (v) => setM({ ...m, upgradeStepsAvailable: v }))}
        {num('Shop spend / day', () => m.shopSpendPerDay, (v) => setM({ ...m, shopSpendPerDay: v }))}
        <button className="btn" onClick={() => setM({ ...m, income: { ...m.income, subscription: 12820 / 30 } })}>Add the Eclipse Blessing (12,820 / 30 d)</button>
      </div>
      {r ? (
        <>
          <div className="grid">
            <div className="card"><h3>Income per day</h3><div className="big">{r.incomePerDay}</div><div className="mono">{(r.incomePerDay / m.pullCost).toFixed(1)} pulls a day if spent on wishes only</div></div>
            <div className="card"><h3>One upgrade step</h3><div className="big">{r.stepFeeInPulls.toFixed(2)} pulls</div><div className="mono">largest safe fee: {r.maxSafeStepFee}</div></div>
            <div className="card"><h3>Recovery from zero</h3><div className="big">{Number.isFinite(r.recoveryDays) ? `${r.recoveryDays} day${r.recoveryDays === 1 ? '' : 's'}` : 'never'}</div><span className={`badge ${r.floorHolds ? 'ok' : 'bad'}`}>{r.floorHolds ? 'floor rule holds' : 'floor rule BROKEN'}</span></div>
          </div>
          <table>
            <thead><tr><th>Player</th><th>Pulls</th><th>Upgrade steps</th><th>Days blocked</th><th>Longest block</th><th>Ends with</th></tr></thead>
            <tbody>{r.results.map((x) => <tr key={x.archetype}><td>{NAMES[x.archetype] ?? x.archetype}</td><td>{x.pulls}</td><td>{x.upgradeSteps}</td><td>{x.blockedDays}</td><td>{x.longestBlockedRun}</td><td>{x.endBalance}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
    </>
  );
}
