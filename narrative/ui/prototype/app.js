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
const pageNames = {home:"Sanctuary",journey:"Journey",heroes:"Companions",summon:"Summon",archive:"Records",inventory:"Inventory",quests:"Quests",settings:"Settings",formation:"Formation",battle:"Battle",vn:"Story",title:"Sign-in",selector:"First Oath",hero:"Companion"};
const character = id => SOURCE_DATA.characters.find(c => c.id === id);
const currentStage = () => SOURCE_DATA.chapters.flatMap(c => c.nodes).find(n => n.id === state.stage);
const btn = (text, action, cls="compact-button", extra="") => `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const pageButton = (text, page, cls="compact-button") => `<button class="${cls}" data-page="${page}">${text}</button>`;
const header = (title, subtitle, back="home") => `<header class="page-header"><button class="icon-btn" data-page="${back}" aria-label="Back">${icon("back")}</button><div><h1>${title}</h1><p>${subtitle}</p></div></header>`;
const section = (title, note="") => `<div class="section-heading"><h2>${title}</h2><small>${note}</small></div>`;
const heroCard = (c, compact=false, action="hero") => `<button class="hero-card ${state.owned.includes(c.id)?"":"unowned"}" data-action="${action}" data-id="${c.id}" aria-label="${escapeText(c.name)}${state.owned.includes(c.id)?"":" — not owned"}"><div class="hero-art ${["fadyme","mahmut"].includes(c.id)?c.id:""}" style="--hero-color:${elementColor(c.element)}"><span class="level">${state.owned.includes(c.id)?"Lv 1":icon("lock")}</span><span class="element">${c.element}</span>${["fadyme","mahmut"].includes(c.id)?"":icon(elementIcon(c.element))}<span class="rarity">${"✦".repeat(c.rarity)}</span></div><div class="hero-name">${escapeText(compact?c.name.split(" ")[0]:c.name)}</div></button>`;
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
  return `<div class="hub"><div class="hub-top"><div class="profile-bar"><button class="avatar-button" data-page="settings" aria-label="Profile and Settings"><span class="avatar"></span></button><div><div class="player-name">Traveler</div><div class="player-level">ACCOUNT LV 7 · VEYRHOLD</div></div><span class="spacer"></span><button class="icon-btn" data-page="quests" aria-label="Quests">${icon("quest")}${state.claimed?"":'<span class="badge"></span>'}</button><button class="icon-btn" data-page="settings" aria-label="Settings">${icon("settings")}</button></div><div class="wallet"><button class="currency" data-action="resource" data-id="crowns" aria-label="Crowns: 12840">${icon("crowns")}12,840</button><button class="currency" data-action="resource" data-id="eclipse" aria-label="Eclipse Tokens: 420">${icon("eclipse")}420</button><button class="currency" data-action="resource" data-id="thread" aria-label="Fate's Threads: ${state.threads}">${icon("thread")}${state.threads}</button><button class="currency ration" data-action="resource" data-id="ration" aria-label="Ration: ${state.ration}/100">${icon("ration")}${state.ration}<span>/100</span></button></div><div class="hub-heading"><span class="eyebrow">THE ROAD IS LONG. THE NIGHT IS LONGER.</span><h1>Sanctuary</h1><p>A moment to breathe before the road ahead.</p></div></div><button class="hotspot oath" data-page="summon"><span class="seal">${icon("summon")}</span><span class="hot-label">Oath Altar</span><span class="mini">SUMMON COMPMEMORYONS</span></button><button class="hotspot inn" data-action="inn"><span class="seal">${icon("home")}</span><span class="hot-label">Inn</span><span class="mini">${state.meal?"CLAIMED TODAY":"+30 RATION"}</span></button><button class="hotspot forge" data-page="inventory"><span class="seal">${icon("forge")}</span><span class="hot-label">Workshop</span><span class="mini">INVENTORY</span></button><div class="hub-bottom"><div class="chapter-card"><div class="chapter-line"><span class="eyebrow">JOURNEY · CHAPTER I</span><span class="small-label">${n.id} · LV ${n.level}</span></div><h2>${escapeText(SOURCE_DATA.chapters[0].name)}</h2><p>${escapeText(n.title)}</p><div class="progress-track" aria-label="Chapter progress: 4/5"><i style="width:80%"></i></div><button class="cta" data-action="stage" data-id="${n.id}">Continue Journey ${icon("arrow")}</button></div></div></div>`;
}
function journey() {
  const c = SOURCE_DATA.chapters[state.chapter];
  return `<div class="page">${header("Journey","PART I · 7 CHAPTERS / 35 STAGES")}<div class="journey-art"><div><span class="eyebrow">CHAPTER ${state.chapter+1}</span><h2>${escapeText(c.name)}</h2></div></div>${section("Forest road",state.chapter===0?"4 / 5 cleared":"Not yet unlocked")}<div class="route-nodes">${c.nodes.map((n,i)=>`<button class="stage-row" data-action="stage" data-id="${n.id}" ${state.chapter>0?'aria-label="Locked stage: view unlock details"':""}><span class="node ${state.chapter===0?(i<4?"cleared":"current"):""}">${state.chapter>0?icon("lock"):i<4?icon("check"):icon("sword")}</span><span><span class="stage-name">${n.id} · ${escapeText(n.title)}</span><span class="stage-detail">Lv ${n.level} · ${n.cost} Ration${i===4?" · BOSS":""}</span></span></button>`).join("")}</div>${section("Other chapters")}<div class="chapter-list">${SOURCE_DATA.chapters.map((x,i)=>`<button class="card card-button" data-action="chapter" data-id="${i}"><div class="card-row"><span class="small-label">${String(i+1).padStart(2,"0")}</span><div class="card-text"><h3>${escapeText(x.name)}</h3><p>${i===0?"Current journey": "Unlocks with progress"}</p></div>${icon(i===0?"arrow":"lock")}</div></button>`).join("")}</div></div>`;
}
function heroes() {
  return `<div class="page">${header("Companions","5 OWNED · 20 IN COLLECTION")}<div class="filter-row"><input class="search" type="search" placeholder="Search for a companion…" value="${escapeText(state.search)}" aria-label="Search companions">${pageButton(icon("sword"),"formation","icon-btn")}</div><div class="tabs"><button class="tab ${state.rosterFilter==="all"?"active":""}" data-action="roster-filter" data-id="all">All</button><button class="tab ${state.rosterFilter==="owned"?"active":""}" data-action="roster-filter" data-id="owned">Owned</button><button class="tab ${state.rosterFilter==="Veil"?"active":""}" data-action="roster-filter" data-id="Veil">Veil</button></div><div class="hero-grid" id="hero-grid">${filteredHeroes()}</div><p class="quiet portrait-note">Mahmut and Fadyme use approved references. Other portraits use element markers in this wireframe.</p></div>`;
}
function filteredHeroes() {
  const list=SOURCE_DATA.characters.filter(c=>(state.rosterFilter==="all"||state.rosterFilter==="owned"&&state.owned.includes(c.id)||c.element===state.rosterFilter)&&c.name.toLocaleLowerCase("en").includes(state.search.toLocaleLowerCase("en")));
  return list.length?list.map(c=>heroCard(c)).join(""):'<p class="empty">No companions match this search.</p>';
}
function hero() {
  const c=character(state.hero), owned=state.owned.includes(c.id);
  return `<div class="page">${header(c.name,`${c.element.toUpperCase()} · ${c.role.replaceAll("_"," ").toUpperCase()}`,"heroes")}<div class="hero-cover ${c.id!=="fadyme"?"hero-cover-sigil":""}" style="--hero-color:${elementColor(c.element)}">${c.id!=="fadyme"?icon(elementIcon(c.element)):""}<div class="hero-cover-name"><span class="small-label">${"✦".repeat(c.rarity)} · ${owned?"LV 1":"NOT OWNED"}</span><h2>${escapeText(c.name)}</h2></div></div><div class="stats">${Object.entries(c.stats).map(([k,v])=>`<div class="stat"><strong>${v}</strong><span>${k.toUpperCase()}</span></div>`).join("")}</div><p class="quiet">Base values at Lv 1 · ${c.front==="front"?"Front":"Rear"} row affinity</p><div class="button-row">${pageButton("Equipment","inventory")}${btn("Memories","memories","compact-button",`data-id="${c.id}"`)}</div>${section("Skills","4 SKILLS")} ${c.skills.map(s=>`<button class="card card-button" data-action="skill" data-id="${s.id}"><div class="card-row"><span class="skill-icon">${icon(s.type==="ultimate"?"star":s.type==="passive"?"shield":"sword")}</span><div class="card-text"><span class="small-label">${s.type.toUpperCase()}</span><h3>${escapeText(s.name)}</h3></div>${icon("arrow")}</div></button>`).join("")}<div class="button-row">${btn(owned?"Level & Progression":"How to Obtain",owned?"upgrade":"acquire","cta",`data-id="${c.id}"`)}</div></div>`;
}
function inventory() {
  const list=[...SOURCE_DATA.weapons,...SOURCE_DATA.armor];
  return `<div class="page">${header("Workshop & Inventory","WEAPONS · ARMOR · ACCESSORIES · MATERIALS")}<p class="notice">Equipment samples use names and rarities from current game data.</p>${section("Weapons","5 SAMPLES")} ${list.map((item,i)=>`${i===5?section("Armor", "3 SAMPLES"):""}<button class="card card-button" data-action="item" data-id="${item.id}"><div class="card-row"><span class="item-icon">${icon(i<5?(i===1?"summon":"sword"):"shield")}</span><div class="card-text"><span class="small-label">${"✦".repeat(item.rarity)} · LV 1</span><h3>${escapeText(item.name)}</h3><p>${i<5?"Signature weapon":"Armor"}</p></div>${icon("arrow")}</div></button>`).join("")}${section("Accessories & materials")}<div class="card"><h3>Rings / necklaces / upgrades</h3><p>Item details show the slot, primary stat, secondary stats and cost. Upgrades and dismantling require confirmation.</p></div></div>`;
}
function summon() {
  const b=SOURCE_DATA.banners[state.banner], standard=state.banner==="standard_character", weapon=state.banner==="weapon";
  const title=standard?"Hall of Ancestors":weapon?"Oath of Arms":"Limited Oath";
  return `<div class="page">${header("Summon","ONE THREAD. ONE NAME. ONE OATH.")}<div class="tabs">${[["standard_character","Ancestors"],["character","Limited"],["weapon","Weapon"]].map(([k,t])=>`<button class="tab ${state.banner===k?"active":""}" data-action="banner" data-id="${k}">${t}</button>`).join("")}</div><div class="banner-art"><div class="banner-title"><span class="eyebrow">${standard?"PERMANENT CHARACTER SUMMON":weapon?"SIGNATURE WEAPONS":"BANNER WIREFRAME"}</span><h2>${title}</h2><p>${standard?"Mahmut & Fadyme · Permanent 5★ pool":weapon?"Target weapon and Fate Knot details are shown clearly.":"Sample artwork; no active limited character is announced."}</p></div></div><div class="rates"><span>5★ base rate <strong>${((b.base_five_star_rate||b.five_star_base_rate)*100).toLocaleString("en")}%</strong></span><span>5★ pity <strong>${state.pity} / ${b.hard_pity}</strong></span></div><div class="card"><div class="card-row"><span class="item-icon">${icon("thread")}</span><div class="card-text"><h3>${state.threads} Fate’s Threads</h3><p>1 Thread per summon · At least one 4★+ every 10 summons</p></div></div></div><div class="button-row">${btn("1 Summon · 1 Thread","pull","cta",'data-id="1"')}${btn("10 Summons · 10 Threads","pull","cta secondary",'data-id="10"')}</div><div class="button-row">${btn("Rates & Rules","rates")}${btn("Summon History","history")}</div>${weapon?'<p class="notice">Target weapon selection is pending in this wireframe.</p>':""}</div>`;
}
function companionsList(id=null) {
  return SOURCE_DATA.companions.filter(s=>!id||s.id===id).map(s=>`<button class="card card-button" data-action="memories" data-id="${s.id}"><div class="card-row"><span class="item-icon">${icon("archive")}</span><div class="card-text"><h3>${escapeText(s.name)}</h3><p>${s.parts.length} memories · ownership and progression gates</p></div>${icon("arrow")}</div></button>`).join("");
}
function archive() {
  let contents="";
  if(state.archiveTab==="companions") contents=companionsList();
  if(state.archiveTab==="codex") contents=SOURCE_DATA.codex.map((c,i)=>`<button class="card card-button" data-action="codex" data-id="${c.codex_id}"><div class="card-row"><span class="item-icon">${icon(i<2?"archive":"lock")}</span><div class="card-text"><h3>${i<2?escapeText(c.title_en):"Undiscovered"}</h3><p>${i<2?"World record":"Unlocks with story progress"}</p></div></div></button>`).join("");
  if(state.archiveTab==="events") contents=SOURCE_DATA.events.map(e=>`<button class="card card-button" data-action="event" data-id="${e.id}"><div class="card-row"><span class="item-icon">${icon("lock")}</span><div class="card-text"><h3>Sealed event record</h3><p>${e.unlock.after_stage} cleared · schedule not connected</p></div></div></button>`).join("");
  return `<div class="page">${header("Records","THE TRACES YOUR JOURNEY LEAVES")}<button class="card card-button" data-page="quests"><div class="card-row"><span class="item-icon">${icon("quest")}</span><div class="card-text"><h3>Daily & weekly quests</h3><p>${state.claimed?"Sample reward claimed":"One reward is ready to claim"}</p></div>${state.claimed?"":'<span class="pill">1</span>'}</div></button><div class="tabs">${[["companions","Memories"],["codex","Codex"],["events","Events"]].map(([k,t])=>`<button class="tab ${state.archiveTab===k?"active":""}" data-action="archive-tab" data-id="${k}">${t}</button>`).join("")}</div>${contents}</div>`;
}
function quests() {
  return `<div class="page">${header("Quests","DAILY CYCLE · UTC", "archive")}${section("Daily quests","SAMPLE STATE")}<div class="card"><span class="small-label">COMPLETED</span><h3>A meal at the Sanctuary</h3><p>Claim the inn meal · 1 / 1</p><div class="progress-track"><i style="width:100%"></i></div>${btn(state.claimed?"Reward claimed":"Claim Reward","claim-quest","cta",state.claimed?"disabled":"")}</div><div class="card"><span class="small-label">IN PROGRESS</span><h3>Return to the road</h3><p>Sample quest row and progress layout · 1 / 3</p><div class="progress-track"><i style="width:33%"></i></div>${pageButton("Go to Journey","journey")}</div>${section("Weekly quests")}<div class="card"><h3>Traces of the long road</h3><p>Quest names, rewards and objectives will use actual quest definitions. This card is a layout sample.</p></div></div>`;
}
function formation() {
  return `<div class="page">${header("Formation",`${state.stage} · 2 FRONT / 3 REAR`,"journey")}<p class="quiet">Choose a slot, then choose another slot to swap.</p><div class="formation"><span class="small-label">FRONT ROW</span><div class="formation-row">${state.formation.slice(0,2).map(id=>heroCard(character(id),true,"formation-slot")).join("")}</div><span class="small-label">REAR ROW</span><div class="formation-row">${state.formation.slice(2).map(id=>heroCard(character(id),true,"formation-slot")).join("")}</div></div>${section("Battle plan")}<div class="card"><div class="card-row"><span class="skill-icon">${icon("journey")}</span><div class="card-text"><h3>Target & Ultimate policy</h3><p>Automatic turns · Formation and policy choices</p></div>${btn("Edit","policy")}</div></div><div class="notice">${currentStage().cost} Ration is spent only on a confirmed victory. This wireframe does not run the battle engine.</div>${pageButton("View Battle Layout","battle","cta")}</div>`;
}
function battle() {
  const unit=(name,enemy=false,el="Veil")=>`<div class="unit ${enemy?"enemy":""}">${icon(enemy?"sword":elementIcon(el))}<span>${escapeText(name)}</span><div class="hp"><i></i></div></div>`;
  return `<div class="page">${header("Battle",`${state.stage} · LAYOUT PREVIEW`,"formation")}<div class="battle-top"><span class="pill">TURN 01</span><div class="button-row">${btn("1×","speed")}${btn("AUTO","auto")}</div></div><div class="battle-field"><div class="battle-team">${["Ash Wolf","Hollow Pilgrim","Ash Wolf"].map(n=>unit(n,true)).join("")}</div><div class="telegraph"><span>${icon("eye")} Enemy action / telegraph area</span></div><div><div class="battle-team">${state.formation.slice(0,2).map(id=>unit(character(id).name,false,character(id).element)).join("")}</div><div class="battle-team">${state.formation.slice(2).map(id=>unit(character(id).name,false,character(id).element)).join("")}</div></div></div><div class="battle-log"><span class="small-label">TURN & EVENT LOG</span><p>Actions, damage, status and Focus appear here. This screen does not run a simulation.</p></div><div class="button-row">${btn("Victory Preview","victory","cta")}${btn("Defeat","defeat","cta secondary")}</div></div>`;
}
function vn() {
  const line=SOURCE_DATA.dialogue[state.vn];
  return `<div class="page">${header("Story","OPENING · SOURCE DIALOGUE SAMPLE","journey")}<div class="vn-art"><span class="pill vn-counter">${state.vn+1} / ${SOURCE_DATA.dialogue.length}</span></div><div class="dialogue"><h2>${escapeText(line.speaker_display)}</h2><p>${escapeText(line.text_en)}</p></div><div class="vn-controls">${btn("Previous","vn-prev")}${btn("Log","vn-log")}${btn("Next","vn-next")}</div><p class="quiet">Dialogue comes from the English source. Artwork is representative; no new story or translation is added.</p></div>`;
}
function settings() {
  return `<div class="page">${header("Profile & Settings","TRAVELER · ACCOUNT LV 7")}<div class="card"><div class="card-row"><span class="avatar"></span><div class="card-text"><h3>Traveler</h3><p>Player identity and connection status</p></div><span class="pill">Sample account</span></div></div>${section("Audio")} ${[["Music",60],["Sound Effects",80],["Voice · Japanese",100]].map(([t,v])=>`<label class="setting-row"><span>${t}</span><input type="range" min="0" max="100" value="${v}" aria-label="${t}"></label>`).join("")}${section("Display & Accessibility")}<div class="setting-row"><span>Reduce motion</span><button class="switch" role="switch" aria-label="Reduce motion" aria-checked="${state.motion}" data-action="motion"></button></div><label class="setting-row"><span>Text size</span><select data-setting="text" aria-label="Text size"><option value="normal" ${state.textSize==="normal"?"selected":""}>Standard</option><option value="large" ${state.textSize==="large"?"selected":""}>Large</option></select></label><div class="setting-row"><span>Text & subtitles</span><span class="quiet">English</span></div>${section("Account")}<div class="button-row">${btn("Connection Info","connection")}${btn("Audiosion / Sign-in","login")}</div><p class="notice">This wireframe does not play audio. Music and Japanese voice will be connected during implementation.</p></div>`;
}
function title() {
  return `<div class="title-page"><div class="title-shade"></div><div class="title-content"><span class="eyebrow">A DARK FANTASY JOURNEY</span><h1>UNAWARE<span>OF MY DEMISE</span></h1><p>The road is not over. Not yet.</p><button class="cta" data-action="login">Continue with Google ${icon("arrow")}</button><button class="compact-button" data-page="home">Open Sanctuary Wireframe</button><span class="quiet">Sign-in wireframe · No account connection</span></div></div>`;
}
function selector() {
  const list=SOURCE_DATA.characters.filter(c=>c.rarity===4);
  return `<div class="page">${header("First Oath","CHOOSE ONE PERMANENT 4★ COMPMEMORYON","heroes")}<p class="notice">Invitation selection wireframe. It does not add a character to the sample collection.</p><div class="hero-grid">${list.map(c=>heroCard(c,false,"select-oath")).join("")}</div></div>`;
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
  $("#overlay").innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><button class="close" data-action="close" aria-label="Close">${icon("close")}</button><span class="eyebrow">UNAWARE OF MY DEMISE</span><h2 id="sheet-title">${title}</h2>${body}${footer}</section>`;
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
      const r={crowns:["Crowns","Currency for equipment and progression. Sample balance: 12,840."],eclipse:["Eclipse Tokens","Premium currency. Sample balance: 420. No store or purchases are active in this wireframe."],thread:["Fate’s Threads",`Threads used for summons. Sample balance: ${state.threads}. Each summon costs 1 Thread.`],ration:["Ration",`Sample balance ${state.ration}/100. Regenerates 1 every 5 minutes, up to 100. Inn grants may exceed the cap. Standard battles spend it only on a confirmed victory.`]}[id];
      sheet(r[0],`<p>${r[1]}</p>`,id==="thread"?pageButton("Go to Summon","summon","cta"):"");break;
    }
    case "inn": sheet("Inn Meal",`<p>Today’s warm meal: <strong>+30 Ration.</strong></p><p>Once per UTC day. The inn grant may exceed the regeneration cap.</p><div class="card"><h3>${state.ration} → ${state.meal?state.ration:state.ration+30}</h3><p>Ration · sample player state</p></div>`,btn(state.meal?"Claimed Today":"Claim Meal","meal","cta",state.meal?"disabled":""));break;
    case "meal": if(!state.meal){state.meal=true;state.ration+=30;closeSheet();render();toast("Sample balance updated: +30 Ration");}break;
    case "chapter": state.chapter=Number(id);render();$("#app").scrollTop=0;break;
    case "stage": {
      const n=SOURCE_DATA.chapters.flatMap(c=>c.nodes).find(x=>x.id===id);
      if(!id.startsWith("1-")){sheet("The road is not yet open","<p>This chapter is locked in the sample progression. Unlock conditions will use actual player progress.</p>");break;}
      if(id!=="1-1")state.stage=id;
      sheet(`${n.id} · ${escapeText(n.title)}`,`<div class="stats"><div class="stat"><strong>${n.level}</strong><span>RECOMMENDED LV</span></div><div class="stat"><strong>${n.cost}</strong><span>RATION</span></div></div><p>${n.id==="1-1"?"A free guided tutorial with two starting companions. The standard five-member formation does not apply to this stage.":"Prepare your team, then continue your journey. Defeat does not spend Ration."}</p><p class="quiet">Enemy and reward cards will use the stage and drop table records.</p>`,n.id==="1-1"?btn("View Tutorial Layout","tutorial","cta"):`<div class="button-row">${pageButton("Story Wireframe","vn","compact-button")}${pageButton("Prepare Team","formation","cta")}</div>`);break;
    }
    case "tutorial": sheet("1-1 · Guided Tutorial",`<p>Mahmut and Fadyme · 0 Ration · Introduction to Basic Attack, targets and visible turn order.</p><div class="hero-grid">${["mahmut","fadyme"].map(id=>heroCard(character(id))).join("")}</div>`);break;
    case "hero":state.hero=id;go("hero");break;
    case "roster-filter":state.rosterFilter=id;render();break;
    case "skill":{const c=character(state.hero),s=c.skills.find(x=>x.id===id);sheet(escapeText(s.name),`<span class="pill">${s.type.toUpperCase()}</span><p>${escapeText(s.description)}</p><p class="quiet">${escapeText(s.id)} · current source definition</p>`);break;}
    case "memories":{const s=SOURCE_DATA.companions.find(x=>x.id===id);sheet(`${escapeText(s.name)} · Memories`,s.parts.map((p,i)=>`<div class="card"><span class="small-label">MEMORY ${i+1} · LOCKED</span><h3>Sealed record</h3><p>${escapeText(p.unlock.after_stage)} cleared${p.unlock.requires_owned_character?" · character ownership required":""}</p></div>`).join(""));break;}
    case "upgrade":sheet("Progression", "<p>Before and after stats, costs and equipment effects share one confirmation card. Progression is not performed in this wireframe.</p>");break;
    case "acquire":sheet("Obtain a Companion", "<p>The character source determines how to obtain them: story, First Oath or an eligible summon pool.</p>",pageButton("First Oath Wireframe","selector","cta"));break;
    case "select-oath":sheet(`${escapeText(character(id).name)} · First Oath`,"<p>One permanent 4★ choice. Review skills and team role before confirming. The sample collection is not changed.</p>",btn("View Selection Confirmation","oath-confirm","cta"));break;
    case "oath-confirm":closeSheet();toast("First Oath confirmation reviewed. No actual choice was made.");break;
    case "item": {const i=[...SOURCE_DATA.weapons,...SOURCE_DATA.armor].find(x=>x.id===id);sheet(escapeText(i.name),`<span class="pill">${i.rarity}★ · LV 1</span><p>${escapeText(i.description)}</p><p class="quiet">${escapeText(i.id)}</p>`,btn("View Equipment Flow","equip","cta"));break;}
    case "equip":sheet("Equipment Comparison","<p>Compare equipped and selected items, stat changes, eligible slots and companions. Upgrade costs and dismantling require separate confirmation.</p>",pageButton("Open Companions","heroes","cta"));break;
    case "banner":state.banner=id;render();break;
    case "archive-tab":state.archiveTab=id;render();break;
    case "rates": {
      const b=SOURCE_DATA.banners[state.banner], standard=state.banner==="standard_character",weapon=state.banner==="weapon";
      sheet("Rates & Guarantees",`<p>5★ base rate: <strong>${((b.base_five_star_rate||b.five_star_base_rate)*100).toLocaleString("en")}%</strong>. 4★: ${(b.four_star_rate*100).toLocaleString("en",{maximumFractionDigits:4})}%; 3★: ${(b.three_star_rate*100).toLocaleString("en",{maximumFractionDigits:4})}%.</p><p>5★ hard pity: <strong>${b.hard_pity}</strong>. At least one 4★ or higher every 10 summons.</p>${standard?"<p>Permanent pool: Mahmut and Fadyme. Limited characters are excluded. No soft pity; the counter is separate.</p>":weapon?"<p>No soft pity. An unprotected 5★ has a 55% target chance. After two Fate Knots, the next 5★ is the target. A target must be selected.</p>":"<p>Soft pity starts at summon 65 and increases by 6 percentage points per summon. A 5★ has a 55% limited target chance; losing guarantees the next 5★ target. Pity and guarantee carry to the next limited banner.</p>"}<p class="quiet">Source: economy_part1.json. This wireframe does not perform random draws.</p>`);break;
    }
    case "pull":{
      const count=Number(id);
      if(state.banner!=="standard_character"){sheet("Banner Wireframe","<p>Target selection and artwork remain pending. Review the result wireframe from the Ancestors tab.</p>");break;}
      if(count>state.threads){sheet("Not Enough Threads",`<p>${count} Threads required, sample balance ${state.threads}. No purchases or currency conversion are performed in this wireframe.</p>`);break;}
      sheet("Confirm Summon",`<p>${count} summons for <strong>${count} Fate’s Threads</strong>.</p><p>This is a fixed result layout demo. It does not draw by the rates or spend real currency.</p><div class="card"><h3>${state.threads} → ${state.threads-count} Threads</h3><p>Only the sample balance in this tab changes.</p></div>`,btn("View Result Layout","pull-demo","cta",`data-id="${count}"`));break;
    }
    case "pull-demo":{const count=Number(id);if(state.threads<count)break;state.threads-=count;state.history.unshift(`${count} summons · Fixed result demo`);render();sheet("Summon Result",`<p class="quiet">Fixed visual sample, not a rarity distribution or random reward.</p><div class="hero-grid">${heroCard(character("fadyme"))}</div><div class="card"><h3>Fadyme · Already owned</h3><p>Actual duplicate conversion amounts will come from the result API.</p></div>`,btn("Return to Sanctuary","return-home","cta"));break;}
    case "history":sheet("Summon History",state.history.length?state.history.map(x=>`<div class="card"><h3>${x}</h3><p>Sample record kept in this tab.</p></div>`).join(""):"<p>No summon preview has been made in this wireframe yet.</p>");break;
    case "return-home":go("home");break;
    case "codex":{const i=SOURCE_DATA.codex.findIndex(c=>c.codex_id===id),c=SOURCE_DATA.codex[i];sheet(i<2?escapeText(c.title_en):"Undiscovered",i<2?`<p>${escapeText(c.text_en)}</p>`:"<p>Locked record titles and content stay hidden to protect spoilers. Unlock conditions must be reconciled with the Narrative sources.</p>");break;}
    case "event":sheet("Event Record","<p>Story progression and the event schedule are checked together. No countdown or participation button is shown before the schedule is connected.</p>");break;
    case "claim-quest":state.claimed=true;render();toast("The sample quest is marked claimed. No actual reward was granted.");break;
    case "formation-slot":if(!selectedSlot){selectedSlot=id;button.classList.add("selected-slot");toast("Choose the slot to swap with.");}else{const a=state.formation.indexOf(selectedSlot),b=state.formation.indexOf(id);[state.formation[a],state.formation[b]]=[state.formation[b],state.formation[a]];selectedSlot=null;render();toast("Sample formation updated.");}break;
    case "policy":sheet("Battle Policy",`<label class="setting-row">Target<select><option>Default</option><option>Lowest HP</option><option>Front row</option></select></label><label class="setting-row">Ultimate<select><option>When ready</option><option>Save for boss</option></select></label><p class="quiet">These are UI proposals; final policy enums must match BattlePlayback.</p>`,btn("Close Wireframe","close","cta"));break;
    case "speed":button.textContent=button.textContent==="1×"?"2×":"1×";toast("Speed control layout · No battle simulation.");break;
    case "auto":button.classList.toggle("active");toast("Auto control layout · No battle simulation.");break;
    case "victory":sheet("The Road Opens",`<span class="pill">VICTORY</span><p>Stage ${state.stage} · Rewards are granted only after the server confirms the result.</p><div class="card"><h3>Rewards / progression area</h3><p>Crowns, XP, drops and first-clear rewards appear separately. This preview grants no rewards.</p></div>`,pageButton("View Story Layout","vn","cta"));break;
    case "defeat":sheet("The Road Is Not Over",'<span class="pill">DEFEAT</span><p>No Ration was spent. Adjust your formation or return to the Sanctuary.</p>',`<div class="button-row">${pageButton("Adjust Team","formation","cta")}${pageButton("Retreat","home","cta secondary")}</div>`);break;
    case "vn-next":state.vn=(state.vn+1)%SOURCE_DATA.dialogue.length;render();break;
    case "vn-prev":state.vn=Math.max(0,state.vn-1);render();break;
    case "vn-log":sheet("Dialogue Log",SOURCE_DATA.dialogue.slice(0,state.vn+1).map(l=>`<div class="card"><h3>${escapeText(l.speaker_display)}</h3><p>${escapeText(l.text_en)}</p></div>`).join(""));break;
    case "motion":state.motion=!state.motion;document.body.classList.toggle("motion-off",state.motion);button.setAttribute("aria-checked",String(state.motion));break;
    case "connection":sheet("Connection Status","<p>The game will show connection, synchronization and account status. This wireframe makes no game API calls.</p>");break;
    case "login":sheet("Sign-in Flow",`<p>Google identity → server session → verified game files → player state → Sanctuary. Loading, cancellation and retry are separate states.</p><p class="quiet">This wireframe performs no sign-in or sign-out.</p>`,pageButton("View Sign-in Screen","title","cta"));break;
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
