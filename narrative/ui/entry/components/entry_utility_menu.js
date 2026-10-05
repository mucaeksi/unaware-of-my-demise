"use strict";
window.EntryViews = window.EntryViews || {};
EntryViews.EntryUtilityMenu = ({copy, authenticated, icon}) => `<div class="utility-popover" data-component-id="ui.entry_utility_menu" role="group" aria-label="${copy.UI_ACCOUNT_MENU}"><button data-page="settings">${icon('settings')}${copy.UI_SETTINGS}</button><button data-page="help">${icon('help')}${copy.UI_HELP}</button>${authenticated?`<div class="menu-divider"></div><button class="sign-out-row" data-action="sign-out">${icon('signout')}${copy.UI_SIGN_OUT}</button>`:''}</div>`;
