# Prompt — Claude Opus 5.5, first local Unity pass (L-1), then handoff to Gemini Argon

> Paste this file (or "Read docs/handoff/CLAUDE_LOCAL_FIRST_PASS.md and execute it") as the first message of the local
> Claude Code session started at the repository root on the owner's Windows machine. Written 2026-10-25 by the cloud
> session that ported the client; it is the plan for the last pass Claude does before Decision D-33 hands operations to
> Gemini Argon.

## Role and goal

You are Claude Opus 5.5, lead engineer of **Unaware of My Demise** (Unity 6 LTS Android gacha RPG, `apps/unity/`;
Cloudflare Workers + D1 backend `apps/api/`; React Control Center `apps/admin/`). The owner opens the Unity project locally
and shows you the whole Unity folder through the live Editor (MCP for Unity, `unityMCP`). Your job in this session:

1. bring the project up cleanly on the owner's local editor (Unity **6.3 LTS**, `6000.3.x`),
2. audit the entire Unity client against the TypeScript reference and fix what is wrong,
3. verify on the Editor and, if a phone is connected, on a device,
4. leave `main` green, documented and pushed, then activate the handoff to **Gemini Argon** (D-33).

Communicate with the owner in Turkish, concisely; code, commits and docs in English. Owner preferences: inspect →
understand → decide → implement → test → verify → document → commit → continue; do not invent technical, gameplay, story
or infrastructure facts; distinguish verified facts, assumptions and open decisions; cloud-first; GitHub is the source of
truth; never modify the Google Drive legacy archive.

## Read first (in this order)

1. `README.md` (authoritative master prompt), `CLAUDE.md`, `docs/DECISIONS.md` (D-28, D-31, D-32, D-33).
2. `.claude/skills/uomd-unity-engine/SKILL.md` — the verified type inventory and the project rules.
3. `docs/NEXT_STEPS.md` — the U-5, U-4a/b, U-2 and U-3 entries list what is done and what is open.
4. `apps/unity/LOCAL_DEVELOPMENT.md`, `.claude/skills/unity-mcp-workflow/SKILL.md`,
   `.claude/skills/unity-mcp-orchestrator/UOMD-NOTE.md`.
5. The behavioural oracle: the deleted TypeScript client, `git show e918b723^:apps/game/src/...` (scenes, `ui/hubScreen.ts`,
   `ui/domKit.ts`, `ui/pixiKit.ts`, `net/api.ts`, `flow.ts`). Port behaviour from it; never invent UI text or canon.

## Hard rules (unchanged by this pass)

- Server parity: combat is a bit-exact port of `@uomd/combat`; the Worker re-simulates every battle. Engine changes go into
  TypeScript and C# together; regenerate the vectors (`tools/export_unity_*_vectors.ts`).
- Engine-free code stays engine-free (files compiled by `apps/unity/Logic/*.csproj`).
- UI is Runtime UI Toolkit built in C# (`UomdHubScreen` for hub screens). No UGUI, no TextMeshPro, no scene-authored UI.
- Content arrives only as signed data patches; never downloaded code.
- Secrets only from the environment; never print keystore values or credentials. Never `wrangler deploy` by hand.
- Push only verified work to `main`: `npm run verify` green, diff reviewed, fetch, fast-forward only, never force (D-32).
- Production / public Play release needs separate owner approval. Release signing waits on the owner's upload key.
- Shell safety: never pass text containing backticks or `$(...)` through an unquoted heredoc or `bash -c` string — write
  files with the editor tools or a quoted heredoc (`<<'EOF'`). (A cloud-session mistake executed backticked words as
  commands on 2026-10-25; nothing was deployed, but it must not happen again.)

## Step 1 — Bring-up on the local editor

1. `git pull origin main`; `npm ci`; `npm run export:unity` (StreamingAssets base content, git-ignored).
2. Open `apps/unity` with the owner's 6.3 editor. Unity upgrades the project; let it, then review every changed file:
   - `ProjectSettings/ProjectVersion.txt` (record the exact `6000.3.x` + revision the owner installed),
   - `Packages/manifest.json` + `packages-lock.json`: core packages move to the 6.3 versions (URP 17.3.x, test-framework,
     ugui, 2D packages); keep `com.coplaydev.unity-mcp` on its pinned commit,
   - `ProjectSettings/*.asset`, `Assets/_UOMD/Settings/*` (URP assets).
3. Make the repository follow the new version — every place that still assumes 6000.0:
   - `apps/unity/cloud/unity_ref_compile.py` (`DEFINES` list incl. `UNITY_6000_3_OR_NEWER`, the URP 17.0.4 signature
     blocks → copy the signatures of the URP version the editor now bundles), then `npm run check:unity-compile` = 0 errors,
   - `apps/unity/cloud/setup_linux.sh` default `UNITY_VERSION`/changeset, `apps/unity/cloud/unity_ci.ps1` header,
   - `tools/lib/unity-status.test.ts`, `tools/record_unity_build.test.ts` fixtures (`6000.0.58f2`), README/handoff mentions,
   - API changes the upgrade surfaces in the console (UI Toolkit, `MeshGenerationContext`, `Awaitable`, Android player
     settings / target SDK). Fix them minimally; do not refactor what compiles.
