"use strict";
window.EntryViews = window.EntryViews || {};
EntryViews.EntryHelpScreen = ({copy}) => `
 <p class="page-intro">${copy.UI_HELP_SUBTITLE}</p>
 ${['SIGN_IN','UPDATE','DOWNLOAD','SIGN_OUT'].map(id=>`<section class="help-card"><h2>${copy['UI_HELP_'+id+'_TITLE']}</h2><p>${copy['UI_HELP_'+id+'_BODY']}</p></section>`).join('')}
 <section class="help-card"><h2>${copy.UI_CONTACT_SUPPORT}</h2><p><a href="mailto:unawareofmydemise@gmail.com">unawareofmydemise@gmail.com</a></p></section>
 <button class="secondary" data-action="privacy">${copy.UI_PRIVACY}</button>`;
