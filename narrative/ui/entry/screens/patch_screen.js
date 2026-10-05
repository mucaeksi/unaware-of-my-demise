"use strict";
window.EntryViews = window.EntryViews || {};
EntryViews.PatchScreen = ({copy, patch, primary, icon}) => {
 const rows={
  available:['UI_PATCH_TITLE','UI_PATCH_DESCRIPTION','update','UI_DOWNLOAD','download'],
  ready:['UI_READY_TITLE','UI_READY_DESCRIPTION','check','UI_ENTER_GAME','enter-game'],
  restart:['UI_RESTART_TITLE','UI_RESTART_DESCRIPTION','update','UI_CLOSE_GAME','close-game'],
  download_error:['UI_PATCH_ERROR_TITLE','UI_PATCH_ERROR_DESCRIPTION','offline','UI_RETRY','download'],
  verify_error:['UI_VERIFY_ERROR_TITLE','UI_VERIFY_ERROR_DESCRIPTION','lock','UI_RETRY','download'],
  sync_error:['UI_SYNC_ERROR_TITLE','UI_SYNC_ERROR_DESCRIPTION','offline','UI_RETRY','sync']
 };
 const row=rows[patch];
 if(row)return `<div class="status-card"><span class="status-mark">${icon(row[2])}</span><h2>${copy[row[0]]}</h2><p>${copy[row[1]]}</p>${primary(copy[row[3]],row[4])}</div>`;
 const key={checking:'UI_CHECKING_FILES',downloading:'UI_DOWNLOADING',verifying:'UI_VERIFYING',installing:'UI_INSTALLING',syncing:'UI_SYNCING'}[patch];
 return `<div class="status-card"><span class="status-mark">${icon('update')}</span><h2>${copy.UI_PATCH_TITLE}</h2><div class="pending"><span class="spinner" aria-hidden="true"></span><span>${copy[key]}</span></div><div class="progress" role="progressbar" aria-label="${copy[key]}"></div><p>${copy.UI_PATCH_DESCRIPTION}</p></div>`;
};