4. MCP for Unity: Window → MCP for Unity → Transport **stdio**; confirm `/mcp` shows `unityMCP` connected; read
   `mcpforunity://editor/state` before using tools.
5. Clean console: zero compiler errors, no warnings introduced by our code. `run_tests` EditMode must pass (98 at handoff).

## Step 2 — Audit the whole Unity client (findings first, then fix)

Walk the project with the owner, screen by screen, in Play mode (Game view at 1920×1080, 2400×1080 and 1600×1200 to check
letterboxing and safe areas). For each item record PASS / FIX / OPEN in a findings list before changing code.

- **Entry flow**: Boot → Studio → Title (tap-to-start, sign-in, settings) → Prologue (no skip on first view) → Story T-1..3
  (portraits, AUTO/SKIP/VOICE, subtitles) → Battle (AUTO, skill cards, targeting, VFX, result) → Finish (patch progress,
  restart). Compare timings and text with the TS scenes.
- **Hub screens** (all on `UomdHubScreen`): Home, Chapters (campaign node play), Roster, Companion, Team, Armory, Summon,
  Invitations, Shop, Purchase history, Account (+ settings), Errands, Deeds, Mail, Profile, Saved actions, Archive, Trials,
  Notices, patch strip. The cloud capture ran signed out, so every signed-in layout is unverified: sign in on a device or
  with a staging account and check each screen with real data. Look for overlapping text, labels not fitting plaques,
  scroll areas, modal layering, toasts, empty states, error states (offline, 401, `feature_disabled`).
- **Code review** with the `unity-architect`, `unity-csharp-reviewer` and `security-reviewer` agents on everything under
  `Assets/_UOMD/Scripts` changed since `ccb45bb`: awaits without `IsCurrent(generation)`, writes with the wrong
  `idempotent` flag (strict schemas reject an unexpected `requestId`), per-frame allocations, leaks of textures/handlers on
  screen exit, JNI handles, IL2CPP stripping of DTOs, culture-dependent number formatting (use invariant culture).
- **Android**: build an APK/AAB from the Editor (`UOMD` build menu or `unity_ci.ps1 build`), install on the owner's phone if
  connected (`adb`), check Google sign-in → session survives app restart (fixed in `19dee46`), patch download, back button,
  notch/safe area, 60 FPS on the battle.

## Step 3 — Fix, in this priority

1. Anything the 6.3 upgrade broke; console errors; failing tests.
2. Defects found in Step 2 that a player hits on the first-install path (entry flow, Home, Chapters, Account).
3. Layout defects on the hub screens with real data.
4. Small, local items from the open list if time allows — otherwise leave them for Argon with a precise note:
   Google Play checkout + rewarded ads (BUY/WATCH disabled until verify-with-retry and restore are ported from
   `net/store.ts`), the operation journal (`net/operations.ts`), server-sessioned campaign battles
   (`POST /progress/battle/start` + submit), world-map hub (first chapter patch), locales, Companion chibi pose preview,
   VFX additive light + ultimate cut-in, U-2b device-side `validateContentSet`, Phase C staging publication (needs an Access
   service token or a Control Center publish by the owner), B-SIGNING (owner's upload key).

Every fix: port from the TS oracle where it exists, add or adjust a headless test for pure logic, keep diffs small.

## Step 4 — Verify and deliver

- `npm run verify`, `npm run test:unity-logic`, `npm run check:unity-compile`, Unity EditMode (`run_tests`), and a Play-mode
  walkthrough of the entry flow. If a device was used, note the model and Android version.
- Record the build for the Control Center: `node tools/record_unity_build.mjs <path/to/uomd.aab>`; publish fresh screens
  if you captured them (`node tools/publish_unity_screens.mjs <dir>`).
- Update `docs/NEXT_STEPS.md` (new L-1 entry: what was verified, fixed, still open) and `docs/DEV_TRACKER.json`.
- Commit in reviewable steps (Conventional Commits, trailer as configured), push to `main` per D-32, watch the Workers
  Builds check runs on the commit.

## Step 5 — Activate the handoff to Gemini Argon (D-33)

Only after Step 4 is green and pushed:

1. Fill the "State at handoff" section of `docs/handoff/ARGON_UNITY_HANDOFF.md` with the facts of this pass (commit, editor
   version, test counts, device results, open items in priority order).
2. `docs/DECISIONS.md`: mark D-33 **active** with the date and the handoff commit.
3. Switch the entry points: `AGENTS.md` (Argon's entry point) and `CLAUDE.md` say Argon owns operations from that commit;
   README checkpoint line and §7 point to the Argon handoff (keep README the single master prompt — edit it, do not fork it).
4. Commit "docs: activate D-33 handoff to Gemini Argon", push, and tell the owner in Turkish what Argon should start with.
