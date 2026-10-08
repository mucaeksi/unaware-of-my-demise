# Entry presentation v003 — 2026-10-07

## Owner request and read-only findings

- Title logo overlapped Fadyme's face. Prologue reserved a large centered masthead band.
- Skip was always visible at the bottom. Narration had an opaque panel with transfer controls below it.
- Natural story completion released the content-install wait immediately, leaving no explicit Continue choice.
- Narrator lines were unrecorded. Existing AudioDirector already supplied a Voice bus and stable speaker/line paths.

## Implemented locally

- Title alone moves the existing 300-pixel wordmark down 204 logical pixels. Tap to start moves down with the composition. Account and patch mastheads retain their measured geometry.
- Prologue logo: upper left, 330 × 120 logical box, alpha 0.42. Its decorative overlay reserves no vertical art band.
- Skip Story: small Cinzel label in the upper right with a 144-pixel logical touch target (48 dp on a 360 dp reference width). Hidden and unfocusable until a screen touch/click; the reveal gesture cannot also activate Skip.
- Bottom narration: Cinzel at 44 logical pixels, 55 at 125% Large Text; panel alpha 0.38, 12-pixel bottom inset within platform safe area. Full paragraph shaping keeps line wrapping fixed during typewriter reveal.
- Transfer information immediately above subtitles: alpha 0.58, 26-pixel text and an 8-pixel red progress bar. Story time never changes actual received/total bytes.
- Nine authored lines, captions, boundaries and 120-second timeline remain unchanged. Actors and the writing hand are recomposed for the enlarged art aperture; walk groups stay on the road instead of in the old masthead band.
- Typewriter uses local story time, revealing a paragraph over roughly 4–7.5 seconds; Reduced Motion shows the whole paragraph. Approved Japanese narrator recordings, when supplied, can drive reveal duration. Voice selection is reserved until an owner-approved audition.
- Approved recordings use the existing `res://assets/audio/voice/narrator/<line_id>.ogg` slot and Voice bus. Every exterior narration recording must use the same approved voice/profile. No recordings were generated.
- At natural completion, only Replay and Continue actions appear in the screen center. Narration, transfer UI and Skip disappear. Replay restarts presentation; Continue releases the install gate exactly once.
- Continue/Skip cannot bypass transfer verification, signed-content checks, installation or the required automatic restart. After restart, the existing automatic sign-in and game-entry route apply. The new three-part tutorial remains the next gameplay task; it has not been authored in this Entry-only change. Current content has the existing two-hero Stage 1-1 tutorial exception, not the requested new three-part tutorial.

## Local API configuration

- Owner correction: **all TTS, including narrator and characters, is Japanese (`ja-JP`)**. English UI/subtitles remain unchanged. Before approved production, speech transcripts must be Japanese adaptations of the approved script; English subtitle text must not be submitted as the Japanese performance transcript.
- The open **Audio Authoring — Local Configuration** native Godot window now provides exactly one masked **Google Cloud API key** field. The earlier separate Gemini/project/ADC fields have been replaced at the owner's request; a locally entered key is preserved during migration and panel refresh.
- Reopen from the Godot Script Editor: `res://tools/audio_authoring_setup.gd`, File → Run / Ctrl+Shift+X. This EditorScript adds an editor-owned native configuration window without installing or replacing plugins.
- Saved file: `F:/unaware-of-my-demise/.local/audio-authoring.cfg`. Enter the key through the window or the `[google_cloud] api_key` field locally. Never paste it into chat.
- The `.local/` folder is ignored by Git and outside the Godot export root. The tool/preview scripts are excluded by the existing export filters. Keys are masked in the form, stored locally in a ConfigFile, and never emitted to logs or packed into player builds. This is local file storage, not an encrypted credential vault.
- Fixed requested families: **all TTS Chirp3-HD / ja-JP**; music and requested SFX **lyria-3.5**. No fallback model is selected.
- Generation is disabled. The configuration panel contains no network client, generation button or production API adapter. Saving configuration is not approval. Every future API generation requires explicit owner approval of that request.
- A single Japanese narrator voice ID remains pending audition. Saving credentials preserves a subsequently approved Japanese voice ID. An obsolete non-Japanese narrator selection is invalidated by the owner's Japanese-only correction.

## Verified Google provider requirements

