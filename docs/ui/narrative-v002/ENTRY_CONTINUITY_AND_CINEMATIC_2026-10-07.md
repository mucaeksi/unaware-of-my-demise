# Entry continuity, legibility and cinematic transitions

2026-10-07. Local source and Godot 4.7.2 runtime revision. Owner selected Entry only. No push, deployment or APK export.

## Read-only findings and owner decisions

- Title used a vertically centred wordmark; Sign In used a 300 px wordmark / 216 px top space; Patch reverted to 220 / 144. The owner requested one fixed masthead throughout Entry.
- Title prompt opacity ranged from 0.74 to 1.0, which made its pulse hard to distinguish over bright artwork. The owner requested heavier, clearer text and a stronger blink.
- Earlier reveal changed the page immediately and opened a radial curtain. The owner requested slower, different cinematic transitions.
- The opening bell quote appeared on the authenticated gateway. It now appears only on the first Sign In page, following the owner's earlier placement request; gateway, login error, Patch and utilities omit it. Patch's separate canon download quotes remain.
- Owner asked to keep Godot and Local UI Preview open and to use this workflow in future sessions. This preference is saved in root AGENTS.md.

## Implemented

| Area | Result |
|---|---|
| Shared masthead | `entry_masthead.gd` supplies the same 300 px wordmark, 216 px top space and 12 px separation to Title, account/gateway, every Patch phase, Settings, Help, Contact and Licenses. At logical 1080 wide the wordmark Control rectangle is `(40,260,1000,300)`; OS safe-area and aspect scaling apply equally. |
| Typography | Cinzel weight 800 for prompt, Sign In, footer utilities and setting choices. Prompt 52 pt, quiet utilities 44 pt, dark outline/shadow; bell quote weight 600. Status copy uses Source Sans 3 Semibold and the ivory palette. Title artwork has a 28% ink scrim to improve text separation. |
| Pulse | Title and destiny gateway breathe over 2.8 s with opacity 0.40–1.00. Reduced Motion uses steady full opacity. Hit geometry stays fixed. |
| Transition | Main page change 3.2 s; utilities and confirmation open/close 2.6 s. The old page fades into dark ink; broad red-toned waves reveal the new page. No radial aperture. Existing Studio timing and continuous audio ownership remain. |
| GPU ownership | Copy native draw nodes without scripts/signals; disable processing, input and focus, including internal scrollbars. Render the old page once into a viewport at its displayed resolution, remove the copied nodes after the frame, disable viewport updates and release it at completion. No production CPU framebuffer readback. Temporary materials are independent. |
| State/input | Routing, Patch verification and focus changes commit immediately; the fade cannot delay/cancel verified work or submit a second command. Patch status/byte changes within the same page do not repeatedly trigger a page fade. Reduced Motion skips/frees the old visual and cancels active effects. |
| Live Preview | One reusable native window in the same runtime via `scripts/art_review/preview_session.gd`. Refresh/F5 rebuilds the current page/theme after assistant hot reload. Phase picker and Aa+ remain interactive. Window Close hides it; helper reuses it. Development preview and QA scripts remain excluded from exports. |
| Theme asset | Existing serialized Theme alias regenerated and reloaded with headless Godot ResourceSaver; prompt 52 / weight 800 verified. Live runtime Theme saving was avoided. |

## Phase tests and real rendering

Evidence root: `build/entry-continuity-20261007/`. Backups: `local-backups/entry-continuity-20261007/`.

- Phase 1 focus/layout: **13/13**, 103 assertions (`phase1-focus.log`).
- Phase 2 focus/layout/utilities: **14/14**, 141 assertions (`phase2-focus.log`); transition ownership/input **7/7**, 190 assertions (`phase2-transition.log`).
- Offset-host and confirmation continuity were then covered; UI phase **131/131**, 95,301 assertions (`phase3-ui.log`). Final actual-font/focus phase **15/15**, 166 assertions (`phase4-font-focus.log`), including TextServer weight coordinates for eight font variations.
- Initial full pass before confirmation refinement: **440/440**, 143,404 assertions, 98.760 s (`gut-full.log`); pre-font correction full **441/441** retained as `gut-before-font.log`. **Final full source: 442/442**, 57 scripts, **143,436 assertions**, **99.498 s** (`gut-final.log`), exit 0.
- Thirty actual GPU captures through the same live runtime: base 1080×1920, compact 720×1280 with logical 1080×1920 / 125% text, tall 1080×2400 / 125% text. Each covers Title, Sign In, gateway, checking, downloading, consent, Settings, Help, Contact and Licenses. Every logo rectangle matched that size's Title exactly; footer absent on Patch, quote only on Sign In. Matrix JSONs and PNGs are in the three named subfolders. Long utility content scrolls beneath the fixed logo; keyboard Send/Back focus tests passed.
- Native Preview transition captures `transition-00-outgoing.png` through `transition-04-complete.png` show the old page, eclipse and new reveal. The veil rectangle matched its offset page `(0,148,1080,1772)`, leaving the preview toolbar visible. Snapshot 540×886, updates disabled after first render; copied visual and final effect released.
- Native settings/back restored gateway focus; real injected touch on gateway reached checking and hid the footer. Patch consent and download PNGs were captured; fixtures send no account/server requests.
- After the single diagnostic recovery restart, run 39 / PID 30616 rendered the continuity/modal revision. A real desktop touch event at the Title logo reached Sign In. Exact wordmark rectangles matched, bell quote rendered and status font was EntryStatus (`cold-main-validation.json`, `cold-main-title.png`, `cold-main-signin.png`). Fresh native confirmation open/close validated its frozen snapshot, disabled updates and correct offset veil (`native-modal-validation.json`). The subsequent font-axis correction was hot reloaded in the same healthy runtime, without another restart; final heavy-glyph captures are `final-main-signin.png`, `final-local-preview-title.png` and the 30 matrix PNGs. `effective-font-weights.json` verifies the engine's actual weights.
- Final Title→Sign In transition measurement with actual weight800 and no PNG instrumentation: **240 frames**, cap60; median **16.666 ms**, p95 **16.675 ms**, maximum **18.903 ms** on the initial page rebuild. All open windows combined: maximum42 draw calls on the initial snapshot frame;29 settled. The initial rebuild exceeds the16.667ms budget by2.236ms; this is retained, not hidden as a universal60FPS pass. These are desktop measurements with both main and preview open (`transition-performance-final.json`), not Android qualification. Earlier pre-font gateway measurement (p9516.676ms/max16.695ms,41/30draw calls) remains in `transition-performance.json` as historical phase evidence.

