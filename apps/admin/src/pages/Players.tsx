import { useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface PlayerRow { id: string; display_name: string | null; status: string; created_at: string; last_seen_at: string | null }
interface Detail {
  player: PlayerRow;
  wallets: { currency: string; balance: number }[];
  items: { item_id: string; copies: number; shards: number }[];
  ledger: { id: number; at: string; currency: string; delta: number; reason: string }[];
  pulls: { id: number; at: string; banner_id: string; pull_number: number; rarity: number; item_id: string; outcome: string }[];
  pity: { pity_group: string; pity5: number; pity4: number; lost: number }[];
  purchases: { order_id: string; product_id: string; state: string; unrecovered: string }[];
  progress: { node_id: string; stars: number; clears: number }[];
  mail: { id: number; kind: string; title: string; claimed_at: string | null }[];
  activeSessions: number;
}

const rid = (): string => `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function Players({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [rows, setRows] = useState<PlayerRow[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const canMail = me.role !== 'viewer';
  const isOwner = me.role === 'owner';

  const search = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '');
    api<{ players: PlayerRow[] }>(`/players?q=${encodeURIComponent(q)}`).then((r) => { setRows(r.players); setErr(null); }).catch(setErr);
  };
  const open = (id: string): void => { api<Detail>(`/players/${id}`).then(setDetail).catch(setErr); };
  const fail = (x: unknown): void => say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));

  const sendMail = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!detail) return;
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get('amount'));
    try {
      await api(`/players/${detail.player.id}/mail`, {
        method: 'POST',
        body: JSON.stringify({ reason: String(f.get('reason')), mail: { kind: 'compensation', title: String(f.get('title')), body: String(f.get('body') ?? ''), attachments: amount > 0 ? [{ type: 'currency', currency: String(f.get('currency')), amount }] : [] } })
      });
      say('Mail sent'); open(detail.player.id);
    } catch (x) { fail(x); }
  };
  const adjust = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!detail) return;
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ applied: boolean; balance: number }>(`/players/${detail.player.id}/adjust`, { method: 'POST', body: JSON.stringify({ currency: String(f.get('currency')), delta: Number(f.get('delta')), reason: String(f.get('reason')), requestId: rid() }) });
      say(`Balance now ${r.balance}`); open(detail.player.id);
    } catch (x) { fail(x); }
  };
  const setStatus = async (status: 'active' | 'banned'): Promise<void> => {
    if (!detail) return;
    const reason = window.prompt(`Reason to set ${status}:`);
    if (!reason) return;
    try { await api(`/players/${detail.player.id}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) }); say(`Player ${status}`); open(detail.player.id); } catch (x) { fail(x); }
  };

  return (
    <>
      <header className="page"><h2>Players</h2></header>
      <form className="row" onSubmit={search}><input name="q" placeholder="player id or display name" maxLength={60} /><button className="btn primary" type="submit">Search</button></form>
      <ErrorNotice error={err} />
      {rows ? (
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Created</th><th>Last seen</th><th /></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}><td><code>{p.id}</code></td><td>{p.display_name ?? '—'}</td><td><span className={`badge ${p.status === 'active' ? 'ok' : 'warn'}`}>{p.status}</span></td><td>{p.created_at}</td><td>{p.last_seen_at ?? '—'}</td><td><button className="btn" onClick={() => open(p.id)}>Open</button></td></tr>
          ))}</tbody>
        </table>
      ) : <p>Search to list players.</p>}
      {detail ? (
        <section className="card" aria-label="Player detail">
          <h3>{detail.player.display_name ?? detail.player.id} <span className={`badge ${detail.player.status === 'active' ? 'ok' : 'warn'}`}>{detail.player.status}</span> <span className="badge">{detail.activeSessions} active sessions</span></h3>
          <p className="mono">{detail.player.id}</p>
          <h3>Wallets</h3>
          <p>{detail.wallets.length ? detail.wallets.map((w) => `${w.currency}: ${w.balance}`).join(' · ') : 'empty'}</p>
          <h3>Pity</h3>
          <p>{detail.pity.length ? detail.pity.map((p) => `${p.pity_group}: ${p.pity5}/${p.pity4}, lost ${p.lost}`).join(' · ') : 'none'}</p>
          <h3>Inventory ({detail.items.length})</h3>
          <p>{detail.items.map((i) => `${i.item_id}×${i.copies}${i.shards ? ` (+${i.shards} shards)` : ''}`).join(', ') || 'none'}</p>
          <h3>Progress</h3>
          <p>{detail.progress.map((n) => `${n.node_id} ${'★'.repeat(n.stars)}`).join(' · ') || 'none'}</p>
          <h3>Recent ledger</h3>
          <table><thead><tr><th>At</th><th>Currency</th><th>Δ</th><th>Reason</th></tr></thead><tbody>{detail.ledger.map((l) => <tr key={l.id}><td>{l.at}</td><td>{l.currency}</td><td>{l.delta}</td><td>{l.reason}</td></tr>)}</tbody></table>
          <h3>Recent pulls</h3>
          <table><thead><tr><th>At</th><th>Banner</th><th>#</th><th>★</th><th>Item</th><th>Outcome</th></tr></thead><tbody>{detail.pulls.map((l) => <tr key={l.id}><td>{l.at}</td><td>{l.banner_id}</td><td>{l.pull_number}</td><td>{l.rarity}</td><td>{l.item_id}</td><td>{l.outcome}</td></tr>)}</tbody></table>
          <h3>Purchases</h3>
          <p>{detail.purchases.map((p) => `${p.product_id} ${p.state}${p.unrecovered !== '{}' ? ` (unrecovered ${p.unrecovered})` : ''}`).join(' · ') || 'none'}</p>
          {canMail ? (
            <form className="row" onSubmit={sendMail} aria-label="Send compensation mail">
              <input name="title" placeholder="mail title" required maxLength={120} />
              <input name="body" placeholder="message" maxLength={2000} />
              <select name="currency"><option>eclipse_token</option><option>silver_crowns</option><option>fates_thread</option></select>
              <input name="amount" type="number" min="0" max="1000000" defaultValue="0" aria-label="amount" />
              <input name="reason" placeholder="audit reason" required minLength={3} maxLength={200} />
              <button className="btn primary" type="submit">Send mail</button>
            </form>
          ) : null}
          {isOwner ? (
            <>
              <form className="row" onSubmit={adjust} aria-label="Adjust balance">
                <select name="currency"><option>eclipse_token</option><option>silver_crowns</option><option>fates_thread</option></select>
                <input name="delta" type="number" required aria-label="delta" />
                <input name="reason" placeholder="audit reason" required minLength={3} maxLength={200} />
                <button className="btn danger" type="submit">Adjust balance</button>
              </form>
              <div className="row">
                {detail.player.status === 'active' ? <button className="btn danger" onClick={() => void setStatus('banned')}>Ban</button> : <button className="btn" onClick={() => void setStatus('active')}>Unban</button>}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
