# Entry quote and approved patch download — 2026-10-07

## Owner revision

Local Godot 4.7.2 work, limited to the owner-selected Entry and Patch screens. The latest request supersedes automatic patch downloads: check first, display the authenticated size, download only after acceptance. No Git push or deployment. The secondary Production creative source remains read-only.

## Read-only findings

- Entry used a 220 px wordmark and 144 px top spacer. There was room for the requested larger, lower masthead.
- The running game reported `tr_TR`. Cinzel's locale-sensitive shaping made the English sign-in caption appear with a dotted I.
- The director started installation immediately on a content mismatch. The signed manifest already carried exact pack bytes; there was no approval popup or byte progress UI.
- The shipped Chapter I dialogue and `narrative/02_Main_Story/PART1_FULL_SCRIPT.md` supplied the quote source. The new masthead quote was supplied directly by the owner.

## Implemented

- Account pages: logo height 300 px, top spacer 216 px; centred wordmark and balanced central touch target. Patch retains its smaller masthead to reserve space for status and progress.
- Under the logo: **Some bells ring for the living / Others... for the forgotten**, Cinzel weight 500, 30 px with Large Text scaling and a dark shadow. This is the owner's text, not a new story-canon claim.
- Literal **SIGN IN**, global English locale at shell initialization and explicit `language = "en"` on shared labels/buttons. Device Turkish locale regression is tested. Story voice-language data is preserved.
- Preflight checks the release signature, schema, one cumulative pack, app compatibility, generation/replay floor, cached/resume bytes and available disk space. It creates no install files and starts no transfer.
- Content Update popup displays total size in binary units plus exact bytes and remaining download. Cancel/Back leaves the update pending; Review Update reopens the popup. Only Download/Install acceptance calls installation. The approved signed release is retained; it is revalidated on acceptance, including disk/replay changes.
- Red, noninteractive progress bar and byte/percentage caption. Progress advances only after complete, header-checked 512 KiB ranges have been committed to disk. Interrupted ranges never count. Complete HTTP 200 fallback and resume remain supported. Verification is a separate phase, not a fabricated percentage.
- Seven exact authored lines selected by line ID from `game/data/content/story_script_ch01.json`: `opening_006`, `opening_015`, `node_1_1_post_002`, `node_1_1_post_003`, `node_1_2_pre_002`, `node_1_2_pre_003`, `node_1_2_post_001`. A shuffled pool avoids repeats until exhausted and avoids an immediate repeat between pools. Nothing is paraphrased or invented.
- Quotes rotate every 10 seconds beneath the bar, with a 0.4/0.5 s fade. Reduced Motion changes text directly. Timer/tween stop when download ends and belong to the Entry node.
- Expensive manifest/cache/hash work uses the existing `WorkerJob` infrastructure to keep the UI thread responsive. Integrity and replay assertions are preserved.
- Patch has no Help/Settings/Logout footer. Verified installation still requests a fresh process, then automatic sign-in and checks. Account snapshot synchronization occurs after content compatibility is restored; downloading/verification cannot truthfully be completed before acceptance.
- Help's update/restart answers and the local preview flow reflect approval. The serialized shared Theme was regenerated through the live Godot runtime.

## Verification

| Phase | Evidence | Result |
|---|---|---|
| Logo / English / physical focus | `build/entry-consent-20261007/phase1-tests.log` | 12/12 |
| Consent / restart flow | `phase2-flow.log` | 11/11 |
| Signature / disk / read-only preflight | `phase2-installer.log` | 12/12 |
| Range / resume / progress | `phase2-network.log` | 20/20 |
| Final Entry UI | `final-entry-tests.log` | 33/33, 269 assertions |
| Full suite | `full-suite.log`, `full-suite.xml` | 435/435, 57 scripts, 143179 assertions, 97.337 s |
| Visual matrix | `review-sheet-{base,compact-large,tall-large}.jpg` | 20 native captures, all stderr empty |

Sizes: 1080×1920 normal, 720×1280 Large Text and 1080×2400 Large Text. Sign In, gateway, checks, approval popup, download, login error and utility bottoms were reviewed. Touch target geometry and modal/keyboard focus are tested.

Actual Godot AI main-runtime checks used a signed local test fixture without contacting Google: pre-accept install phases were empty; physical touch on Cancel kept them empty; physical mouse acceptance ran downloading → verifying → installing and reached the editor's expected restart fallback. This is UI/control-flow evidence, not a native account/restart certification.

Actual `HttpTransport` / `HTTPRequest` downloaded 2097152 bytes from a temporary loopback server. The production backend → Game → director → Entry signal chain displayed exactly 0%, 25%, 50%, 75%, 100%, matching committed bytes. Disk SHA-256 independently matched the test payload. See `runtime-http-evidence.json`, `runtime-http-25.png` and the reproducible validation-only driver/server in the evidence folder. The helper server was stopped after validation.

The real default quote Timer changed authored text while the byte percentage stayed at 25%; default interval 10 s, measured elapsed 33.562 s. See `quote-clock-runtime.json`. The short-interval regression also checks phase cleanup and Reduced Motion.

Desktop steady download UI: 180 wall-clock frame samples, cap 60, median 16.666 ms, p95 16.678 ms, max 16.718 ms, median 10 draw calls. `runtime-steady-frame-evidence.json` contains the scope. The earlier HTTP run included framebuffer readback/PNG capture and recorded a 135.201 ms maximum; that measurement is preserved and is not presented as a clean frame-time run. The separate measurement removes capture instrumentation, not production effects or assertions. Android hardware, thermal behaviour and 30/60/120 FPS acceptance remain unverified.

## Failures and corrections

1. The taller masthead shifted the sign-in touch target to y=1225; the existing middle-position assertion expected 1056±150 and failed. Added layout balancing below the account action; final main-runtime centre y=1117. The assertion was retained.
2. Popup close tried to restore focus to the underlying button while modal focus isolation had set it to NONE. Godot warned at `GothicModal._close`. The shared restore now requires a visible, focusable, enabled control; Entry restores its focus after modal close. All consent/restart tests then passed. No warning suppression was added.
3. Editor inspection found new variable-shadow warnings for `track` and Control's `size`; those local variables were renamed. Existing unrelated editor warnings and test-fixture missing-asset/orphan reports remain visible. Current main-runtime launch/logs have no errors.
4. One post-Theme-save main capture showed the quote absent despite visible Label/text/font metadata. A later settled frame rendered the quote. A clean cold launch without any runtime Theme save or font-metric operation then rendered it correctly after a real Title touch; see `cold-main-signin.png` and `cold-main-evidence.json`, run 38. This bounds the symptom to the live resource-save/capture session; the exact engine cache interaction is not isolated. No redraw/font workaround was added to the game.

## Files and limits

Evidence: `build/entry-consent-20261007/validation-summary.json`, `change-inventory.json`; backups: `local-backups/entry-consent-20261007/`. Source edits preserve the existing strict typing policy, native plugins and unrelated work.

This revision updates source and editor/runtime preview. **No new APK was exported**; `build/entry-gateway-20261007/uomd-entry-debug.apk` is the previous checkpoint and does not include this revision. The earlier headless exporter post-export exit issue was not retried. Owner main-theme audio and verified support-mail activation remain pending as recorded in the previous checkpoint. No next gameplay screen was started.
