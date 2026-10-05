"use strict";
// Local review states. No Google, account, game API, token, or network operation.
const $=s=>document.querySelector(s);
const vectors={sound:'<path d="M4 9h4l5-4v14l-5-4H4V9ZM16 8a6 6 0 0 1 0 8m2-11a10 10 0 0 1 0 14"/>',mute:'<path d="M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m-5 0 5-6"/>',bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 4h4M12 2v2"/>',offline:'<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0M12 21h.01M2 2l20 20"/>',update:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',check:'<path d="m4 12 5 5L20 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${vectors[name]}</svg>`;
const google='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.76 7.18l7.73 6C44.42 38.08 46.98 31.89 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.7 23.7 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.96-2.13 15.94-5.8l-7.73-6c-2.15 1.45-4.91 2.3-8.21 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>';
let scenario=new URLSearchParams(location.search).get('scenario')||'first';
if(![...$('#scenario').options].some(o=>o.value===scenario))scenario='first';
$('#scenario').value=scenario;
let phase='idle',sound=false,epoch=0,focusBeforeModal=null,contentReady=false;
const panel=$('#entry-panel');
function fitArtwork(){
 const device=$('.device');
 const reserved=device.getBoundingClientRect().bottom-panel.getBoundingClientRect().top+10;
 device.style.setProperty('--entry-space',`${Math.ceil(reserved)}px`);
}
new ResizeObserver(fitArtwork).observe(panel);
window.addEventListener('resize',fitArtwork);
function idle(){
 phase='idle';
 panel.innerHTML=scenario==='returning'?'<p class="tagline">Yol seni bekliyor.</p><button class="primary" data-action="start">Devam Et</button><p class="subtext">Yolculuğuna aynı hesapla devam et.</p>':`<p class="tagline">Yol bitmedi. Henüz.</p><button class="google-button" data-action="start">${google}Google ile Devam Et</button><p class="subtext">Yolculuğun Google hesabınla eşleşir.</p>`;
}
function pending(text){
 phase='pending';panel.innerHTML=`<div class="status-card"><div class="pending"><span class="spinner" aria-hidden="true"></span><span>${text}</span></div><div class="progress" aria-label="Yükleniyor"></div><button class="cancel-button" data-action="cancel">Geri dön</button></div>`;
}
function card(title,text,mark,buttons){
 phase='result';panel.innerHTML=`<div class="status-card"><span class="status-mark">${icon(mark)}</span><h2>${title}</h2><p>${text}</p>${buttons}</div>`;
}
const primary=(text,action)=>`<button class="primary" data-action="${action}">${text}</button>`;
const again=()=>primary('Yeniden Dene','start');
function failure(kind){
 const outcomes={
  offline:['Bağlantı kurulamadı','İnternet bağlantını kontrol edip yeniden dene.','offline',again()],
  cancelled:['Giriş tamamlanmadı','Hazır olduğunda hesabını seçerek devam edebilirsin.','bell',primary('Girişe Dön','reset')],
  no_account:['Bir hesap gerekiyor','Cihazına Google hesabı ekledikten sonra yeniden dene.','lock',again()],
  unavailable:['Giriş kullanılamıyor','Bu cihazda giriş şu anda kullanılamıyor. Daha sonra yeniden dene.','lock',again()],
  maintenance:['Kısa bir mola','Yollar bakım nedeniyle kapalı. Biraz sonra yeniden buluşalım.','bell',again()],
  update:['Yeni sürüm hazır','Yolculuğuna devam etmek için oyunu güncelle.','update',primary('Uygulamayı Güncelle','update-link')],
  sync_error:['Yolculuğun yüklenemedi','Hesap bilgileri alınamadı. Yeniden bağlanmayı deneyebilirsin.','offline',again()],
 };
 const row=outcomes[kind];card(...row);
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(){
 if(phase==='pending')return;
 const ticket=++epoch;
 pending('Yollar kontrol ediliyor…');await delay(700);if(ticket!==epoch)return;
 if(['offline','maintenance','update'].includes(scenario)){failure(scenario);return;}
 if(scenario==='content'&&!contentReady){card('Yol hazırlanıyor','Devam etmeden önce oyun verilerini güncelle.','update',primary('Verileri Güncelle','content-update'));return;}
 pending(scenario==='returning'?'Yeniden hoş geldin…':'Hesabınla buluşuyoruz…');await delay(700);if(ticket!==epoch)return;
 if(['cancelled','no_account','unavailable'].includes(scenario)){failure(scenario);return;}
 pending('Yolculuğun yükleniyor…');await delay(700);if(ticket!==epoch)return;
 if(scenario==='sync_error'){failure(scenario);return;}
 card(scenario==='returning'?'Yol seni bekliyor':'Yolculuğun hazır','Sığınağın kapısı açık.','check',primary('Devam Et','continue'));
}
async function updateContent(){
 if(phase==='pending')return;
 const ticket=++epoch;pending('Oyun verileri hazırlanıyor…');await delay(900);if(ticket!==epoch)return;
 contentReady=true;card('Yol hazır','Güncelleme tamamlandı. Yolculuğuna devam edebilirsin.','check',primary('Girişe Dön','reset'));
}
function reset(clearContent=false){epoch++;if(clearContent)contentReady=false;idle();}
function modal(title,text){
 focusBeforeModal=document.activeElement;
 $('#modal').innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="close" data-action="close" aria-label="Kapat">${icon('close')}</button><span class="label">UNAWARE OF MY DEMISE</span><h2 id="modal-title">${title}</h2><p>${text}</p>${primary('Tamam','close')}</section>`;
 $('#modal').hidden=false;panel.inert=true;$('.top-controls').inert=true;$('footer').inert=true;$('.design-panel').inert=true;$('.close').focus();
}
function closeModal(){
 $('#modal').hidden=true;panel.inert=false;$('.top-controls').inert=false;$('footer').inert=false;$('.design-panel').inert=false;
 if(focusBeforeModal?.isConnected)focusBeforeModal.focus();
}
function soundIcon(){
 $('#sound').innerHTML=icon(sound?'sound':'mute');$('#sound').setAttribute('aria-label',sound?'Ses açık':'Ses kapalı');$('#sound').setAttribute('aria-pressed',String(sound));
}
$('#sound').addEventListener('click',()=>{sound=!sound;soundIcon();});
$('#scenario').addEventListener('change',event=>{scenario=event.target.value;reset(true);});
$('#reset').addEventListener('click',()=>reset(true));
$('#privacy').addEventListener('click',()=>modal('Gizlilik','Yayın sürümünde bu bölüm oyunun gerçek gizlilik politikasını açacak. Bu taslak hesabına bağlanmaz ve kişisel veri toplamaz.'));
$('#help').addEventListener('click',()=>modal('Yolculuğa giriş','Google hesabın ve internet bağlantınla devam et. Giriş sırasında hesabını seçmekten vazgeçersen yeniden deneyebilirsin.'));
document.addEventListener('click',event=>{
 if(event.target===$('#modal')){closeModal();return;}
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
 switch(button.dataset.action){
  case 'start':start();break;
  case 'cancel':reset();break;
  case 'reset':reset();break;
  case 'continue':location.href='../prototype/index.html#home';break;
  case 'content-update':updateContent();break;
  case 'update-link':modal('Güncelleme','Yayın sürümünde doğrulanmış mağaza bağlantısı açılır. Bu taslakta mağazaya veya dış uygulamaya yönlendirme yapılmaz.');break;
  case 'close':closeModal();break;
 }
});
document.addEventListener('keydown',event=>{
 if($('#modal').hidden)return;
 if(event.key==='Escape'){closeModal();return;}
 if(event.key==='Tab'){
  const nodes=[...$('.sheet').querySelectorAll('button')];
  if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}
 }
});
window.addEventListener('pagehide',()=>epoch++);
idle();soundIcon();
