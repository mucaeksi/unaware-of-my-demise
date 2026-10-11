import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Product { product_id: string; kind: string; title_en: string; grants: string; sub_config: string | null; active: number; updated_at: string; updated_by: string }
interface Purchase { order_id: string; player_id: string; product_id: string; kind: string; state: string; period_end: string | null; unrecovered: string; granted_at: string }
interface AdDay { day: string; views: number; players: number; tokens: number }

export function Shop({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [purchases, setPurchases] = useState<{ purchases: Purchase[]; refundsWithUnrecovered: number } | null>(null);
  const [ads, setAds] = useState<AdDay[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => {
    api<{ products: Product[] }>('/products').then((r) => setProducts(r.products)).catch(setErr);
    api<{ purchases: Purchase[]; refundsWithUnrecovered: number }>('/purchases').then(setPurchases).catch(setErr);
    api<{ days: AdDay[] }>('/ads/summary').then((r) => setAds(r.days)).catch(setErr);
  };
  useEffect(load, []);
  const toggle = async (p: Product): Promise<void> => {
    if (!window.confirm(`${p.active ? 'Deactivate' : 'Activate'} ${p.product_id}? It must match a real Play Console product before it is sold.`)) return;
    try {
      await api(`/products/${p.product_id}`, { method: 'PUT', body: JSON.stringify({ kind: p.kind, title_en: p.title_en, grants: JSON.parse(p.grants), ...(p.sub_config ? { sub_config: JSON.parse(p.sub_config) } : {}), active: !p.active }) });
      say(`${p.product_id} ${p.active ? 'deactivated' : 'activated'}`); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  if (err) return <ErrorNotice error={err} />;
  if (!products) return <p>Loading shop…</p>;
  return (
    <>
      <header className="page"><h2>Shop & ads</h2>{purchases && purchases.refundsWithUnrecovered > 0 ? <span className="badge warn">{purchases.refundsWithUnrecovered} refunds with unrecovered currency</span> : null}</header>
      <p>Prices live in Google Play Console; here a product id is mapped to what the server grants. Only owners can activate products.</p>
      <table>
        <thead><tr><th>Product</th><th>Kind</th><th>Title</th><th>Grants</th><th>Active</th><th /></tr></thead>
        <tbody>{products.map((p) => (
          <tr key={p.product_id}><td><code>{p.product_id}</code></td><td>{p.kind}</td><td>{p.title_en}</td><td className="mono">{p.sub_config ? 'see subscription config' : p.grants}</td>
            <td><span className={`badge ${p.active ? 'ok' : 'warn'}`}>{p.active ? 'on' : 'off'}</span></td>
            <td>{me.role === 'owner' ? <button className="btn" onClick={() => void toggle(p)}>{p.active ? 'Deactivate' : 'Activate'}</button> : null}</td></tr>
        ))}</tbody>
      </table>
      <h3>Recent purchases</h3>
      <table>
        <thead><tr><th>Order</th><th>Player</th><th>Product</th><th>State</th><th>Period end</th><th>Unrecovered</th></tr></thead>
        <tbody>{(purchases?.purchases ?? []).map((p) => <tr key={p.order_id}><td><code>{p.order_id}</code></td><td className="mono">{p.player_id}</td><td>{p.product_id}</td><td>{p.state}</td><td>{p.period_end ?? '—'}</td><td>{p.unrecovered === '{}' ? '' : p.unrecovered}</td></tr>)}</tbody>
      </table>
      <h3>Rewarded ads (last 14 days)</h3>
      <table>
        <thead><tr><th>Day</th><th>Views</th><th>Players</th><th>Tokens paid</th></tr></thead>
        <tbody>{ads.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.views}</td><td>{d.players}</td><td>{d.tokens}</td></tr>)}</tbody>
      </table>
    </>
  );
}
