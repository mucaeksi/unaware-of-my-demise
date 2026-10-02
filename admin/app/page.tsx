"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "dashboard" | "players" | "characters" | "banners" | "history" | "patches" | "audit";

type Banner = {
  id: string; code: string; name: string; active: boolean;
  single_cost: number; ten_cost: number; pity_5: number; pity_4: number;
  created_at?: string; entries?: Entry[];
};
type Entry = { item_id: string; code: string; name: string; rarity: number; weight: number; featured: boolean };
type Item = { id: string; code: string; name: string; rarity: number; kind: string };
type Player = { id: string; email: string; display_name: string; created_at: string; soft_currency: number; premium_currency: number; inventory_count: number };

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function adminFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-admin-token", token);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const r = await fetch(api + path, { ...init, headers, cache: "no-store" });
  const text = await r.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [manifest, setManifest] = useState<any>(null);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [itemForm, setItemForm] = useState({ code: "", name: "", rarity: 5, kind: "character" });
  const [bannerForm, setBannerForm] = useState({ code: "", name: "", singleCost: 160, tenCost: 1600, pity5: 80, pity4: 10 });
  const [grantForm, setGrantForm] = useState({ playerId: "", softCurrency: 0, premiumCurrency: 0 });

  const signedIn = useMemo(() => Boolean(token), [token]);

  async function loadDashboard() {
    const d = await adminFetch("/v1/admin/dashboard", token);
    setDashboard(d);
  }
  async function loadPlayers() {
    const qs = playerSearch ? `?search=${encodeURIComponent(playerSearch)}` : "";
    setPlayers((await adminFetch("/v1/admin/players" + qs, token)).players);
  }
  async function loadItems() { setItems((await adminFetch("/v1/admin/items", token)).items); }
  async function loadBanners() { setBanners((await adminFetch("/v1/admin/banners", token)).banners); }
  async function loadDraws() { setDraws((await adminFetch("/v1/admin/draws?limit=100", token)).draws); }
  async function loadAudit() { setAudit((await adminFetch("/v1/admin/audit?limit=100", token)).logs); }
  async function loadManifest() { setManifest(await adminFetch("/v1/content/manifest", token)); }

  async function loadAll() {
    if (!token) return;
    setLoading(true); setError("");
    try { await Promise.all([loadDashboard(), loadPlayers(), loadItems(), loadBanners(), loadDraws(), loadAudit(), loadManifest()]); setNotice("Admin verileri yenilendi."); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (signedIn) loadAll(); }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(action: () => Promise<void>, success = "İşlem tamamlandı.") {
    setLoading(true); setError(""); setNotice("");
    try { await action(); setNotice(success); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function createItem(e: FormEvent) {
    e.preventDefault();
    await run(async () => { await adminFetch("/v1/admin/items", token, { method: "POST", body: JSON.stringify(itemForm) }); setItemForm({code:"",name:"",rarity:5,kind:"character"}); await loadItems(); }, "Karakter/item oluşturuldu.");
  }

  async function createBanner(e: FormEvent) {
    e.preventDefault();
    await run(async () => { await adminFetch("/v1/admin/banners", token, { method: "POST", body: JSON.stringify(bannerForm) }); setBannerForm({code:"",name:"",singleCost:160,tenCost:1600,pity5:80,pity4:10}); await loadBanners(); }, "Banner oluşturuldu.");
  }

  async function toggleBanner(b: Banner) {
    await run(async () => { await adminFetch(`/v1/admin/banners/${b.id}/active`, token, { method: "POST", body: JSON.stringify({active: !b.active}) }); await loadBanners(); }, b.active ? "Banner pasifleştirildi." : "Banner aktifleştirildi.");
  }

  async function grantCurrency(e: FormEvent) {
    e.preventDefault();
    await run(async () => { await adminFetch(`/v1/admin/players/${grantForm.playerId}/grant`, token, { method:"POST", body: JSON.stringify({softCurrency:Number(grantForm.softCurrency),premiumCurrency:Number(grantForm.premiumCurrency),reason:"Admin grant"}) }); await loadPlayers(); await loadDashboard(); }, "Oyuncuya bakiye eklendi.");
  }

  async function editEntries(b: Banner) {
    setLoading(true); setError("");
    try {
      const data = await adminFetch(`/v1/admin/banners/${b.id}/entries`, token);
      setSelectedBanner({ ...b, entries: data.entries });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  async function saveEntries() {
    if (!selectedBanner) return;
    await run(async () => {
      await adminFetch(`/v1/admin/banners/${selectedBanner.id}/entries`, token, { method:"PUT", body:JSON.stringify({entries:selectedBanner.entries || []}) });
      await loadBanners(); setSelectedBanner(null);
    }, "Banner oranları kaydedildi.");
  }

  function updateEntry(index: number, patch: Partial<Entry>) {
    if (!selectedBanner) return;
    const entries = [...(selectedBanner.entries || [])]; entries[index] = { ...entries[index], ...patch };
    setSelectedBanner({ ...selectedBanner, entries });
  }

  if (!signedIn) return <Login token={token} setToken={setToken} onLogin={() => setToken(token.trim())} />;

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">G</span><div><strong>Gacha Control</strong><small>Game Operations</small></div></div>
        <nav>
          {([["dashboard","Dashboard"],["players","Oyuncular"],["characters","Karakterler / Itemler"],["banners","Gacha Bannerları"],["history","Çekiliş Geçmişi"],["patches","Patch / Content"],["audit","Audit Log"]] as const).map(([id,label]) => <button className={tab===id?"navItem active":"navItem"} key={id} onClick={()=>setTab(id)}>{label}</button>)}
        </nav>
        <button className="navItem danger" onClick={()=>{setToken("");setDashboard(null)}}>Çıkış</button>
      </aside>

      <main className="content">
        <header className="topbar"><div><h1>{tabTitle(tab)}</h1><p>Server-authoritative online gacha yönetim paneli</p></div><button className="ghost" onClick={()=>loadAll()} disabled={loading}>{loading?"Yükleniyor…":"↻ Yenile"}</button></header>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {tab === "dashboard" && <Dashboard data={dashboard} />}

        {tab === "players" && <section className="panelGrid">
          <div className="panel full"><div className="panelHead"><h2>Oyuncular</h2><div className="inline"><input value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} placeholder="Email veya oyuncu adı ara"/><button onClick={()=>run(loadPlayers)}>Ara</button></div></div>
            <table><thead><tr><th>Oyuncu</th><th>Email</th><th>Soft</th><th>Premium</th><th>Inventory</th><th>Kayıt</th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td><strong>{p.display_name}</strong><small>{p.id}</small></td><td>{p.email}</td><td>{fmt(p.soft_currency)}</td><td>{fmt(p.premium_currency)}</td><td>{fmt(p.inventory_count)}</td><td>{new Date(p.created_at).toLocaleString("tr-TR")}</td></tr>)}</tbody></table>
          </div>
          <div className="panel"><h2>Bakiye / Grant</h2><p className="muted">Test, kompansasyon veya event ödülleri için.</p><form onSubmit={grantCurrency} className="form"><input required placeholder="Player UUID" value={grantForm.playerId} onChange={e=>setGrantForm({...grantForm,playerId:e.target.value})}/><input type="number" min="0" placeholder="Soft Currency" value={grantForm.softCurrency} onChange={e=>setGrantForm({...grantForm,softCurrency:Number(e.target.value)})}/><input type="number" min="0" placeholder="Premium Currency" value={grantForm.premiumCurrency} onChange={e=>setGrantForm({...grantForm,premiumCurrency:Number(e.target.value)})}/><button>Grant</button></form></div>
        </section>}

        {tab === "characters" && <section className="panelGrid"><div className="panel"><h2>Yeni karakter / item</h2><form onSubmit={createItem} className="form"><input required placeholder="Code (ör. marek)" value={itemForm.code} onChange={e=>setItemForm({...itemForm,code:e.target.value})}/><input required placeholder="Ad" value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})}/><select value={itemForm.rarity} onChange={e=>setItemForm({...itemForm,rarity:Number(e.target.value)})}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}★</option>)}</select><select value={itemForm.kind} onChange={e=>setItemForm({...itemForm,kind:e.target.value})}><option value="character">character</option><option value="weapon">weapon</option><option value="skin">skin</option><option value="item">item</option></select><button>Oluştur</button></form></div><div className="panel full"><h2>Catalog</h2><table><thead><tr><th>Code</th><th>Ad</th><th>Rarity</th><th>Tür</th><th>ID</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td><code>{i.code}</code></td><td>{i.name}</td><td><Badge text={`${i.rarity}★`} /></td><td>{i.kind}</td><td><small>{i.id}</small></td></tr>)}</tbody></table></div></section>}

        {tab === "banners" && <section className="panelGrid"><div className="panel"><h2>Yeni banner</h2><form onSubmit={createBanner} className="form"><input required placeholder="Code" value={bannerForm.code} onChange={e=>setBannerForm({...bannerForm,code:e.target.value})}/><input required placeholder="Banner adı" value={bannerForm.name} onChange={e=>setBannerForm({...bannerForm,name:e.target.value})}/><div className="two"><label>1x cost<input type="number" value={bannerForm.singleCost} onChange={e=>setBannerForm({...bannerForm,singleCost:Number(e.target.value)})}/></label><label>10x cost<input type="number" value={bannerForm.tenCost} onChange={e=>setBannerForm({...bannerForm,tenCost:Number(e.target.value)})}/></label></div><div className="two"><label>5★ pity<input type="number" value={bannerForm.pity5} onChange={e=>setBannerForm({...bannerForm,pity5:Number(e.target.value)})}/></label><label>4★ pity<input type="number" value={bannerForm.pity4} onChange={e=>setBannerForm({...bannerForm,pity4:Number(e.target.value)})}/></label></div><button>Banner oluştur</button></form></div><div className="panel full"><h2>Bannerlar</h2><table><thead><tr><th>Banner</th><th>Maliyet</th><th>Pity</th><th>Durum</th><th>Aksiyon</th></tr></thead><tbody>{banners.map(b=><tr key={b.id}><td><strong>{b.name}</strong><small>{b.code}</small></td><td>1× {fmt(b.single_cost)} · 10× {fmt(b.ten_cost)}</td><td>5★ {b.pity_5} · 4★ {b.pity_4}</td><td><Badge text={b.active?"AKTİF":"PASİF"} good={b.active}/></td><td><div className="inline"><button onClick={()=>toggleBanner(b)}>{b.active?"Pasifleştir":"Aktifleştir"}</button><button className="ghost" onClick={()=>editEntries(b)}>Oranlar / Pool</button></div></td></tr>)}</tbody></table></div></section>}

        {tab === "history" && <section className="panel"><div className="panelHead"><h2>Son çekilişler</h2><span className="muted">Son 100 kayıt</span></div><table><thead><tr><th>Zaman</th><th>Player</th><th>Banner</th><th>Adet</th><th>Cost</th><th>Request ID</th></tr></thead><tbody>{draws.map(d=><tr key={d.id}><td>{new Date(d.created_at).toLocaleString("tr-TR")}</td><td><small>{d.player_id}</small></td><td>{d.banner_name || d.banner_id}</td><td>{d.quantity}</td><td>{fmt(d.cost)}</td><td><code>{d.request_id}</code></td></tr>)}</tbody></table></section>}

        {tab === "patches" && <section className="panelGrid"><div className="panel"><h2>Content version</h2><div className="metric large">{manifest?.latest_content_version || "—"}</div><p className="muted">Min app: {manifest?.min_app_version || "—"}</p><pre className="manifest">{JSON.stringify(manifest, null, 2)}</pre></div><div className="panel"><h2>Patch prensibi</h2><p>Yeni karakter, skin, ses, görsel, sahne ve data paketleri PCK olarak dağıtılabilir. Core executable değişiklikleri ise Google Play AAB güncellemesi gerektirebilir.</p><div className="callout">Patch dosyasını yayınlamadan önce SHA-256 hash ve manifest sürümünü kontrol et.</div></div></section>}

        {tab === "audit" && <section className="panel"><table><thead><tr><th>Zaman</th><th>Actor</th><th>Action</th><th>Entity</th><th>Payload</th></tr></thead><tbody>{audit.map(l=><tr key={l.id}><td>{new Date(l.created_at).toLocaleString("tr-TR")}</td><td>{l.actor}</td><td><Badge text={l.action}/></td><td>{l.entity_type} {l.entity_id && <small>{l.entity_id}</small>}</td><td><code>{JSON.stringify(l.payload || {})}</code></td></tr>)}</tbody></table></section>}
      </main>

      {selectedBanner && <div className="modalBackdrop"><div className="modal"><div className="panelHead"><div><h2>{selectedBanner.name} — Pool / Oranlar</h2><p className="muted">Weight toplamı otomatik yüzde hesabının temelidir.</p></div><button className="ghost" onClick={()=>setSelectedBanner(null)}>✕</button></div><div className="scrollTable"><table><thead><tr><th>Item</th><th>Rarity</th><th>Weight</th><th>Featured</th></tr></thead><tbody>{(selectedBanner.entries||[]).map((e,i)=><tr key={e.item_id}><td><strong>{e.name}</strong><small>{e.code}</small></td><td>{e.rarity}★</td><td><input type="number" min="1" value={e.weight} onChange={x=>updateEntry(i,{weight:Number(x.target.value)})}/></td><td><input type="checkbox" checked={e.featured} onChange={x=>updateEntry(i,{featured:x.target.checked})}/></td></tr>)}</tbody></table></div><div className="modalFooter"><span>{(selectedBanner.entries||[]).length} item</span><button onClick={saveEntries}>Kaydet</button></div></div></div>}
    </div>
  );
}

