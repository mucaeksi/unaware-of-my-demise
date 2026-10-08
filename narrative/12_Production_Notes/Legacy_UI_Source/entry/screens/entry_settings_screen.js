"use strict";
window.EntryViews = window.EntryViews || {};
EntryViews.EntrySettingsScreen = ({copy, preferences, authenticated, primary}) => `
 <p class="page-intro">${copy.UI_SETTINGS_NOTE}</p>
 <section class="settings-section"><h2>${copy.UI_AUDIO}</h2>
 ${[['music','UI_MUSIC'],['voice','UI_VOICE'],['sfx','UI_SFX']].map(([id,key])=>`<label class="setting-block"><span>${copy[key]}<output id="volume-${id}">${preferences[id]}%</output></span><input type="range" min="0" max="100" value="${preferences[id]}" data-volume="${id}" aria-label="${copy[key]}"></label>`).join('')}
 </section>
 <section class="settings-section"><h2>${copy.UI_DISPLAY}</h2>
 <label class="setting-row"><span>${copy.UI_TEXT_SIZE}</span><select id="text-size" aria-label="${copy.UI_TEXT_SIZE}"><option value="standard" ${preferences.textSize==='standard'?'selected':''}>${copy.UI_STANDARD}</option><option value="large" ${preferences.textSize==='large'?'selected':''}>${copy.UI_LARGE}</option></select></label>
 <div class="setting-row"><span>${copy.UI_REDUCE_MOTION}</span><button class="switch" role="switch" data-action="reduce-motion" aria-label="${copy.UI_REDUCE_MOTION}" aria-checked="${preferences.reduceMotion}"></button></div>
 </section>
 <section class="settings-section"><h2>${copy.UI_LANGUAGE}</h2><div class="setting-row"><span>${copy.UI_TEXT_LANGUAGE}</span><strong>${copy.UI_ENGLISH}</strong></div><div class="setting-row"><span>${copy.UI_VOICE_LANGUAGE}</span><strong>${copy.UI_JAPANESE}</strong></div></section>
 <section class="settings-section"><h2>${copy.UI_ACCOUNT}</h2><p class="account-state">${copy[authenticated?'UI_SIGNED_IN':'UI_SIGNED_OUT']}</p>${authenticated?primary(copy.UI_SIGN_OUT,'sign-out','secondary'):''}</section>`;
