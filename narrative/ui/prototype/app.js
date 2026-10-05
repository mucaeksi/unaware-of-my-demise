/* UI design only: memory-local demo state, no backend, account or purchase calls. */
"use strict";
const $ = selector => document.querySelector(selector);
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const paths = {
  home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
  journey: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
  heroes: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 8a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 21v-3m20 3v-3"/>',
  summon: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4M12 2v2"/>',
  archive: '<path d="M3 4h6l3 2 3-2h6v16h-6l-3 2-3-2H3V4ZM12 6v16M6 8h3m6 0h3M6 12h3m6 0h3"/>',
  settings: '<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/>',
  crowns: '<path d="m3 7 4 3 5-7 5 7 4-3-2 11H5L3 7ZM5 21h14"/>',
  eclipse: '<circle cx="12" cy="12" r="8"/><path d="M15 4a9 9 0 0 0 0 16M2 12h2m16 0h2"/>',
  thread: '<path d="M7 3c-6 5 10 13 5 18M17 3C11 8 5 10 7 15c1 2 4 3 10 6M9 2h6M9 22h6"/>',
  ration: '<path d="M7 7h10l2 14H5L7 7ZM9 3h6v4M8 12h8m-6-2v7m4-7v7"/>',
  sword: '<path d="m14 3 7-1-1 7-9 9-5-5 8-10ZM4 11l9 9M8 16l-5 5M2 19l3 3"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4ZM12 6v11M8 10h8"/>',
  quest: '<path d="M6 3h12v18H6V3ZM9 7h6m-6 5h6m-6 5h3M3 6h3M18 6h3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  fire: '<path d="M12 2c1 6 6 6 6 11a6 6 0 0 1-12 0c0-3 2-6 3-7-1 6 4 5 3-4ZM12 14c4 4 1 7 0 7s-4-3 0-7Z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  forge: '<path d="M4 11h16l-4 4H8l-4-4ZM8 15v5h8v-5M5 21h14M9 3l6 5m-3-7 5 5"/>',
  water: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13ZM8 15a4 4 0 0 0 4 4"/>',
  wind: '<path d="M3 8h13c6 0 4-7 1-5M3 12h16c5 0 2 7-1 5M3 16h8c5 0 3 6 0 5"/>',
  star: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
const elementIcon = element => ({Stone:"shield",Veil:"eye",Ember:"fire",Tide:"water",Gale:"wind"}[element] || "star");
const elementColor = element => ({Stone:"#737a71",Veil:"#86718f",Ember:"#b07152",Tide:"#648f96",Gale:"#839680"}[element] || "#867c67");
const state = {page:"home",hero:"fadyme",chapter:0,stage:"1-5",ration:78,meal:false,owned:["mahmut","brin_alder","fadyme","kera_voss","nixie_vale"],formation:["mahmut","brin_alder","fadyme","kera_voss","nixie_vale"],rosterFilter:"all",search:"",archiveTab:"companions",banner:"standard_character",vn:0,motion:false,textSize:"normal",claimed:false,threads:17,pity:12,history:[]};
const mainPages = ["home","journey","heroes","summon","archive"];
const pageNames = {home:"Sığınak",journey:"Yolculuk",heroes:"Yoldaşlar",summon:"Çağrı",archive:"Kayıtlar",inventory:"Envanter",quests:"Görevler",settings:"Ayarlar",formation:"Formasyon",battle:"Savaş",vn:"Hikâye",title:"Açılış",selector:"İlk Yemin",hero:"Yoldaş"};
const character = id => SOURCE_DATA.characters.find(c => c.id === id);
const currentStage = () => SOURCE_DATA.chapters.flatMap(c => c.nodes).find(n => n.id === state.stage);
const btn = (text, action, cls="compact-button", extra="") => `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const pageButton = (text, page, cls="compact-button") => `<button class="${cls}" data-page="${page}">${text}</button>`;
const header = (title, subtitle, back="home") => `<header class="page-header"><button class="icon-btn" data-page="${back}" aria-label="Geri">${icon("back")}</button><div><h1>${title}</h1><p>${subtitle}</p></div></header>`;
const section = (title, note="") => `<div class="section-heading"><h2>${title}</h2><small>${note}</small></div>`;
const heroCard = (c, compact=false, action="hero") => `<button class="hero-card ${state.owned.includes(c.id)?"":"unowned"}" data-action="${action}" data-id="${c.id}" aria-label="${escapeText(c.name)}${state.owned.includes(c.id)?"":" — koleksiyonda yok"}"><div class="hero-art ${["fadyme","mahmut"].includes(c.id)?c.id:""}" style="--hero-color:${elementColor(c.element)}"><span class="level">${state.owned.includes(c.id)?"Lv 1":icon("lock")}</span><span class="element">${c.element}</span>${["fadyme","mahmut"].includes(c.id)?"":icon(elementIcon(c.element))}<span class="rarity">${"✦".repeat(c.rarity)}</span></div><div class="hero-name">${escapeText(compact?c.name.split(" ")[0]:c.name)}</div></button>`;
function navGroup(page) {
  if (["formation","battle","vn"].includes(page)) return "journey";
  if (["hero","inventory","selector"].includes(page)) return "heroes";
  if (["quests"].includes(page)) return "archive";
  return mainPages.includes(page) ? page : "home";
}
function renderNav() {
  $("#bottom-nav").hidden=["battle","vn","title"].includes(state.page);
  $("#bottom-nav").innerHTML = mainPages.map(p=>`<button class="nav-button ${navGroup(state.page)===p?"active":""}" data-page="${p}" ${navGroup(state.page)===p?'aria-current="page"':""}>${icon(p)}<span>${pageNames[p]}</span></button>`).join("");
  $("#design-nav").innerHTML = [...mainPages,"formation","battle","inventory","vn","settings","title"].map(p=>`<button class="rail-link ${state.page===p?"active":""}" data-page="${p}">${pageNames[p]}<span>${state.page===p?"●":"↗"}</span></button>`).join("");
}
function home() {
  const n = currentStage();
  return `<div class="hub"><div class="hub-top"><div class="profile-bar"><button class="avatar-button" data-page="settings" aria-label="Profil ve ayarlar"><span class="avatar"></span></button><div><div class="player-name">Yolcu</div><div class="player-level">HESAP LV 7 · VEYRHOLD</div></div><span class="spacer"></span><button class="icon-btn" data-page="quests" aria-label="Görevler">${icon("quest")}${state.claimed?"":'<span class="badge"></span>'}</button><button class="icon-btn" data-page="settings" aria-label="Ayarlar">${icon("settings")}</button></div><div class="wallet"><button class="currency" data-action="resource" data-id="crowns" aria-label="Crowns: 12840">${icon("crowns")}12.840</button><button class="currency" data-action="resource" data-id="eclipse" aria-label="Eclipse Tokens: 420">${icon("eclipse")}420</button><button class="currency" data-action="resource" data-id="thread" aria-label="Fate's Threads: ${state.threads}">${icon("thread")}${state.threads}</button><button class="currency ration" data-action="resource" data-id="ration" aria-label="Ration: ${state.ration}/100">${icon("ration")}${state.ration}<span>/100</span></button></div><div class="hub-heading"><span class="eyebrow">YOL UZUN. GECE DAHA UZUN.</span><h1>Sığınak</h1><p>Yeniden yola çıkmadan önce, bir nefes.</p></div></div><button class="hotspot oath" data-page="summon"><span class="seal">${icon("summon")}</span><span class="hot-label">Yemin Sunağı</span><span class="mini">YOLDAŞ ÇAĞIR</span></button><button class="hotspot inn" data-action="inn"><span class="seal">${icon("home")}</span><span class="hot-label">Han</span><span class="mini">${state.meal?"BUGÜN ALINDI":"+30 RATION"}</span></button><button class="hotspot forge" data-page="inventory"><span class="seal">${icon("forge")}</span><span class="hot-label">Tezgâh</span><span class="mini">ENVANTER</span></button><div class="hub-bottom"><div class="chapter-card"><div class="chapter-line"><span class="eyebrow">YOLCULUK · BÖLÜM I</span><span class="small-label">${n.id} · LV ${n.level}</span></div><h2>Fısıldayan Kül Ormanı</h2><p>${escapeText(n.title)}</p><div class="progress-track" aria-label="Bölüm ilerlemesi: 4/5"><i style="width:80%"></i></div><button class="cta" data-action="stage" data-id="${n.id}">Yola Devam Et ${icon("arrow")}</button></div></div></div>`;
}
function journey() {
  const c = SOURCE_DATA.chapters[state.chapter];
  return `<div class="page">${header("Yolculuk","PART I · 7 BÖLÜM / 35 DURAK")}<div class="journey-art"><div><span class="eyebrow">BÖLÜM ${state.chapter+1}</span><h2>${escapeText(c.name)}</h2></div></div>${section("Orman yolu",state.chapter===0?"4 / 5 tamamlandı":"Henüz açılmadı")}<div class="route-nodes">${c.nodes.map((n,i)=>`<button class="stage-row" data-action="stage" data-id="${n.id}" ${state.chapter>0?'aria-label="Kilitli durak: açılma bilgisini gör"':""}><span class="node ${state.chapter===0?(i<4?"cleared":"current"):""}">${state.chapter>0?icon("lock"):i<4?icon("check"):icon("sword")}</span><span><span class="stage-name">${n.id} · ${escapeText(n.title)}</span><span class="stage-detail">Lv ${n.level} · ${n.cost} Ration${i===4?" · BOSS":""}</span></span></button>`).join("")}</div>${section("Diğer bölümler")}<div class="chapter-list">${SOURCE_DATA.chapters.map((x,i)=>`<button class="card card-button" data-action="chapter" data-id="${i}"><div class="card-row"><span class="small-label">${String(i+1).padStart(2,"0")}</span><div class="card-text"><h3>${escapeText(x.name)}</h3><p>${i===0?"Mevcut yolculuk": "İlerlemeyle açılır"}</p></div>${icon(i===0?"arrow":"lock")}</div></button>`).join("")}</div></div>`;
}
function heroes() {
  return `<div class="page">${header("Yoldaşlar","5 SAHİP OLUNAN · 20 KOLEKSİYON")}<div class="filter-row"><input class="search" type="search" placeholder="Bir yoldaş ara…" value="${escapeText(state.search)}" aria-label="Yoldaş ara">${pageButton(icon("sword"),"formation","icon-btn")}</div><div class="tabs"><button class="tab ${state.rosterFilter==="all"?"active":""}" data-action="roster-filter" data-id="all">Tümü</button><button class="tab ${state.rosterFilter==="owned"?"active":""}" data-action="roster-filter" data-id="owned">Sahip Olunan</button><button class="tab ${state.rosterFilter==="Veil"?"active":""}" data-action="roster-filter" data-id="Veil">Veil</button></div><div class="hero-grid" id="hero-grid">${filteredHeroes()}</div><p class="quiet portrait-note">Mahmut ve Fadyme: onaylı referanslar. Diğer kartlarda portre yerine element işaretleri kullanıldı.</p></div>`;
}
function filteredHeroes() {
  const list=SOURCE_DATA.characters.filter(c=>(state.rosterFilter==="all"||state.rosterFilter==="owned"&&state.owned.includes(c.id)||c.element===state.rosterFilter)&&c.name.toLocaleLowerCase("tr").includes(state.search.toLocaleLowerCase("tr")));
  return list.length?list.map(c=>heroCard(c)).join(""):'<p class="empty">Bu aramada yoldaş bulunamadı.</p>';
}
function hero() {
  const c=character(state.hero), owned=state.owned.includes(c.id);
  return `<div class="page">${header(c.name,`${c.element.toUpperCase()} · ${c.role.replaceAll("_"," ").toUpperCase()}`,"heroes")}<div class="hero-cover ${c.id!=="fadyme"?"hero-cover-sigil":""}" style="--hero-color:${elementColor(c.element)}">${c.id!=="fadyme"?icon(elementIcon(c.element)):""}<div class="hero-cover-name"><span class="small-label">${"✦".repeat(c.rarity)} · ${owned?"LV 1":"KOLEKSİYONDA YOK"}</span><h2>${escapeText(c.name)}</h2></div></div><div class="stats">${Object.entries(c.stats).map(([k,v])=>`<div class="stat"><strong>${v}</strong><span>${k.toUpperCase()}</span></div>`).join("")}</div><p class="quiet">Lv 1 taban değerleri · ${c.front==="front"?"Ön":"Arka"} sıra yatkınlığı</p><div class="button-row">${pageButton("Ekipman","inventory")}${btn("Anılar","memories","compact-button",`data-id="${c.id}"`)}</div>${section("Yetenekler","4 YETENEK")} ${c.skills.map(s=>`<button class="card card-button" data-action="skill" data-id="${s.id}"><div class="card-row"><span class="skill-icon">${icon(s.type==="ultimate"?"star":s.type==="passive"?"shield":"sword")}</span><div class="card-text"><span class="small-label">${s.type.toUpperCase()}</span><h3>${escapeText(s.name)}</h3></div>${icon("arrow")}</div></button>`).join("")}<div class="button-row">${btn(owned?"Seviye ve gelişim":"Nasıl edinilir?",owned?"upgrade":"acquire","cta",`data-id="${c.id}"`)}</div></div>`;
}
function inventory() {
  const list=[...SOURCE_DATA.weapons,...SOURCE_DATA.armor];
  return `<div class="page">${header("Tezgâh & Envanter","SİLAH · ZIRH · TAKI · MALZEME")}<p class="notice">Ekipman örnekleri · Adlar ve nadirlikler mevcut oyun kayıtlarından.</p>${section("Silahlar","5 ÖRNEK")} ${list.map((item,i)=>`${i===5?section("Zırhlar", "3 ÖRNEK"):""}<button class="card card-button" data-action="item" data-id="${item.id}"><div class="card-row"><span class="item-icon">${icon(i<5?(i===1?"summon":"sword"):"shield")}</span><div class="card-text"><span class="small-label">${"✦".repeat(item.rarity)} · LV 1</span><h3>${escapeText(item.name)}</h3><p>${i<5?"İmza silahı":"Zırh"}</p></div>${icon("arrow")}</div></button>`).join("")}${section("Takılar & malzemeler")}<div class="card"><h3>Yüzük / kolye / geliştirme</h3><p>Öğe detayında slot, ana stat, alt stat ve maliyet ayrı gösterilir. Geliştirme ve parçalama onay ekranından geçer.</p></div></div>`;
}
function summon() {
  const b=SOURCE_DATA.banners[state.banner], standard=state.banner==="standard_character", weapon=state.banner==="weapon";
  const title=standard?"Ataların Salonu":weapon?"Silahların Yemini":"Sınırlı Yemin";
  return `<div class="page">${header("Çağrı","BİR İP. BİR İSİM. BİR YEMİN.")}<div class="tabs">${[["standard_character","Atalar"],["character","Sınırlı"],["weapon","Silah"]].map(([k,t])=>`<button class="tab ${state.banner===k?"active":""}" data-action="banner" data-id="${k}">${t}</button>`).join("")}</div><div class="banner-art"><div class="banner-title"><span class="eyebrow">${standard?"KALICI KARAKTER ÇAĞRISI":weapon?"İMZA SİLAHLARI":"BANNER YERLEŞİM ÖRNEĞİ"}</span><h2>${title}</h2><p>${standard?"Mahmut & Fadyme · Kalıcı 5★ havuzu":weapon?"Hedef silah ve Fate Knot bilgisi açıkça gösterilir.":"Bu görsel temsili; aktif sınırlı karakter ilanı değildir."}</p></div></div><div class="rates"><span>5★ taban oran <strong>${((b.base_five_star_rate||b.five_star_base_rate)*100).toLocaleString("tr")}%</strong></span><span>5★ sayacı <strong>${state.pity} / ${b.hard_pity}</strong></span></div><div class="card"><div class="card-row"><span class="item-icon">${icon("thread")}</span><div class="card-text"><h3>${state.threads} Fate’s Threads</h3><p>Her çağrı 1 ip · 10 çağrıda en az bir 4★+</p></div></div></div><div class="button-row">${btn("1 Çağrı · 1 ip","pull","cta",'data-id="1"')}${btn("10 Çağrı · 10 ip","pull","cta secondary",'data-id="10"')}</div><div class="button-row">${btn("Oranlar & Kurallar","rates")}${btn("Çağrı Geçmişi","history")}</div>${weapon?'<p class="notice">Hedef silah seçimi bu taslakta geliştirme kuyruğunda.</p>':""}</div>`;
}
function companionsList(id=null) {
  return SOURCE_DATA.companions.filter(s=>!id||s.id===id).map(s=>`<button class="card card-button" data-action="memories" data-id="${s.id}"><div class="card-row"><span class="item-icon">${icon("archive")}</span><div class="card-text"><h3>${escapeText(s.name)}</h3><p>${s.parts.length} anı · sahiplik ve ilerleme kilitleri</p></div>${icon("arrow")}</div></button>`).join("");
}
function archive() {
  let contents="";
  if(state.archiveTab==="companions") contents=companionsList();
  if(state.archiveTab==="codex") contents=SOURCE_DATA.codex.map((c,i)=>`<button class="card card-button" data-action="codex" data-id="${c.codex_id}"><div class="card-row"><span class="item-icon">${icon(i<2?"archive":"lock")}</span><div class="card-text"><h3>${i<2?escapeText(c.title_en):"Henüz keşfedilmedi"}</h3><p>${i<2?"Dünya kaydı":"Hikâyede ilerledikçe açılır"}</p></div></div></button>`).join("");
  if(state.archiveTab==="events") contents=SOURCE_DATA.events.map(e=>`<button class="card card-button" data-action="event" data-id="${e.id}"><div class="card-row"><span class="item-icon">${icon("lock")}</span><div class="card-text"><h3>Mühürlü etkinlik kaydı</h3><p>${e.unlock.after_stage} sonrası · takvim henüz bağlanmadı</p></div></div></button>`).join("");
  return `<div class="page">${header("Kayıtlar","HİKÂYENİN SENDE BIRAKTIĞI İZLER")}<button class="card card-button" data-page="quests"><div class="card-row"><span class="item-icon">${icon("quest")}</span><div class="card-text"><h3>Günlük & haftalık görevler</h3><p>${state.claimed?"Örnek ödül alındı":"Bir ödül alınmaya hazır"}</p></div>${state.claimed?"":'<span class="pill">1</span>'}</div></button><div class="tabs">${[["companions","Anılar"],["codex","Codex"],["events","Etkinlikler"]].map(([k,t])=>`<button class="tab ${state.archiveTab===k?"active":""}" data-action="archive-tab" data-id="${k}">${t}</button>`).join("")}</div>${contents}</div>`;
}
function quests() {
  return `<div class="page">${header("Görevler","GÜNLÜK DÖNGÜ · UTC", "archive")}${section("Günlük görevler","ÖRNEK DURUM")}<div class="card"><span class="small-label">TAMAMLANDI</span><h3>Sığınakta bir öğün</h3><p>Han yemeğini al · 1 / 1</p><div class="progress-track"><i style="width:100%"></i></div>${btn(state.claimed?"Ödül alındı":"Ödülü Al","claim-quest","cta",state.claimed?"disabled":"")}</div><div class="card"><span class="small-label">DEVAM EDİYOR</span><h3>Yola yeniden çık</h3><p>Görev satırı ve ilerleme yerleşimi örneği · 1 / 3</p><div class="progress-track"><i style="width:33%"></i></div>${pageButton("Yolculuğa Git","journey")}</div>${section("Haftalık görevler")}<div class="card"><h3>Uzun yolun izleri</h3><p>Görev adı, ödül ve hedefler gerçek quest tanımından bağlanacak. Bu kart yeni görev mekaniği tanımlamaz.</p></div></div>`;
}
function formation() {
  return `<div class="page">${header("Formasyon",`${state.stage} · 2 ÖN / 3 ARKA`,"journey")}<p class="quiet">Bir slot seç, sonra yer değiştireceği slotu seç.</p><div class="formation"><span class="small-label">ÖN SIRA</span><div class="formation-row">${state.formation.slice(0,2).map(id=>heroCard(character(id),true,"formation-slot")).join("")}</div><span class="small-label">ARKA SIRA</span><div class="formation-row">${state.formation.slice(2).map(id=>heroCard(character(id),true,"formation-slot")).join("")}</div></div>${section("Savaş planı")}<div class="card"><div class="card-row"><span class="skill-icon">${icon("journey")}</span><div class="card-text"><h3>Hedef & Ultimate politikası</h3><p>Otomatik sıra · Oyuncunun formasyon ve politika tercihleri</p></div>${btn("Düzenle","policy")}</div></div><div class="notice">${currentStage().cost} Ration yalnız doğrulanmış zaferde düşer. Bu önizlemede savaş motoru çalışmaz.</div>${pageButton("Savaş Düzenini Gör","battle","cta")}</div>`;
}
function battle() {
  const unit=(name,enemy=false,el="Veil")=>`<div class="unit ${enemy?"enemy":""}">${icon(enemy?"sword":elementIcon(el))}<span>${escapeText(name)}</span><div class="hp"><i></i></div></div>`;
  return `<div class="page">${header("Savaş",`${state.stage} · YERLEŞİM ÖNİZLEMESİ`,"formation")}<div class="battle-top"><span class="pill">TUR 01</span><div class="button-row">${btn("1×","speed")}${btn("AUTO","auto")}</div></div><div class="battle-field"><div class="battle-team">${["Ash Wolf","Hollow Pilgrim","Ash Wolf"].map(n=>unit(n,true)).join("")}</div><div class="telegraph"><span>${icon("eye")} Düşman hamlesi / telegraph alanı</span></div><div><div class="battle-team">${state.formation.slice(0,2).map(id=>unit(character(id).name,false,character(id).element)).join("")}</div><div class="battle-team">${state.formation.slice(2).map(id=>unit(character(id).name,false,character(id).element)).join("")}</div></div></div><div class="battle-log"><span class="small-label">SIRA & OLAY KAYDI</span><p>Hamle, hasar, status ve Focus bilgisi burada okunur. Bu ekran simülasyon çalıştırmaz.</p></div><div class="button-row">${btn("Zafer Önizlemesi","victory","cta")}${btn("Yenilgi","defeat","cta secondary")}</div></div>`;
}
function vn() {
  const line=SOURCE_DATA.dialogue[state.vn];
  return `<div class="page">${header("Hikâye","AÇILIŞ · KAYNAKTAN DİYALOG ÖRNEĞİ","journey")}<div class="vn-art"><span class="pill vn-counter">${state.vn+1} / ${SOURCE_DATA.dialogue.length}</span></div><div class="dialogue"><h2>${escapeText(line.speaker_display)}</h2><p>${escapeText(line.text_en)}</p></div><div class="vn-controls">${btn("Önceki","vn-prev")}${btn("Kayıt","vn-log")}${btn("Sonraki","vn-next")}</div><p class="quiet">Replikler mevcut İngilizce kaynaktan. Yeni hikâye veya çeviri eklenmedi; görsel sahne temsili.</p></div>`;
}
function settings() {
  return `<div class="page">${header("Profil & Ayarlar","YOLCU · HESAP LV 7")}<div class="card"><div class="card-row"><span class="avatar"></span><div class="card-text"><h3>Yolcu</h3><p>Oyuncu kimliği ve bağlantı durumu</p></div><span class="pill">Örnek hesap</span></div></div>${section("Ses")} ${[["Müzik",60],["Ses efektleri",80],["Karakter sesi",100]].map(([t,v])=>`<label class="setting-row"><span>${t}</span><input type="range" min="0" max="100" value="${v}" aria-label="${t}"></label>`).join("")}${section("Görünüm & Erişilebilirlik")}<div class="setting-row"><span>Hareketi azalt</span><button class="switch" role="switch" aria-label="Hareketi azalt" aria-checked="${state.motion}" data-action="motion"></button></div><label class="setting-row"><span>Metin boyutu</span><select data-setting="text" aria-label="Metin boyutu"><option value="normal" ${state.textSize==="normal"?"selected":""}>Standart</option><option value="large" ${state.textSize==="large"?"selected":""}>Büyük</option></select></label><div class="setting-row"><span>Arayüz dili</span><span class="quiet">Türkçe taslak</span></div>${section("Hesap")}<div class="button-row">${btn("Bağlantı Bilgisi","connection")}${btn("Oturum / Giriş","login")}</div><p class="notice">Bu prototip ses oynatmaz. Müzik ve VO hatları uygulama aşamasında bağlanacak.</p></div>`;
}
function title() {
  return `<div class="title-page"><div class="title-shade"></div><div class="title-content"><span class="eyebrow">A DARK FANTASY JOURNEY</span><h1>UNAWARE<span>OF MY DEMISE</span></h1><p>Yol bitmedi. Henüz.</p><button class="cta" data-action="login">Google ile Devam Et ${icon("arrow")}</button><button class="compact-button" data-page="home">Sığınak taslağını aç</button><span class="quiet">Giriş yerleşimi · Hesaba bağlanmaz</span></div></div>`;
}
function selector() {
  const list=SOURCE_DATA.characters.filter(c=>c.rarity===4);
  return `<div class="page">${header("İlk Yemin","BİR KALICI 4★ YOLDAŞ SEÇ","heroes")}<p class="notice">Davet seçimi ekranı. Prototip koleksiyonuna yeni karakter eklemez.</p><div class="hero-grid">${list.map(c=>heroCard(c,false,"select-oath")).join("")}</div></div>`;
}
const pages={home,journey,heroes,hero,inventory,summon,archive,quests,formation,battle,vn,settings,title,selector};
function render() {
  $("#app").className=`screen ${state.page==="home"?"home":""} ${["battle","vn","title"].includes(state.page)?"immersive":""}`;
  $("#app").innerHTML=pages[state.page]();
  renderNav();
}
function go(page) {
  if(!pages[page]) page="home";
  closeSheet(); state.page=page; location.hash=page; render(); $("#app").scrollTop=0;
}
let focusBeforeSheet=null;
function sheet(title,body,footer="") {
  focusBeforeSheet=document.activeElement;
  $("#overlay").innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><button class="close" data-action="close" aria-label="Kapat">${icon("close")}</button><span class="eyebrow">UNAWARE OF MY DEMISE</span><h2 id="sheet-title">${title}</h2>${body}${footer}</section>`;
  $("#overlay").hidden=false; $("#app").inert=true; $("#bottom-nav").inert=true; $("#design-nav").inert=true;
  $(".sheet .close").focus();
}
function closeSheet() {
  if($("#overlay").hidden) return;
  $("#overlay").hidden=true; $("#app").inert=false; $("#bottom-nav").inert=false; $("#design-nav").inert=false;
  if(focusBeforeSheet?.isConnected) focusBeforeSheet.focus();
}
let toastTimer;
function toast(text) {$("#toast").textContent=text;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),2600);}
let selectedSlot=null;
function action(name,id,button) {
  switch(name) {
    case "close": closeSheet(); break;
    case "resource": {
      const r={crowns:["Crowns","Ekipman ve gelişim için kullanılan oyun parası. Örnek bakiye: 12.840."],eclipse:["Eclipse Tokens","Premium kaynak. Örnek bakiye: 420. Bu taslakta mağaza veya satın alma yok."],thread:["Fate’s Threads",`Çağrı için kullanılan ipler. Örnek bakiye: ${state.threads}. Her çağrı 1 ip.`],ration:["Ration",`Örnek bakiye ${state.ration}/100. Doğal yenilenme: 5 dakikada 1. Yenilenme tavanı 100; han hibesi tavanı aşabilir. Standart savaşta yalnız doğrulanmış zaferde düşer.`]}[id];
      sheet(r[0],`<p>${r[1]}</p>`,id==="thread"?pageButton("Çağrıya Git","summon","cta"):"");break;
    }
    case "inn": sheet("Han Yemeği",`<p>Günün sıcak yemeği: <strong>+30 Ration.</strong></p><p>UTC gününde bir kez. Han hibesi, doğal yenilenme tavanını aşabilir.</p><div class="card"><h3>${state.ration} → ${state.meal?state.ration:state.ration+30}</h3><p>Ration · örnek oyuncu durumu</p></div>`,btn(state.meal?"Bugün Alındı":"Yemeği Al","meal","cta",state.meal?"disabled":""));break;
    case "meal": if(!state.meal){state.meal=true;state.ration+=30;closeSheet();render();toast("Örnek bakiye güncellendi: +30 Ration");}break;
    case "chapter": state.chapter=Number(id);render();$("#app").scrollTop=0;break;
    case "stage": {
      const n=SOURCE_DATA.chapters.flatMap(c=>c.nodes).find(x=>x.id===id);
      if(!id.startsWith("1-")){sheet("Yol henüz açılmadı","<p>Bu bölüm mevcut örnek ilerlemede kilitli. Açılma koşulu gerçek oyuncu ilerlemesine bağlanacak.</p>");break;}
      if(id!=="1-1")state.stage=id;
      sheet(`${n.id} · ${escapeText(n.title)}`,`<div class="stats"><div class="stat"><strong>${n.level}</strong><span>ÖNERİLEN LV</span></div><div class="stat"><strong>${n.cost}</strong><span>RATION</span></div></div><p>${n.id==="1-1"?"İki başlangıç yoldaşıyla ücretsiz rehberli tutorial. Standart beş kişilik formasyon bu stage'e uygulanmaz.":"Takımını düzenle, sonra yolculuğa devam et. Yenilgide Ration harcanmaz."}</p><p class="quiet">Düşman ve ödül kartları stage / drop table kaydından bağlanacak.</p>`,n.id==="1-1"?btn("Tutorial Düzenini Gör","tutorial","cta"):`<div class="button-row">${pageButton("Hikâye Taslağı","vn","compact-button")}${pageButton("Takımı Hazırla","formation","cta")}</div>`);break;
    }
    case "tutorial": sheet("1-1 · Rehberli Tutorial",`<p>Mahmut ve Fadyme · 0 Ration · Basic Attack, hedef ve görünür sıra tanıtımı.</p><div class="hero-grid">${["mahmut","fadyme"].map(id=>heroCard(character(id))).join("")}</div>`);break;
    case "hero":state.hero=id;go("hero");break;
    case "roster-filter":state.rosterFilter=id;render();break;
    case "skill":{const c=character(state.hero),s=c.skills.find(x=>x.id===id);sheet(escapeText(s.name),`<span class="pill">${s.type.toUpperCase()}</span><p>${escapeText(s.description)}</p><p class="quiet">${escapeText(s.id)} · mevcut kaynak tanımı</p>`);break;}
    case "memories":{const s=SOURCE_DATA.companions.find(x=>x.id===id);sheet(`${escapeText(s.name)} · Anılar`,s.parts.map((p,i)=>`<div class="card"><span class="small-label">ANI ${i+1} · KİLİTLİ</span><h3>Mühürlü kayıt</h3><p>${escapeText(p.unlock.after_stage)} sonrası${p.unlock.requires_owned_character?" · karakter sahipliği gerekli":""}</p></div>`).join(""));break;}
    case "upgrade":sheet("Gelişim", "<p>Seviye öncesi/sonrası statlar, harcanacak kaynaklar ve ekipman etkileri aynı onay kartında gösterilecek. Gelişim işlemi bu prototipte çalışmaz.</p>");break;
    case "acquire":sheet("Yoldaş edinme", "<p>Karakterin kaynak kaydındaki edinme yolu burada gösterilecek: hikâye, İlk Yemin veya uygun çağrı havuzu.</p>",pageButton("İlk Yemin Taslağı","selector","cta"));break;
    case "select-oath":sheet(`${escapeText(character(id).name)} · İlk Yemin`,"<p>Tek kalıcı 4★ seçim. Onaydan önce yetenekler ve takım rolü incelenebilir. Bu seçim örnek koleksiyonu değiştirmez.</p>",btn("Seçim Onayını Gör","oath-confirm","cta"));break;
    case "oath-confirm":closeSheet();toast("İlk Yemin onay yerleşimi incelendi. Gerçek seçim yapılmadı.");break;
    case "item": {const i=[...SOURCE_DATA.weapons,...SOURCE_DATA.armor].find(x=>x.id===id);sheet(escapeText(i.name),`<span class="pill">${i.rarity}★ · LV 1</span><p>${escapeText(i.description)}</p><p class="quiet">${escapeText(i.id)}</p>`,btn("Ekipman Akışını Gör","equip","cta"));break;}
    case "equip":sheet("Ekipman karşılaştırması","<p>Mevcut / seçilen öğe yan yana. Stat farkları, uygun slot ve yoldaş seçimi görünür. Geliştirme maliyeti ve parçalama ayrı onay ister.</p>",pageButton("Yoldaşları Aç","heroes","cta"));break;
    case "banner":state.banner=id;render();break;
    case "archive-tab":state.archiveTab=id;render();break;
    case "rates": {
      const b=SOURCE_DATA.banners[state.banner], standard=state.banner==="standard_character",weapon=state.banner==="weapon";
      sheet("Oranlar & Garantiler",`<p>5★ taban: <strong>${((b.base_five_star_rate||b.five_star_base_rate)*100).toLocaleString("tr")}%</strong>. 4★: ${(b.four_star_rate*100).toLocaleString("tr",{maximumFractionDigits:4})}%; 3★: ${(b.three_star_rate*100).toLocaleString("tr",{maximumFractionDigits:4})}%.</p><p>5★ hard pity: <strong>${b.hard_pity}</strong>. Her 10 çağrıda en az bir 4★ veya üstü.</p>${standard?"<p>Kalıcı havuz: Mahmut ve Fadyme. Sınırlı karakterler hariç. Soft pity yok; sayaç ayrıdır.</p>":weapon?"<p>Soft pity yok. Hedef silah şansı korumasız 5★ için %55; iki Fate Knot sonrası bir sonraki 5★ hedeftir. Hedef seçimi zorunludur.</p>":"<p>Soft pity 65. çağrıda başlar; her çağrıda 6 yüzde puan artar. Sınırlı hedef şansı 5★ geldiğinde %55; kaybedilirse sonraki 5★ hedef garantili. Sayaç ve garanti sonraki sınırlı bannera taşınır.</p>"}<p class="quiet">Kaynak: economy_part1.json. Rastgele çekiliş bu prototipte uygulanmaz.</p>`);break;
    }
    case "pull":{
      const count=Number(id);
      if(state.banner!=="standard_character"){sheet("Banner yerleşim örneği","<p>Bu banner için hedef seçimi ve sanat hazırlanacak. Çağrı sonuç taslağını Atalar sekmesinden inceleyebilirsin.</p>");break;}
      if(count>state.threads){sheet("Yeterli ip yok",`<p>${count} ip gerekli, örnek bakiye ${state.threads}. Taslakta satın alma veya para dönüşümü yapılmaz.</p>`);break;}
      sheet("Çağrıyı Onayla",`<p>${count} çağrı için <strong>${count} Fate’s Threads</strong>.</p><p>Bu bir sabit sonuç yerleşimi demosudur. Oranlara göre çekiliş veya gerçek harcama yapmaz.</p><div class="card"><h3>${state.threads} → ${state.threads-count} ip</h3><p>Yalnız bu sekmedeki örnek bakiye değişir.</p></div>`,btn("Sonuç Yerleşimini Gör","pull-demo","cta",`data-id="${count}"`));break;
    }
    case "pull-demo":{const count=Number(id);if(state.threads<count)break;state.threads-=count;state.history.unshift(`${count} çağrı · Sabit sonuç demo`);render();sheet("Çağrı Sonucu",`<p class="quiet">Sabit görsel örnek. Nadirlik dağılımı veya rastgele ödül çıktısı değildir.</p><div class="hero-grid">${heroCard(character("fadyme"))}</div><div class="card"><h3>Fadyme · Zaten sahip olunan</h3><p>Duplicate dönüşümünün gerçek miktarı, sonuç API'sinden gösterilecek.</p></div>`,btn("Sığınağa Dön","return-home","cta"));break;}
    case "history":sheet("Çağrı Geçmişi",state.history.length?state.history.map(x=>`<div class="card"><h3>${x}</h3><p>Bu sekmede tutulan örnek kayıt.</p></div>`).join(""):"<p>Bu taslakta henüz çağrı önizlemesi yapılmadı.</p>");break;
    case "return-home":go("home");break;
    case "codex":{const i=SOURCE_DATA.codex.findIndex(c=>c.codex_id===id),c=SOURCE_DATA.codex[i];sheet(i<2?escapeText(c.title_en):"Henüz keşfedilmedi",i<2?`<p>${escapeText(c.text_en)}</p>`:"<p>Spoiler koruması için kilitli kaydın içeriği ve başlığı gösterilmez. Gerçek unlock koşulları Narrative aktarımında eşlenecek.</p>");break;}
    case "event":sheet("Etkinlik kaydı","<p>Hikâye ilerleme koşulu ve etkinlik takvimi birlikte kontrol edilir. Takvim bağlanana kadar geri sayım veya katılım CTA'sı gösterilmez.</p>");break;
    case "claim-quest":state.claimed=true;render();toast("Görev durumu örnekte ‘alındı’ oldu. Gerçek ödül verilmedi.");break;
    case "formation-slot":if(!selectedSlot){selectedSlot=id;button.classList.add("selected-slot");toast("Yer değiştireceği slotu seç.");}else{const a=state.formation.indexOf(selectedSlot),b=state.formation.indexOf(id);[state.formation[a],state.formation[b]]=[state.formation[b],state.formation[a]];selectedSlot=null;render();toast("Örnek formasyon güncellendi.");}break;
    case "policy":sheet("Savaş Politikası",`<label class="setting-row">Hedef<select><option>Varsayılan</option><option>En düşük HP</option><option>Ön sıra</option></select></label><label class="setting-row">Ultimate<select><option>Hazır olduğunda</option><option>Boss'a sakla</option></select></label><p class="quiet">Seçenekler UI taslağıdır; nihai politika enum'ları BattlePlayback ile eşlenecek.</p>`,btn("Taslağı Kapat","close","cta"));break;
    case "speed":button.textContent=button.textContent==="1×"?"2×":"1×";toast("Hız kontrolü yerleşimi · savaş simülasyonu yok.");break;
    case "auto":button.classList.toggle("active");toast("Auto kontrolü yerleşimi · savaş simülasyonu yok.");break;
    case "victory":sheet("Yol Açıldı",`<span class="pill">ZAFER</span><p>Stage ${state.stage} · Ödüller yalnız sunucu sonucu doğrulandığında yazılır.</p><div class="card"><h3>Ödül / gelişim alanı</h3><p>Crowns, XP, drop ve ilk tamamlama ödülü ayrı gösterilir. Bu önizleme ödül üretmez.</p></div>`,pageButton("Hikâye Yerleşimine Git","vn","cta"));break;
    case "defeat":sheet("Yol Henüz Bitmedi",'<span class="pill">YENİLGİ</span><p>Ration harcanmadı. Formasyonu düzenleyebilir veya sığınağa dönebilirsin.</p>',`<div class="button-row">${pageButton("Takımı Düzenle","formation","cta")}${pageButton("Geri Çekil","home","cta secondary")}</div>`);break;
    case "vn-next":state.vn=(state.vn+1)%SOURCE_DATA.dialogue.length;render();break;
    case "vn-prev":state.vn=Math.max(0,state.vn-1);render();break;
    case "vn-log":sheet("Diyalog Kaydı",SOURCE_DATA.dialogue.slice(0,state.vn+1).map(l=>`<div class="card"><h3>${escapeText(l.speaker_display)}</h3><p>${escapeText(l.text_en)}</p></div>`).join(""));break;
    case "motion":state.motion=!state.motion;document.body.classList.toggle("motion-off",state.motion);button.setAttribute("aria-checked",String(state.motion));break;
    case "connection":sheet("Bağlantı Durumu","<p>Gerçek oyunda sunucu, senkronizasyon ve hesap durumları gösterilir. Bu prototip hiçbir oyun API'sine bağlanmaz.</p>");break;
    case "login":sheet("Giriş Akışı",`<p>Google kimliği → sunucu oturumu → oyuncu durumu → Sığınak. Loading, iptal ve yeniden deneme ayrı durumlar olacak.</p><p class="quiet">Bu taslak giriş veya çıkış işlemi yapmaz.</p>`,pageButton("Açılış Ekranını Gör","title","cta"));break;
  }
}
document.addEventListener("click",event=>{
  if(event.target===$("#overlay")){closeSheet();return;}
  const button=event.target.closest("[data-page],[data-action]");
  if(!button||button.disabled)return;
  if(button.dataset.page)go(button.dataset.page);
  else action(button.dataset.action,button.dataset.id,button);
});
document.addEventListener("input",event=>{
  if(event.target.matches(".search")){state.search=event.target.value;$("#hero-grid").innerHTML=filteredHeroes();}
});
document.addEventListener("change",event=>{
  if(event.target.dataset.setting==="text"){state.textSize=event.target.value;document.body.classList.toggle("large-text",state.textSize==="large");}
});
document.addEventListener("keydown",event=>{
  if($("#overlay").hidden)return;
  if(event.key==="Escape"){closeSheet();return;}
  if(event.key==="Tab"){
    const nodes=[...$(".sheet").querySelectorAll('button:not([disabled]),a,input,select,[tabindex="0"]')];
    if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}
  }
});
window.addEventListener("hashchange",()=>{const page=location.hash.slice(1);if(pages[page]&&state.page!==page){closeSheet();state.page=page;render();$("#app").scrollTop=0;}});
state.page=pages[location.hash.slice(1)]?location.hash.slice(1):"home";
render();