function Login({token,setToken,onLogin}:{token:string,setToken:(v:string)=>void,onLogin:()=>void}) { return <main className="login"><div className="loginCard"><div className="brand centered"><span className="brandMark">G</span><div><strong>Gacha Control</strong><small>Game Operations</small></div></div><h1>Admin girişi</h1><p>Sunucu üzerindeki ADMIN_API_TOKEN değerini gir.</p><input type="password" value={token} onChange={e=>setToken(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onLogin()}} placeholder="ADMIN_API_TOKEN"/><button onClick={onLogin}>Panele gir</button></div></main> }
function Dashboard({data}:{data:any}) { return <section className="dashboard"><div className="stats">{[["Oyuncular",data?.players ?? 0],["Aktif Banner",data?.activeBanners ?? 0],["5★ Item",data?.fiveStarItems ?? 0],["Bugünkü Draw",data?.drawsToday ?? 0]].map(([k,v])=><div className="stat" key={String(k)}><span>{k}</span><strong>{fmt(v)}</strong></div>)}</div><div className="panelGrid"><div className="panel"><h2>Operasyon özeti</h2><p>Admin paneli; catalog, banner pool, oyuncu bakiyesi, çekiliş geçmişi, patch manifest ve audit kayıtlarını tek yerden yönetmek için hazırlanmıştır.</p></div><div className="panel"><h2>Güvenlik</h2><p>Production'da ADMIN_API_TOKEN yerine RBAC tabanlı admin auth, MFA ve rate limit eklenmelidir. Gacha ve para hareketleri server-side transaction ile yapılmalıdır.</p></div></div></section> }
function Badge({text,good=false}:{text:string,good?:boolean}) { return <span className={good?"badge good":"badge"}>{text}</span> }
function tabTitle(tab:Tab){return ({dashboard:"Dashboard",players:"Oyuncular",characters:"Karakterler / Itemler",banners:"Gacha Bannerları",history:"Çekiliş Geçmişi",patches:"Patch / Content",audit:"Audit Log"} as any)[tab]}
function fmt(v:any){return Number(v||0).toLocaleString("tr-TR")}
