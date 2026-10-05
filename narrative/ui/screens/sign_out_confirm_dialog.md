# SignOutConfirmDialog

`ui.sign_out_confirm` · `sign_out_confirm_dialog` · shared dialog. [Registry](../SCREEN_REGISTRY.json), [view](../entry/components/sign_out_confirm_dialog.js).

Root: `Control/SignOutConfirmDialog`. Children: `Dimmer`, `Panel/Title`, `Message`, `CancelButton`, `SignOutButton`. English title `Sign out?`. Cancel is the initial keyboard focus. Escape/outside tap behaves as Cancel.

Idle message: return to sign-in; account and saved progress remain. Active-download message also says the download will stop. Cancel leaves the operation intact. Confirm invalidates old callbacks, cancels/quiesces transfer work, invokes best-effort `Online.log_out`, clears remembered native credential state and returns to SignInScreen. Device preferences and verified content remain; it does not call Delete Account.

Signals: `confirmed`, `cancelled`. Input: operation phase. During installation an atomic publish must finish or be rolled back before credentials/state are dropped; no late completion can enter the game for the old account. Current ContentInstaller has partial-file resume and atomic record publication, but no public active-operation cancellation API. A controller/transport cancellation boundary is therefore an explicit Godot binding requirement, not a feature claimed by this prototype.
