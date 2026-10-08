"use strict";
window.EntryViews = window.EntryViews || {};
EntryViews.SignOutConfirmDialog = ({copy, downloading, primary}) => `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-component-id="ui.sign_out_confirm"><span class="label">UNAWARE OF MY DEMISE</span><h2 id="modal-title">${copy.UI_SIGN_OUT_TITLE}</h2><p>${copy[downloading?'UI_SIGN_OUT_DOWNLOAD_DESCRIPTION':'UI_SIGN_OUT_DESCRIPTION']}</p><div class="dialog-actions">${primary(copy.UI_CANCEL,'close','secondary')}${primary(copy.UI_SIGN_OUT,'confirm-sign-out')}</div></section>`;
