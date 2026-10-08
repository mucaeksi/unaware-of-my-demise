# Entry → authenticated gateway → automatic Patch

## Scope and audit

Owner's latest instructions authorize Entry and Patch. Work remains local; no push, deployment or external support message was made. Production remains a read-only creative source. Approved narrative illustration/wordmark are reused; no story canon or new bitmap was necessary.

Read-only audit found the explanatory sign-in card, one-attempt login, no persistent returning-player preference, manual download/restart, utility footer during Patch, and checkbox/checkmark rendering on selected Settings. The card changed its layout and replayed its curtain on every phase. The previous runtime screenshot is `build/entry-utilities-20261007/latest-audit.png`.

The mentioned `C:/Users/PC/Desktop/MASTER PROMPT.md` was absent. Other similarly named documents were not substituted as instructions. The owner's direct requests and AGENTS.md govern this work.

## Implemented

- Centered, engraved red **Sign In** action opens the existing native Google Credential Manager flow. Explanatory sign-in card removed. Official Google chooser retains its own branding.
- Successful login shows the breathing **Tap to fulfill your destiny** prompt and **Help / Logout / Settings** footer. 144 logical pixels remain the minimum button height (48 dp at the 360 dp baseline).
- Returning players automatically obtain a fresh Google/server session, then reach the gateway. The saved preference contains only a boolean; no Google credential, bearer token, email, account ID or player progress is saved there. Logout clears the preference and native credential choice.
- Transient login failures get at most three complete attempts with 0.7/1.4 s backoff. Nonce failures do not open the chooser. A lost exchange gets a fresh nonce because the server consumes nonces once. Cancellation, missing accounts, invalid credentials and missing native/configuration support stop immediately. Small **Failed to login / Retry** presentation retains the actual `Outcome` in `StoryDirector.login_failure`.
- The destiny tap begins client/content/snapshot checks. Required signed content downloads and installs automatically. An untrusted/failed patch cannot restart or open player state. Every installed patch requests a fresh process, including first installs that could otherwise mount in place.
- Android uses the engine's `GodotActivity.onGodotRestartRequested` process rebirth through UomdNative. Desktop exports use OS restart-on-exit. Editor/mobile support is not inferred from that desktop API. A one-use restart hint skips Title and the gateway tap after patch restart; a fresh Google session and all release/snapshot checks still run.
- Patch has no Help, Settings, Logout or utility overlay. Three red-accented stage indicators report real operation boundaries; there is no invented percentage. Phase text updates do not replay a screen curtain. Slow page transitions remain at actual page boundaries.
- Settings uses red filled/outlined toggle buttons, with no CheckBox/checkmark glyphs. Audio slider fill matches the selected red. 30/60 FPS persistence and future 120 FPS gate remain.
- Button feedback is a faint 0.24 s red ring clipped to the control. It never scales, translates or delays controls/commands. Reduced Motion prevents new feedback/prompt motion; enabling it stops the gateway pulse.
- Main Theme slot remains `res://assets/audio/music/bgm_main_theme.ogg`; normal and post-patch entry starts retain its fade/loop route. Owner audio is still absent.

## Validation

Evidence folder: `build/entry-gateway-20261007/`. Backups: `local-backups/entry-gateway-20261007/`.

- Phase 1 physical input/focus: **12/12**, including mouse/touch, minimum hit area, stable pressed bounds, and footer event ownership.
- Authentication: **17/17**, including third-attempt success, three offline attempts, fresh nonce after a lost exchange, cancellation, renewal/account binding and no persisted credential.
- Intermediate Entry: **26/26**. Intermediate full UI: **118/118**. First full project run: **426/426**, 143088 assertions.
- Final full suite: **428/428**, 56 scripts, **143098 assertions**, 106.212 s; `final-gut.log` / `final-gut.xml`. Includes rejected-signature and restart-only retry regressions. Expected asset-fixture warnings and existing GUT in-test orphan reports remain visible; no shutdown leak warning is reported by this suite.
- Real editor runtime: physical mouse sign-in with local transport/signer fixtures reached the gateway; a physical touch began Patch and made one held snapshot request, with footer/overlay absent. Fixtures make no real Google/server requests and use a separate preferences file.
- Real desktop Patch sample: 120 frames, cap 60, median 16.666 ms, p95 16.679 ms, maximum 16.825 ms, median 7 draw calls. This is desktop evidence, not Android device/thermal qualification.
- Source capture matrix: 1080×1920, 720×1280 with Large Text, and 1080×2400 with Large Text; sign-in, gateway, checking, downloading, login error, and utility bottom captures.
- Native plugin: debug and release Gradle builds passed; rebuilt AARs copied into the existing export addon. Existing manifest removal warnings remain visible.
- Android APK: 114982776 bytes; package `io.github.mucaeksi.unawareofmydemise`, minSDK28, targetSDK36, arm64 only. APK v2 signature, ZIP CRC, 16KB zip alignment, 16KB ELF load alignment, native restart method in DEX and 61 third-party library notices passed independent checks. Metadata/hash are in `apk-structure.json`.

## Failed probes / root causes

- Old tests expected utilities during Patch and manual Download/Close Game. These feature expectations were replaced by owner-requested automatic flow checks, plus stronger absence/verification/restart assertions; no assertion was weakened to conceal a failure.
- One integration fixture used a base backend without content delivery. Its exact failure is `content_download / Game data updates need the game server`; the test now asserts that error and that player state cannot open.
- First combined runtime eval used space indentation and failed to compile. The next attempt encountered the paused helper. The approach changed to relaunch plus short, tab-indented evals and physical viewport input; those succeeded. No product code/debugger/strict typing was altered to bypass it.
- Three remote source lookup approaches returned 404 using obsolete/incorrect Android source paths. Remote guessing stopped. The locally installed 4.7.2 SDK was inspected with `javap`; its host callback calls the engine's `ProcessPhoenix.triggerRebirth`, and the plugin compiled against that exact SDK.
- Android export lifecycle is **unresolved**: both the first invocation and the final invocation with `--quit` produced APKs and logged export completion, but their headless processes stayed alive. After two attempts the approach changed to independent artifact validation: package/SDK/ABI, signature, archive integrity, zip/ELF alignment, DEX restart method and notices passed. Only the two specifically identified export helper processes were stopped; the user's editor was preserved. Root cause is bounded to headless post-export lifecycle, not yet isolated to engine/addon teardown. Do not claim a normal export exit code. Alternative: a minimal isolated export/quit reproducer with the same engine and plugin set; no plugin or strict typing removal was used as a workaround. The final APK includes final source/theme and is ready for device QA.

## Remaining external validation

`adb devices -l` reports no device. Real Android Google account selection, process restart, touch/safe-area/keyboard behavior, sustained 30/60 FPS and Android 10+ compatibility require device validation. 120 FPS remains gated. Existing support delivery still requires a verified sender/binding/deployment from the prior report. Main Theme audio remains an owner-provided slot. These are not presented as completed features.
