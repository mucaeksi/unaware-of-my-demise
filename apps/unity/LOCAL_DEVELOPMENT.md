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

1. Unity Hub → Editor **6000.0.58f2** (changeset `92dee566b325`) with **Android Build Support** (SDK/NDK + OpenJDK). The
   version is pinned in `ProjectSettings/ProjectVersion.txt`; a different editor version rewrites project files.
2. `git pull origin main`, then `npm ci` and `npm run export:unity` at the repository root (writes
   `Assets/StreamingAssets/uomd_base/`, which is git-ignored).
3. Open `apps/unity` in Unity Hub; the entry scene is `Assets/_UOMD/Scenes/UomdMain.unity`. Play mode talks to the staging
   API (`UomdSceneRouter.apiBaseUrl`); Google sign-in, Play Billing and ads run only on an Android device.
4. Batch equivalents: `powershell -File apps/unity/cloud/unity_ci.ps1 test|build` (EditMode tests, AAB).

## Before every push

- `npm run verify` (lint, typecheck, tests, content check) and `npm run test:unity-logic` (headless C# parity tests).
- EditMode tests inside Unity (Test Runner, or `unity_ci.ps1 test`).
- New `.cs` files keep their Unity-generated `.meta`; commit `Packages/packages-lock.json` and `ProjectSettings/*.asset`
  changes together with the code that caused them. `Library/`, `Temp/`, `Logs/`, `UserSettings/`, `Builds/` stay ignored.
- Fetch first and fast-forward only; never force-push `main`.