## Failed probes, corrections and limits

1. The editor shader writer refused mutations during play. Changed approach to a source edit and assigned the shader code in the live runtime; all five uniforms were returned and real Compatibility renders succeeded. No editor shutdown was required.
2. Initial native Preview creation set `force_native` while visible. Godot rejected it. Fixed by hiding before setting the flag; fresh helper creation in run 39 succeeded. The original run 38 error is retained in `runtime-log-evidence.json`.
3. `Script.reload(true)` initially recompiled cached source, leaving the old controls visible. Changed approach to reading disk into `script.source_code` before reload, then rebuilding the page. All relevant reloads returned OK.
4. First transition ownership test found internal scrollbars still accepted input. Traversal now includes internal children; the same assertions passed. First GPU capture also exposed a veil escaping the offset preview page. Changed transition's root from Node to Control to inherit page coordinates and added an exact rectangle regression test. No assertion was weakened.
5. The first ten-image matrix exceeded the MCP eval's eight-second response deadline although every capture and matrix JSON completed. Further matrices ran as a deferred Node job with an explicit completion status; no native windows were launched.
6. A touch probe used physical pixels with `push_input(..., true)`; this viewport expects logical local coordinates, confirmed by `get_visible_rect()`. The corrected logical touch reached checking. Production hit targets did not change.
7. A diagnostic eval read nonexistent `_download_progress` instead of `_progress` after capturing the download image. This parked run 38 in a debugger break. The suspension resume API could not resume this non-debuggable error. Following the saved workflow exception, only the runtime was stopped/restarted once; **editor PID 40448 stayed open throughout**. Correct source property was read from disk before subsequent checks. Final runtime PID 30616 and native Preview Window 1 remain open. Historical errors were retained, not cleared; run 39 has no game errors.
8. Final visual inspection showed that the configured string key `"wght"` did not apply the intended bold weight: the actual TextServer coordinates were empty. A targeted numeric-tag probe returned `{2003265652:800}`. The theme now uses `0x77676874` for every affected font; eight actual engine weights are asserted (800 for prompt/footer/sign-in/heading/subtitle/settings, 600 for quote, 500 for Google identity). Updated the former configuration-only assertion to the correct tag and added actual-render weight assertions. All 30 captures were regenerated; prior ones are retained in `before-font-*` directories. The serialized Theme was regenerated again and final full442/442 passed. The bolder font also exposed wrapping in the development toolbar; Refresh now uses its compact body-font style and phase picker selection matches the visible page. Verified live without restarting.
9. GUT fixture missing-art warnings and existing orphan notices remain visible. Existing unrelated editor warnings, earlier standalone capture shutdown and exporter-exit issues were not suppressed or retried.

No new image/canon was needed. Secondary Production sources, strict typing and unrelated plugins/work are preserved. The existing APK is stale for this revision. Android hardware, thermal/frame pacing, native Google login/restart, owner Main Theme recording and support-mail activation remain pending from earlier checkpoints. The next gameplay screen remains the owner's choice.

## Future local sessions

Keep the editor and a healthy live runtime open. Open/reuse Preview with `load("res://scripts/art_review/preview_session.gd").open(get_tree())` through Godot AI game_eval. Read changed script source from disk before `reload(true)`, then use helper `refresh(get_tree())` or Preview Refresh/F5. Validate in this live runtime and run unattended tests headlessly. Capture batches with `entry_session_review.gd` deferred jobs rather than opening multiple GUI processes. Minimize only if the editor bridge remains reliable. Restart a runtime only when a concrete debugger/lifecycle problem requires it and explain the reason.
