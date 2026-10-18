import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, downloadJson, newRequestId, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Product { product_id: string; kind: string; title_en: string; grants: string; sub_config: string | null; active: number; version: number; updated_at: string; updated_by: string }
interface Purchase { order_id: string; player_id: string; product_id: string; kind: string; state: string; period_end: string | null; unrecovered: string; granted_at: string; refunded_at?: string | null }
interface PurchaseDetail extends Purchase { acknowledged: number; period_start: string | null; fulfillment: string; entitlement_state: string; entitlement_checked_at: string | null }
interface Reconciliation { purchase: Record<string, unknown>; job: Record<string, unknown> | null; notifications: Record<string, unknown>[] }
interface BillingNotification { message_id: string; at: string; state: string; attempts: number; last_code: string | null; outcome: string | null }
interface BillingJob { token_hash: string; player_id: string; product_id: string; kind: string; order_id: string; state: string; attempts: number; last_code: string | null; next_at: string }
interface AdDay { day: string; views: number; players: number; tokens: number }

export function Shop({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refundsWithUnrecovered, setRefundsWithUnrecovered] = useState(0);
  const [playerFilter, setPlayerFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseDetail | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [notifications, setNotifications] = useState<BillingNotification[]>([]);
  const [jobs, setJobs] = useState<BillingJob[]>([]);
  const [ads, setAds] = useState<AdDay[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [prodEditor, setProdEditor] = useState<{
    product_id: string;
    kind: 'consumable' | 'subscription';
    title_en: string;
    grantsText: string;
    subConfigText: string;
    active: boolean;
    expectedVersion: number;
  } | null>(null);
  const canOperate = me.role !== 'viewer';

  const buildPurchasesQuery = useCallback((cursor?: string | null): string => {
    const params = new URLSearchParams();
    if (playerFilter.trim()) params.set('player', playerFilter.trim());
    if (productFilter.trim()) params.set('product', productFilter.trim());
    if (stateFilter) params.set('state', stateFilter);
    if (kindFilter) params.set('kind', kindFilter);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return `/purchases${qs ? `?${qs}` : ''}`;
  }, [playerFilter, productFilter, stateFilter, kindFilter]);

  const load = useCallback((): void => {
    api<{ products: Product[] }>('/products').then((r) => setProducts(r.products)).catch(setErr);
    api<{ purchases: Purchase[]; nextCursor?: string | null; refundsWithUnrecovered: number }>(buildPurchasesQuery())
      .then((r) => {
        setPurchases(r.purchases);
        setNextCursor(r.nextCursor ?? null);
        setRefundsWithUnrecovered(r.refundsWithUnrecovered);
      })
      .catch(setErr);
    api<{ days: AdDay[] }>('/ads/summary').then((r) => setAds(r.days)).catch(setErr);
    api<{ notifications: BillingNotification[] }>('/billing/notifications').then((r) => setNotifications(r.notifications)).catch(() => {});
    api<{ jobs: BillingJob[] }>('/billing/jobs').then((r) => setJobs(r.jobs)).catch(() => {});
  }, [buildPurchasesQuery]);

  useEffect(load, [load]);

  const loadMorePurchases = (): void => {
    if (!nextCursor) return;
    api<{ purchases: Purchase[]; nextCursor?: string | null; refundsWithUnrecovered: number }>(buildPurchasesQuery(nextCursor))
      .then((r) => {
        setPurchases([...purchases, ...r.purchases]);
        setNextCursor(r.nextCursor ?? null);
      })
      .catch(setErr);
  };

  const inspectOrder = (orderId: string): void => {
    Promise.all([
      api<{ purchase: PurchaseDetail }>(`/purchases/${encodeURIComponent(orderId)}`),
      api<Reconciliation>(`/billing/purchases/${encodeURIComponent(orderId)}/reconciliation`)
    ])
      .then(([p, rec]) => {
        setPurchaseDetail(p.purchase);
        setReconciliation(rec);
      })
      .catch((x) => say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)));
  };

  const retryNotification = async (n: BillingNotification): Promise<void> => {
    const reason = window.prompt(`Reason to retry RTDN message ${n.message_id}:`);
    if (!reason) return;
    try {
      await api(`/billing/notifications/${encodeURIComponent(n.message_id)}/retry`, {
        method: 'POST',
        body: JSON.stringify({ expectedAttempts: n.attempts, reason })
      });
      say(`RTDN ${n.message_id} reset to pending`);
      load();
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  const retryJob = async (j: BillingJob): Promise<void> => {
    const reason = window.prompt(`Reason to retry billing job for order ${j.order_id}:`);
    if (!reason) return;
    try {
      await api(`/billing/jobs/${encodeURIComponent(j.token_hash)}/retry`, {
        method: 'POST',
        body: JSON.stringify({ expectedAttempts: j.attempts, reason })
      });
      say(`Billing job for ${j.order_id} queued for retry`);
      load();
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  const toggle = async (p: Product): Promise<void> => {
    if (!window.confirm(`${p.active ? 'Deactivate' : 'Activate'} ${p.product_id} (v${p.version})? It must match a real Play Console product before it is sold.`)) return;
    try {
      await api(`/products/${p.product_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          kind: p.kind,
          title_en: p.title_en,
          grants: JSON.parse(p.grants),
          ...(p.sub_config ? { sub_config: JSON.parse(p.sub_config) } : {}),
          active: !p.active,
          expectedVersion: p.version,
          requestId: newRequestId('prod')
        })
      });
      say(`${p.product_id} ${p.active ? 'deactivated' : 'activated'}`); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); load(); }
  };

  const openProdEditor = (p?: Product): void => {
    setProdEditor({
      product_id: p?.product_id ?? 'tokens_pack_new',
      kind: (p?.kind === 'subscription' ? 'subscription' : 'consumable'),
      title_en: p?.title_en ?? 'New Eclipse Token Pack',
      grantsText: p ? JSON.stringify(JSON.parse(p.grants), null, 2) : JSON.stringify([{ type: 'currency', currency: 'eclipse_token', amount: 1600 }], null, 2),
      subConfigText: p?.sub_config ? JSON.stringify(JSON.parse(p.sub_config), null, 2) : '',
      active: p ? p.active === 1 : false,
      expectedVersion: p ? p.version : 0
    });
  };

  const saveProdEditor = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!prodEditor) return;
    try {
      const grants = prodEditor.grantsText.trim() ? JSON.parse(prodEditor.grantsText) : [];
      const sub_config = prodEditor.kind === 'subscription' && prodEditor.subConfigText.trim() ? JSON.parse(prodEditor.subConfigText) : undefined;
      await api(`/products/${encodeURIComponent(prodEditor.product_id.trim())}`, {
        method: 'PUT',
        body: JSON.stringify({
          kind: prodEditor.kind,
          title_en: prodEditor.title_en.trim(),
          grants,
          ...(sub_config ? { sub_config } : {}),
          active: prodEditor.active,
          expectedVersion: prodEditor.expectedVersion,
          requestId: newRequestId('prod')
        })
      });
      say(`${prodEditor.product_id} saved`);
      setProdEditor(null);
      load();
    } catch (x) {
      say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message));
    }
  };

  if (err) return <ErrorNotice error={err} />;
  if (!products) return <p>Loading shop…</p>;
  return (
    <>
      <header className="page">
        <h2>Shop &amp; ads</h2>
        {refundsWithUnrecovered > 0 ? <span className="badge warn">{refundsWithUnrecovered} refunds with unrecovered currency</span> : null}
        {me.role === 'owner' ? (
          <button className="btn primary" type="button" onClick={() => openProdEditor()}>
            + New product
          </button>
        ) : null}
        <button className="btn" type="button" onClick={() => downloadJson('purchases.json', purchases)}>Export purchases JSON</button>
      </header>
      <p>Prices live in Google Play Console; here a product id is mapped to what the server grants. Product writes use optimistic concurrency (version CAS); only owners can change products.</p>

      {prodEditor ? (
        <form className="card" onSubmit={(e) => void saveProdEditor(e)} aria-label="Product editor" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{prodEditor.expectedVersion === 0 ? 'Create shop product' : `Edit product: ${prodEditor.product_id}`}</h3>
            <span className="badge">{prodEditor.expectedVersion === 0 ? 'new' : `v${prodEditor.expectedVersion}`}</span>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <label>Product ID <input value={prodEditor.product_id} disabled={prodEditor.expectedVersion > 0} onChange={(e) => setProdEditor({ ...prodEditor, product_id: e.target.value })} required /></label>
            <label>Kind
              <select value={prodEditor.kind} disabled={prodEditor.expectedVersion > 0} onChange={(e) => setProdEditor({ ...prodEditor, kind: e.target.value as 'consumable' | 'subscription' })}>
                <option value="consumable">consumable</option>
                <option value="subscription">subscription</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>Title (EN) <input style={{ width: '100%' }} value={prodEditor.title_en} onChange={(e) => setProdEditor({ ...prodEditor, title_en: e.target.value })} required /></label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={prodEditor.active} onChange={(e) => setProdEditor({ ...prodEditor, active: e.target.checked })} /> Active
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 10 }}>
            Grants JSON (RewardAttachment array)
            <textarea className="code-editor" style={{ minHeight: 110, marginTop: 4 }} value={prodEditor.grantsText} onChange={(e) => setProdEditor({ ...prodEditor, grantsText: e.target.value })} />
          </label>
          {prodEditor.kind === 'subscription' ? (
            <label style={{ display: 'block', marginTop: 10 }}>
              Subscription Config JSON
              <textarea className="code-editor" style={{ minHeight: 130, marginTop: 4 }} value={prodEditor.subConfigText} onChange={(e) => setProdEditor({ ...prodEditor, subConfigText: e.target.value })} />
            </label>
          ) : null}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" type="submit">Save product</button>
            <button className="btn" type="button" onClick={() => setProdEditor(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      <table>
        <thead><tr><th>Product</th><th>Kind</th><th>Title</th><th>Grants</th><th>v</th><th>Active</th><th /></tr></thead>
        <tbody>{products.map((p) => (
          <tr key={p.product_id}><td><code>{p.product_id}</code></td><td>{p.kind}</td><td>{p.title_en}</td><td className="mono">{p.sub_config ? 'see subscription config' : p.grants}</td>
            <td>{p.version}</td>
            <td><span className={`badge ${p.active ? 'ok' : 'warn'}`}>{p.active ? 'on' : 'off'}</span></td>
            <td className="row">
              {me.role === 'owner' ? <button className="btn" onClick={() => openProdEditor(p)}>Edit</button> : null}
              {me.role === 'owner' ? <button className="btn" onClick={() => void toggle(p)}>{p.active ? 'Deactivate' : 'Activate'}</button> : null}
            </td></tr>
        ))}</tbody>
      </table>
      <h3>Recent purchases</h3>
      <div className="row" role="search" aria-label="Filter purchases">
        <input aria-label="Filter purchase player" placeholder="player id (p_...)" value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} maxLength={40} />
        <input aria-label="Filter purchase product" placeholder="product id" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} maxLength={100} />
        <select aria-label="Filter purchase state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">All states</option>
          <option value="granted">granted</option>
          <option value="refunded">refunded</option>
        </select>
        <select aria-label="Filter purchase kind" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">All kinds</option>
          <option value="consumable">consumable</option>
          <option value="subscription">subscription</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Order</th><th>Player</th><th>Product</th><th>State</th><th>Period end</th><th>Unrecovered</th><th /></tr></thead>
        <tbody>{purchases.map((p) => (
          <tr key={p.order_id}>
            <td><code>{p.order_id}</code></td>
            <td className="mono">{p.player_id}</td>
            <td>{p.product_id}</td>
            <td>{p.state}</td>
            <td>{p.period_end ?? '—'}</td>
            <td>{p.unrecovered === '{}' ? '' : p.unrecovered}</td>
            <td><button className="btn" type="button" onClick={() => inspectOrder(p.order_id)}>Reconcile</button></td>
          </tr>
        ))}</tbody>
      </table>
      {nextCursor ? <div className="row"><button className="btn" type="button" onClick={loadMorePurchases}>Load more purchases</button></div> : null}
      {purchaseDetail ? (
        <section className="card" aria-label="Purchase reconciliation detail">
          <div className="row">
            <h3>Order <code>{purchaseDetail.order_id}</code></h3>
            <button className="btn" type="button" onClick={() => downloadJson(`order-${purchaseDetail.order_id}.json`, { purchase: purchaseDetail, reconciliation })}>Export reconciliation</button>
            <button className="btn" type="button" onClick={() => { setPurchaseDetail(null); setReconciliation(null); }}>Close</button>
          </div>
          <p className="mono">player: {purchaseDetail.player_id} · product: {purchaseDetail.product_id} ({purchaseDetail.kind}) · state: {purchaseDetail.state} · ack: {purchaseDetail.acknowledged} · entitlement: {purchaseDetail.entitlement_state}</p>
          {reconciliation ? <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(reconciliation, null, 2)}</pre> : null}
        </section>
      ) : null}
      {jobs.length > 0 || notifications.length > 0 ? (
        <div className="grid">
          <section className="card">
            <h3>Billing recovery jobs ({jobs.length})</h3>
            <table>
              <thead><tr><th>Order</th><th>Kind</th><th>State</th><th>Attempts</th><th>Last code</th><th /></tr></thead>
              <tbody>{jobs.slice(0, 15).map((j) => (
                <tr key={j.token_hash}>
                  <td><code>{j.order_id}</code></td><td>{j.kind}</td><td>{j.state}</td><td>{j.attempts}</td><td className="mono">{j.last_code ?? '—'}</td>
                  <td>{canOperate && j.state === 'review' ? <button className="btn" type="button" onClick={() => void retryJob(j)}>Retry</button> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
          <section className="card">
            <h3>RTDN notifications ({notifications.length})</h3>
            <table>
              <thead><tr><th>Message</th><th>State</th><th>Attempts</th><th>Outcome / code</th><th /></tr></thead>
              <tbody>{notifications.slice(0, 15).map((n) => (
                <tr key={n.message_id}>
                  <td><code>{n.message_id}</code></td><td>{n.state}</td><td>{n.attempts}</td><td className="mono">{n.outcome ?? n.last_code ?? '—'}</td>
                  <td>{canOperate && n.state !== 'done' ? <button className="btn" type="button" onClick={() => void retryNotification(n)}>Retry</button> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        </div>
      ) : null}
      <h3>Rewarded ads (last 14 days)</h3>
      <table>
        <thead><tr><th>Day</th><th>Views</th><th>Players</th><th>Tokens paid</th></tr></thead>
        <tbody>{ads.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.views}</td><td>{d.players}</td><td>{d.tokens}</td></tr>)}</tbody>
      </table>
    </>
  );
}
