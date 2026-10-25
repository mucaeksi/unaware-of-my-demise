# Developing the Unity client on a local machine

The game client builds locally. The backend, the Control Center and content releases never deploy from a local machine:
GitHub `main` stays the single source of truth, and Cloudflare Workers Builds deploys staging from it.

## What goes where

| Change | How it reaches players / the Control Center |
| --- | --- |
| Unity C# / scenes / settings (`apps/unity/`) | Commit → push `main`. The AAB is built from that commit (local Editor or `unity_ci.sh build`) and installed or uploaded to Play by hand. Record it for the Control Center with `node tools/record_unity_build.mjs <path/to/uomd.aab>` and commit `docs/evidence/unity-android-build.json`. The AAB file itself is never committed. |
| Backend (`apps/api`), Control Center (`apps/admin`), D1 migrations, seeds | Commit → push `main` → Workers Builds runs `npm run verify` and deploys the staging Workers (`tools/deploy_staging.sh`, migrations first). Never `wrangler deploy` by hand: a Worker without its migrations answered 500 on 2026-10-19. |
| Game content (story, encounters, art, audio under `content/`) | Commit → push `main`, then publish a signed release to a channel through the Control Center (or `tsx tools/publish_release.ts --admin <admin-url> --dir <content dir> --id <rel_id> --channel staging --publish` with `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` of an Access service token). Installed games download it as a patch; no new AAB is needed. The server signs the manifest; signing keys never leave Cloudflare. |
| Production / public Play release | Separate owner approval. |

## Local setup (Windows)

1. Unity Hub → Editor **6000.3.27f1** (Unity 6.3 LTS, changeset `672d562a42a7`) with **Android Build Support** (SDK/NDK +
   OpenJDK). The version is pinned in `ProjectSettings/ProjectVersion.txt`; a different editor version rewrites project files.
2. `git pull origin main`, then `npm ci` and `npm run export:unity` at the repository root (writes
   `Assets/StreamingAssets/uomd_base/`, which is git-ignored).
3. Unity Hub → **Projects → Add → Add project from disk** → select the **`apps/unity`** folder (the repository root is a
   monorepo, not a Unity project). The entry scene is `Assets/_UOMD/Scenes/UomdMain.unity`. Play mode talks to the staging
   API (`UomdSceneRouter.apiBaseUrl`); Google sign-in, Play Billing and ads run only on an Android device.
4. Batch equivalents: `powershell -File apps/unity/cloud/unity_ci.ps1 test|build` (EditMode tests, AAB). The script finds the
   editor under `C:\Program Files\Unity\Hub\Editor` or the Hub's custom install folder; `UNITY_PATH` overrides both.

## Claude Code ↔ Unity Editor (MCP for Unity)

The project ships the [MCP for Unity](https://github.com/CoplayDev/unity-mcp) integration pinned to v10.3.0: the Unity
package (`com.coplaydev.unity-mcp`, installed from `Packages/manifest.json` on first open; needs `git` on PATH) and the
`unityMCP` server in `.mcp.json`. Once per machine:

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python ≥ 3.10 is fetched by uv) so `uvx` is on PATH.
2. In Unity: **Window → MCP for Unity** → Transport **stdio** (the package defaults to HTTP; stdio starts its bridge itself).
   Do not use "Configure All Detected Clients" for Claude Code — `.mcp.json` already registers `unityMCP`.
3. Start Claude Code at the repository root with the Editor open; `/mcp` should list `unityMCP` as connected.
   Skills: `unity-mcp-workflow` (how this project uses it) and `unity-mcp-orchestrator` (+ its `UOMD-NOTE.md`).

## Before every push

- `npm run verify` (lint, typecheck, tests, content check) and `npm run test:unity-logic` (headless C# parity tests).
- EditMode tests inside Unity (Test Runner, or `unity_ci.ps1 test`).
- New `.cs` files keep their Unity-generated `.meta`; commit `Packages/packages-lock.json` and `ProjectSettings/*.asset`
  changes together with the code that caused them. `Library/`, `Temp/`, `Logs/`, `UserSettings/`, `Builds/` stay ignored.
- Fetch first and fast-forward only; never force-push `main`.
