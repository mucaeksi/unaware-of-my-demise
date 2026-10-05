"use strict";
window.EntryViews = window.EntryViews || {};
EntryViews.SignInScreen = ({copy, google, returning, status, primary, icon}) => {
 if (status) return `<div class="status-card"><span class="status-mark">${icon(status.icon)}</span><h2>${copy[status.title]}</h2><p>${copy[status.body]}</p>${primary(copy[status.action],status.actionId)}</div>`;
 return `<p class="tagline">${copy[returning?'UI_RETURNING_TAGLINE':'UI_SIGN_IN_TAGLINE']}</p><button class="${returning?'primary':'google-button'}" data-action="sign-in">${returning?'':google}${copy[returning?'UI_CONTINUE_RETURNING':'UI_CONTINUE_GOOGLE']}</button><p class="subtext">${copy[returning?'UI_RETURNING_NOTE':'UI_SIGN_IN_NOTE']}</p>`;
};
