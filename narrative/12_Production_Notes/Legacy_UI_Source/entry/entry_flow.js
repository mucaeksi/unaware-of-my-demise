"use strict";
// Design simulation only. No OAuth, player API, patch transport or audio calls.
const $=selector=>document.querySelector(selector);
const copy=window.EntryCopy;
const vectors={
 sound:'<path d="M4 9h4l5-4v14l-5-4H4V9ZM16 8a6 6 0 0 1 0 8m2-11a10 10 0 0 1 0 14"/>',
 mute:'<path d="M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m-5 0 5-6"/>',
 bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 4h4M12 2v2"/>',
 offline:'<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0M12 21h.01M2 2l20 20"/>',
 update:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
 check:'<path d="m4 12 5 5L20 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
 settings:'<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 signout:'<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',back:'<path d="m14 5-7 7 7 7M7 12h14"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${vectors[name]}</svg>`;
const google='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.76 7.18l7.73 6C44.42 38.08 46.98 31.89 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.7 23.7 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.96-2.13 15.94-5.8l-7.73-6c-2.15 1.45-4.91 2.3-8.21 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>';
const primary=(label,action,style='primary')=>`<button class="${style}" data-action="${action}">${label}</button>`;
const defaults={music:60,voice:100,sfx:80,textSize:'standard',reduceMotion:false,muted:true};
const preferenceKey='uomd.entry.design.preferences.v1';
function loadPreferences(){
 let saved={};try{saved=JSON.parse(localStorage.getItem(preferenceKey))||{};}catch{}
 const result={...defaults};
 for(const id of ['music','voice','sfx'])if(typeof saved[id]==='number'&&Number.isFinite(saved[id]))result[id]=Math.min(100,Math.max(0,saved[id]));
 if(['standard','large'].includes(saved.textSize))result.textSize=saved.textSize;
 for(const id of ['reduceMotion','muted'])if(typeof saved[id]==='boolean')result[id]=saved[id];
 return result;
}
const preferences=loadPreferences();
function savePreferences(){
 try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}
 $('.device').classList.toggle('large-text',preferences.textSize==='large');
 $('.device').classList.toggle('motion-off',preferences.reduceMotion);
 fitArtwork();
}
let scenario=new URLSearchParams(location.search).get('scenario')||'first';
if(![...$('#scenario').options].some(option=>option.value===scenario))scenario='first';
$('#scenario').value=scenario;
const state={authenticated:false,page:'sign-in',basePage:'sign-in',authPhase:'idle',signInStatus:null,patch:'idle',menuOpen:false,epoch:0,downloadFailed:false,verifyFailed:false,syncFailed:false};
const screenNames={'sign-in':['SignInScreen','ui.sign_in'],patch:['PatchScreen','ui.patch'],settings:['EntrySettingsScreen','ui.entry_settings'],help:['EntryHelpScreen','ui.entry_help']};
const panel=$('#entry-panel');
const context=()=>({copy,google,returning:scenario==='returning',status:state.signInStatus,patch:state.patch,preferences,authenticated:state.authenticated,primary,icon});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transferActive=()=>['downloading','verifying','installing'].includes(state.patch);
function fitArtwork(){
 if(panel.hidden)return;
 const reserve=$('.device').getBoundingClientRect().bottom-panel.getBoundingClientRect().top+10;
 $('.device').style.setProperty('--entry-space',`${Math.ceil(reserve)}px`);
}
new ResizeObserver(fitArtwork).observe(panel);
window.addEventListener('resize',fitArtwork);
function renderTop(){
 const utility=['settings','help'].includes(state.page);
 $('#top-controls').innerHTML=`${utility?`<button class="icon-button" data-action="back" aria-label="${copy.UI_BACK}">${icon('back')}</button><h1 class="utility-title">${copy[state.page==='settings'?'UI_SETTINGS':'UI_HELP']}</h1>`:`<span class="chapter-label">${state.authenticated?copy.UI_SIGNED_IN:'PART I · UNAWARE, I FADE'}</span><button class="icon-button" data-action="sound" aria-label="${copy[preferences.muted?'UI_UNMUTE_AUDIO':'UI_MUTE_AUDIO']}" aria-pressed="${preferences.muted}">${icon(preferences.muted?'mute':'sound')}</button>`}<div class="utility-actions"><button class="icon-button" data-page="settings" aria-label="${copy.UI_SETTINGS}">${icon('settings')}</button><button class="icon-button" id="menu-toggle" data-action="menu" aria-label="${copy.UI_ACCOUNT_MENU}" aria-expanded="${state.menuOpen}">${icon('more')}</button></div>${state.menuOpen?EntryViews.EntryUtilityMenu(context()):''}`;
}
function render(){
 const utility=['settings','help'].includes(state.page);
 $('.device').classList.toggle('utility-visible',utility);
 panel.hidden=utility;$('#utility-page').hidden=!utility;
 const [name,id]=screenNames[state.page];
 $('.device').dataset.screenId=id;$('.device').dataset.screenName=name;
 $('#screen-name').textContent=name;$('#screen-id').textContent=id;
 renderTop();
 if(utility){
  $('#utility-page').innerHTML=EntryViews[name](context());
  $('#utility-page').dataset.screenId=id;
 }else if(state.page==='patch')panel.innerHTML=EntryViews.PatchScreen(context());
 else if(state.authPhase!=='idle')panel.innerHTML=`<div class="status-card"><div class="pending"><span class="spinner" aria-hidden="true"></span><span>${copy[state.authPhase==='checking'?'UI_CHECKING_SERVICE':'UI_SIGNING_IN']}</span></div><div class="progress" role="progressbar" aria-label="${copy.UI_SIGNING_IN}"></div>${primary(copy.UI_SIGN_IN_CANCEL,'cancel-sign-in','cancel-button')}</div>`;
 else panel.innerHTML=EntryViews.SignInScreen(context());
 savePreferences();
}
function navigate(page,{focus=false}={}){
 if(!screenNames[page])page=state.basePage;
 if(page==='patch'&&!state.authenticated)page='sign-in';
 if(page==='sign-in'&&state.authenticated)page='patch';
 state.menuOpen=false;state.page=page;
 if(location.hash!==`#${page}`)location.hash=page;
 render();$('#utility-page').scrollTop=0;
 if(focus)$('#top-controls [data-action=back]')?.focus();
}
function setPatch(patch){
 state.patch=patch;
 if(state.page==='patch')render();
}
function signInFailure(kind){
 const rows={
  offline:['UI_OFFLINE_TITLE','UI_OFFLINE_DESCRIPTION','offline','UI_RETRY','sign-in'],
  cancelled:['UI_CANCELLED_TITLE','UI_CANCELLED_DESCRIPTION','bell','UI_SIGN_IN_CANCEL','reset-sign-in'],
  no_account:['UI_NO_ACCOUNT_TITLE','UI_NO_ACCOUNT_DESCRIPTION','lock','UI_RETRY','sign-in'],
  unavailable:['UI_UNAVAILABLE_TITLE','UI_UNAVAILABLE_DESCRIPTION','lock','UI_RETRY','sign-in'],
  maintenance:['UI_MAINTENANCE_TITLE','UI_MAINTENANCE_DESCRIPTION','bell','UI_RETRY','sign-in'],
  update:['UI_APP_UPDATE_TITLE','UI_APP_UPDATE_DESCRIPTION','update','UI_APP_UPDATE_ACTION','update-app']
 };
 const [title,body,mark,action,actionId]=rows[kind];
 state.authPhase='idle';state.signInStatus={title,body,icon:mark,action,actionId};
 if(state.page==='sign-in')render();
}
async function signIn(){
 if(state.authPhase!=='idle'||state.authenticated)return;
 const ticket=++state.epoch;state.signInStatus=null;state.authPhase='checking';render();
 await delay(500);if(ticket!==state.epoch)return;
 if(['offline','maintenance','update'].includes(scenario)){signInFailure(scenario);return;}
 state.authPhase='signing_in';if(state.page==='sign-in')render();
 await delay(600);if(ticket!==state.epoch)return;
 if(['cancelled','no_account','unavailable'].includes(scenario)){signInFailure(scenario);return;}
 state.authenticated=true;state.authPhase='idle';state.basePage='patch';state.patch='checking';
 if(state.page==='sign-in')navigate('patch');else render();
 await delay(600);if(ticket!==state.epoch)return;
 if(['content','patch_error','verify_error','restart'].includes(scenario)){setPatch('available');return;}
 await syncJourney(ticket);
}
async function syncJourney(ticket=++state.epoch){
 if(!state.authenticated)return;
 setPatch('syncing');await delay(700);if(ticket!==state.epoch)return;
 if(scenario==='sync_error'&&!state.syncFailed){state.syncFailed=true;setPatch('sync_error');return;}
 setPatch('ready');
}
async function download(){
 if(!state.authenticated||!['available','download_error','verify_error'].includes(state.patch))return;
 const ticket=++state.epoch;setPatch('downloading');
 await delay(1300);if(ticket!==state.epoch)return;
 if(scenario==='patch_error'&&!state.downloadFailed){state.downloadFailed=true;setPatch('download_error');return;}
 setPatch('verifying');await delay(900);if(ticket!==state.epoch)return;
 if(scenario==='verify_error'&&!state.verifyFailed){state.verifyFailed=true;setPatch('verify_error');return;}
 setPatch('installing');await delay(600);if(ticket!==state.epoch)return;
 if(scenario==='restart'){setPatch('restart');return;}
 await syncJourney(ticket);
}
let focusBeforeModal=null;
function openModal(html){
 focusBeforeModal=document.activeElement;closeMenu();
 $('#modal').innerHTML=html;$('#modal').hidden=false;
 for(const selector of ['#entry-panel','#utility-page','#top-controls','footer','.design-panel'])$(selector).inert=true;
 $('#modal button').focus();
}
function message(title,body){
 openModal(`<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${title}</h2><p>${body}</p>${primary(copy.UI_CLOSE,'close')}</section>`);
}
function closeModal(){
 $('#modal').hidden=true;
 for(const selector of ['#entry-panel','#utility-page','#top-controls','footer','.design-panel'])$(selector).inert=false;
 if(focusBeforeModal?.isConnected)focusBeforeModal.focus();
 else $('#menu-toggle')?.focus();
}
function closeMenu(restoreFocus=false){
 if(!state.menuOpen)return;
 state.menuOpen=false;renderTop();if(restoreFocus)$('#menu-toggle').focus();
}
async function signOut(){
 if(!state.authenticated)return;
 state.epoch++;closeModal();state.authenticated=false;state.basePage='sign-in';state.authPhase='idle';state.signInStatus=null;state.patch='idle';state.menuOpen=false;
 navigate('sign-in');
}
function resetFlow(){
 state.epoch++;closeModal();state.authenticated=false;state.basePage='sign-in';state.authPhase='idle';state.signInStatus=null;state.patch='idle';state.downloadFailed=false;state.verifyFailed=false;state.syncFailed=false;
 navigate('sign-in');
}
$('#scenario').addEventListener('change',event=>{scenario=event.target.value;resetFlow();});
$('#reset').addEventListener('click',resetFlow);
$('#privacy').addEventListener('click',()=>message(copy.UI_PRIVACY,copy.UI_PRIVACY_UNAVAILABLE));
$('#help').addEventListener('click',()=>navigate('help',{focus:true}));
document.addEventListener('click',event=>{
 if(event.target===$('#modal')){closeModal();return;}
 const button=event.target.closest('[data-action],[data-page]');
 if(state.menuOpen&&!event.target.closest('.utility-popover')&&!event.target.closest('#menu-toggle'))closeMenu();
 if(!button||button.disabled)return;
 if(button.dataset.page){navigate(button.dataset.page,{focus:true});return;}
 switch(button.dataset.action){
  case 'sign-in':signIn();break;
  case 'cancel-sign-in':state.epoch++;state.authPhase='idle';state.signInStatus=null;render();break;
  case 'reset-sign-in':state.signInStatus=null;render();break;
  case 'download':download();break;
  case 'sync':if(state.patch==='sync_error')syncJourney();break;
  case 'enter-game':if(state.authenticated&&state.patch==='ready')location.href='../prototype/index.html#home';break;
  case 'close-game':resetFlow();break; // Review reset only; Godot target is SceneTree.quit().
  case 'sound':preferences.muted=!preferences.muted;savePreferences();renderTop();break;
  case 'menu':state.menuOpen=!state.menuOpen;renderTop();if(state.menuOpen)$('.utility-popover button').focus();else $('#menu-toggle').focus();break;
  case 'back':navigate(state.basePage);$('#menu-toggle').focus();break;
  case 'sign-out':if(state.authenticated)openModal(EntryViews.SignOutConfirmDialog({...context(),downloading:transferActive()}));break;
  case 'confirm-sign-out':signOut();break;
  case 'reduce-motion':preferences.reduceMotion=!preferences.reduceMotion;savePreferences();button.setAttribute('aria-checked',String(preferences.reduceMotion));break;
  case 'privacy':message(copy.UI_PRIVACY,copy.UI_PRIVACY_UNAVAILABLE);break;
  case 'update-app':message(copy.UI_APP_UPDATE_TITLE,copy.UI_STORE_UNAVAILABLE);break;
  case 'close':closeModal();break;
 }
});
document.addEventListener('input',event=>{
 const id=event.target.dataset.volume;if(!['music','voice','sfx'].includes(id))return;
 preferences[id]=Number(event.target.value);$(`#volume-${id}`).textContent=`${preferences[id]}%`;savePreferences();
});
document.addEventListener('change',event=>{
 if(event.target.id==='text-size'){preferences.textSize=event.target.value;savePreferences();}
});
document.addEventListener('keydown',event=>{
 if($('#modal').hidden){if(event.key==='Escape'){if(state.menuOpen)closeMenu(true);else if(['settings','help'].includes(state.page))navigate(state.basePage);}return;}
 if(event.key==='Escape'){closeModal();return;}
 if(event.key==='Tab'){
  const nodes=[...$('#modal').querySelectorAll('button:not([disabled]),a,input,select')];
  if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}
 }
});
window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(target!==state.page)navigate(target);});
window.addEventListener('pagehide',()=>state.epoch++);
// Only the explicit review URL may seed a signed-in sample; a #patch deep link alone cannot bypass sign-in.
if(new URLSearchParams(location.search).get('preview')==='patch'){
 state.authenticated=true;state.basePage='patch';state.patch='available';
}
navigate(location.hash.slice(1)||state.basePage);