Official documentation checked on 2026-10-07:

- [Lyria 3.5 model](https://ai.google.dev/gemini-api/docs/models/lyria-3.5): Gemini API model ID `lyria-3.5`.
- [Music generation](https://ai.google.dev/gemini-api/docs/music-generation): Interactions API supports music of a couple of minutes and Gemini API-key authentication. The guide documents music generation; suitability for isolated game SFX is not established by this verification. Keep the requested SFX family reserved and assess it only through an approved trial.
- [Chirp 3: HD voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types): Japanese `ja-JP-Chirp3-HD-*` voices are officially listed.
- [Cloud TTS authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication): endpoint authentication depends on the calling interface. The owner supplies one Google Cloud key. The local form reserves that one key for the two requested models; this change does not claim an authenticated production call has succeeded. Cloud-project access to the exact Lyria 3.5 endpoint and Chirp3-HD remains to be verified before an explicitly approved production request. No model substitution or second key is introduced.

No two-minute music prompt was written; the owner requested it later.

## Validation and evidence

Evidence directory: `build/entry-presentation-v003-20261007/`.

- Phase 1 Entry suite: **52/52**, 5,304 assertions.
- Phase 2 UI suite: **148/148**, 100,279 assertions.
- Full regression suite: **458/458**, 148,399 assertions.
- After actor recomposition: prologue suite **14/14**, 4,934 assertions.
- Final rendered matrix: nine shots × normal / compact 125% Large Text / tall 125% Large Text = **27 captures**, all narration/controls/watermark/safe-bottom/transfer-placement checks passed (`layout-final/matrix.json`).
- Native-window touches passed: hidden initial Skip, first touch reveals only, second touch skips, 144-pixel target, actual Replay and Continue taps, centered two-action completion, unchanged 25% fixture transfer (`native-touch.json`).
- Android-preset PCK export completed; **no authoring/tool/local-credential entries** in its stored-file list. This is a content-export check, not an APK/AAB release or Play upload.
- Godot Editor and original live runtime remained open; hot reload freed old prologue instances before reloading. Local UI Preview and Audio Authoring windows remain available.
- First performance pass: p95 16.677 ms, max 98.561 ms, with other image-reading/tool work on the host. A quiet repeat recorded all stall timestamps: **7,199 frames / 120 seconds, p95 16.676 ms, max 16.863 ms, zero intervals over 25 ms and zero within-shot camera changes** (`profile-quiet/playback.json`). The original 98 ms host interval was not reproduced; attributing it to concurrent host work is an inference, not a proven root cause. The engine TIME_PROCESS monitor also reports a 131.458 ms maximum during the quiet run despite no matching frame interval, so that monitor sample is retained as an instrumentation caveat. These desktop measurements do not establish Android device acceptance.
- Single-key/Japanese correction: panel/store parsed, real runtime form shows exactly one key field, migration preserves its key, all TTS and narrator language equal `ja-JP`, models remain fixed and generation disabled (`audio-config-validation.json`). No API generation performed.

## Failures investigated and repaired

- Initial regression assertions still required identical Title/account logo positions and automatic advance at 120 seconds. Updated those contracts to the owner's explicitly changed behavior, keeping exact account/patch geometry and mandatory restart checks.
- Exact alpha assertions initially compared Color's 32-bit storage to 64-bit literal values. Expected values now use the same Color representation, with exact equality and no loosened tolerance.
- Audio launcher initially used `Panel` as a script constant, which collides with Godot's native class under strict checks. Renamed the constant `AudioPanel`.
- Creating a native Window while its initial `visible` flag was true produced a `force_native` lifecycle error. New windows are now hidden before configuration, then shown. The subsequent native configuration window was validated at 560 × 720.
- First native touch harness supplied logical coordinates without `push_input(..., true)`, so the 0.5 window transform converted them a second time and missed controls. Corrected the harness coordinate contract; the actual touch checks then all passed. No player assertion was weakened.
- Initial credential migration called ConfigFile.erase_section on already removed legacy sections. Added explicit section-existence checks; repeated local load/save then completed without new errors and with the key preserved.
- Editor's historical unrelated warning rows and the initial repaired lifecycle error remain in logs; no debugger errors were cleared to manufacture a clean result.

Backup before this iteration: `local-backups/entry-presentation-v003-20261007/`.
