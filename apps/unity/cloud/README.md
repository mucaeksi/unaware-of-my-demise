# UOMD Unity client — cloud bring-up

The Unity project in `apps/unity/` was first opened by Unity in the 2026-10-24 cloud session, which generated and committed its
`.meta` files, `ProjectSettings/*.asset` and `packages-lock.json`. This folder turns opening, testing, building and capturing the
project into a repeatable batch pipeline. Working in a local Unity Editor: see [../LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md).

## 0. Checks that need no Unity licence (run these first)

| Command | What it proves | What it does not prove |
| --- | --- | --- |
| `npm run test:unity-logic` | The engine-free assemblies (`Logic/Uomd.Logic.sln`: Contracts, pure Core, Combat, StoryRunner) build under Unity's limits (C# 9, .NET Standard 2.1, asmdef boundaries) and the EditMode parity tests pass against the TypeScript golden vectors. Seconds; the cloud session hook installs .NET 10. | Anything that touches `UnityEngine` at runtime. |
| `npm run check:unity-compile` | Every `apps/unity` asmdef compiles against the real `UnityEngine`/`UnityEditor` assemblies of the pinned editor, and `Packages/manifest.json` asks for the exact versions the editor bundles (URP, ugui, test-framework…). Streams the public editor archive once into `~/.cache/uomd-unity-ref/<version>` (~4.5 GB streamed, ~46 MB kept). `Uomd.Editor` sees URP through signatures copied from URP 17.3.0. | Asset import, serialization, shader compilation, IL2CPP, Gradle, running tests inside Unity. Those still need `unity_ci.sh` on a licensed editor. |

2026-10-24 result: 10/10 asmdefs compile with 0 errors on 6000.0.58f2 after fixing `BannerDto` (CS0509) and aligning the manifest (`URP 17.0.3` does not exist in any registry; the editor bundles 17.0.4, and test-framework 1.5.1).

The first real import then found three errors this check could not see, and the check now catches each of them:

- A built-in module that ships as an optional package (`UnityEngine.AndroidJNIModule.dll` ↔ `com.unity.modules.androidjni`) is only
  visible when that package is in the manifest; Unity reports CS1069 otherwise. The check references only the module DLLs enabled
  by `Packages/packages-lock.json` (or the manifest's built-in dependency closure before the first import).
- `Renderer2DData` lives in `Unity.RenderPipelines.Universal.2D.Runtime`, not in `Universal.Runtime`. The URP signatures are split
  per assembly, so an asmdef has to reference the right one.

## First licensed run (2026-10-24, cloud session)

`install_unity_linux.sh` → `unity_ci.sh import` → `unity_ci.sh test` → `unity_ci.sh capture` → `publish_unity_screens.mjs` all ran
in the Claude Code cloud container with Unity Personal activated from `UNITY_EMAIL`/`UNITY_PASSWORD`. Import: 0 compiler errors,
0 warnings. EditMode: 10/10 inside Unity. Capture: 24/24 screens. Disk: the editor with the Android module, SDK and NDK takes about
13 GB; the imported `Library/` adds about 1.5 GB.

Capture notes:

- The player runs under Xvfb without a window manager, so its window never has focus. A desktop player pauses its frame loop
  without focus; capture mode therefore sets `Application.runInBackground` (`UomdBootstrap`).
- The capture player is a release build, so the screenshots carry no Development Console (it showed the FMOD "no audio device"
  error on every screen) and no watermark.
- `UOMD_CAPTURE_TIMEOUT` (seconds, default 900) stops a player that hangs instead of blocking the session.

## Cloud session quick path (no Unity Hub)

```bash
bash apps/unity/cloud/install_unity_linux.sh          # editor from ProjectVersion.txt + Android module/SDK/NDK r27c/OpenJDK, from Unity's release API
bash apps/unity/cloud/unity_ci.sh import               # needs UNITY_EMAIL + UNITY_PASSWORD in the environment
bash apps/unity/cloud/unity_ci.sh capture              # Linux player under Xvfb saves one PNG per screen
node tools/publish_unity_screens.mjs                   # -> docs/evidence/unity-*.webp, shown on the Control Center Development page
```

Licence: set `UNITY_EMAIL` and `UNITY_PASSWORD` in the cloud environment's settings (GitHub repository secrets do not reach this
session). `unity_ci.sh` then runs the editor's Licensing Client with `--activate-all --include-personal`, which activates the free
Personal edition on this machine. Hub's `UnityEntitlementLicense.xml` from another PC is machine-bound and does not work here; an
account with two-factor sign-in cannot be activated headless. Pro/Plus: `UNITY_SERIAL`.

## Android AAB in the cloud session (2026-10-24)

`unity_ci.sh build` produced the first AAB (debug-signed, 145.7 MB, IL2CPP ARM64, API 24–35); `node tools/record_unity_build.mjs`
publishes its facts to `docs/evidence/unity-android-build.json` for the Control Center. What the build step handles by itself:

- **Maven Central rate limit.** The session's shared egress IP gets 429s and fake 404s (1 byte, `Retry-After`) from Maven Central;
  Gradle caches them as "artifact not found". The step starts `maven_retry_proxy.py` on `127.0.0.1:8765` and installs
  `maven-retry-proxy.init.gradle`, which points Maven Central and the Plugin Portal at it. It fetches from the same official hosts,
  two requests at a time, with backoff, into `~/.cache/uomd-maven`. `UOMD_MAVEN_PROXY=off` disables it.
- **Proxy CA for Gradle.** Unity starts the Gradle daemon with only `-Xmx`, so `JAVA_TOOL_OPTIONS` never reaches it (TLS fails with
  PKIX). The step copies the trust-store and HTTPS-proxy flags into a generated block of `~/.gradle/gradle.properties` and stops
  old daemons, which keep the proxy port and CA they started with.
- **Signing.** Without `UOMD_KEYSTORE_FILE`/`UOMD_KEYSTORE_PASSWORD`/`UOMD_KEY_ALIAS`/`UOMD_KEY_PASSWORD` the AAB is debug-signed and
  Play rejects it (B-SIGNING). `UOMD_VERSION_NAME`/`UOMD_VERSION_CODE` set the version (default 1.0 / 1).

Size: Unity cannot decode WebP, so `npm run export:unity` writes a JPG (q92, 4:4:4) next to every opaque WebP and a PNG next to every
WebP with transparency, lists them in `uomd_base/decodable.json` (read by `UomdMediaLoader`) and removes the WebP files from the copy
inside the Unity project. The base art went from 78 MB to 25 MB. Remote patches (U-2) keep their WebP bytes (SHA-256 verified as published); the Android player decodes them with BitmapFactory (`UomdImageBridge`), while the Editor cannot, so capture runs keep patch downloads in memory and show the embedded art.

## 1. Install (once per VM)

| Host | Command |
| --- | --- |
| Ubuntu 22.04/24.04 x86_64 | `bash apps/unity/cloud/setup_linux.sh` (Hub, Editor `6000.3.27f1`, Android module + SDK/NDK/JDK, API 35, Node 22) |
| Windows Server/10/11 | Unity Hub → Editor `6000.3.27f1` (changeset `672d562a42a7`) + Android Build Support (tick OpenJDK and Android SDK & NDK), Node 22 |
| Docker | `unityci/editor:ubuntu-<ProjectVersion>-android-3` (GameCI image) + Node 22 |

The editor is pinned to **6000.3.27f1** (Unity 6.3 LTS; moved from 6000.0.58f2 in the L-1 local pass, 2026-10-25). Never go
back to `6000.0.41f1` or older: Unity's October 2025 security advisory (CVE-2025-59489) affects those builds. Update
`ProjectSettings/ProjectVersion.txt` (via the Editor) if you change it, then rerun `npm run check:unity-compile`.

## 2. License

Batchmode needs an activated seat on the VM:

- **Unity Pro/Plus serial:** `Unity -batchmode -quit -nographics -serial <SERIAL> -username <EMAIL> -password <PASSWORD>`.
  Return the seat with `-returnlicense` before you destroy the VM.
- **Personal:** `UNITY_EMAIL` + `UNITY_PASSWORD`; `unity_ci.sh` activates it with the editor's Licensing Client (`--activate-all --include-personal`).
- **Build Server / floating:** set up `services-config.json` as described in Unity's licensing server docs.

Never commit credentials. Pass them through the VM's secret store or environment.

## Claude Code on the web (GitHub repo) + Cloudflare

The project setup is: Claude Code works on the GitHub repo, and Cloudflare hosts everything else (Workers, D1, R2, Access, Workers
Builds). Unity is the only part that cannot run on Cloudflare, so it must run inside the Claude Code cloud session (or any Linux VM).

- **Environment setup script:** `bash apps/unity/cloud/setup_linux.sh`. It works both as root and with `sudo`, and it is
  non-interactive. Unity takes about 8–12 GB of disk, so pick an environment that has that space and keeps it between sessions.
  Otherwise every session reinstalls Unity.
- **Network allowlist** (Limited/custom network mode): `hub.unity3d.com`, `download.unity3d.com`, `public-cdn.cloud.unity3d.com`,
  `core.cloud.unity3d.com`, `license.unity3d.com`, `activation.unity3d.com`, `api.unity.com`, `packages.unity.com`,
  `download.packages.unity.com`, `dl.google.com`, `maven.google.com`, `repo.maven.apache.org`, `services.gradle.org`,
  `plugins.gradle.org`, `deb.nodesource.com`, `registry.npmjs.org`, `github.com`, `objects.githubusercontent.com`.
- **License:** set `UNITY_EMAIL` and `UNITY_PASSWORD` in the environment; `unity_ci.sh` activates Unity Personal through the
  editor's Licensing Client (verified 2026-10-24; Hub is not needed). Pro/Plus: add `UNITY_SERIAL`. Accounts with two-factor
  sign-in cannot be activated headless.
- **Cloudflare is unchanged:** Workers Builds still runs `npm run build -w @uomd/game`. That runs `tools/export_unity_bundle.ts`
  (PNG siblings need `sharp`, which is already a root dependency) and serves `apps/unity/CloudflareGatewayDist` from
  `apps/api/wrangler.game.jsonc`. The Unity AAB is built in the Claude Code session and uploaded to Play. It is never built on
  Cloudflare.

## 3. Run

```bash
git clone <repo> && cd unaware-of-my-demise
bash apps/unity/cloud/unity_ci.sh import   # npm run export:unity → first import/compile → UOMD/Apply Project Setup
bash apps/unity/cloud/unity_ci.sh test     # EditMode parity tests (C# vs TypeScript golden vectors)
bash apps/unity/cloud/unity_ci.sh build    # Android AAB → apps/unity/Builds/Android/uomd.aab
```

On Windows, use `powershell -File apps/unity/cloud/unity_ci.ps1 <step>`. Logs go to `apps/unity/Logs/ci/`, and the scripts print every
`error CS####` they find.

If `import` fails with compiler errors, fix them and run it again. Static review alone cannot replace a real compiler.

## 4. Commit back after the first successful import

Commit these so that GUIDs stay stable for everyone:

- every new `*.meta` under `apps/unity/Assets/`
- `apps/unity/ProjectSettings/*.asset`
- `apps/unity/Packages/packages-lock.json`
- `apps/unity/Assets/_UOMD/Settings/` (URP 2D pipeline + Renderer2D assets made by `UomdProjectSetup`)

`Library/`, `Temp/`, `Logs/`, `Builds/`, `UserSettings/` and `Assets/StreamingAssets/uomd_base/` stay ignored. The last one is
regenerated by `npm run export:unity`.

## What the pipeline sets up

| Piece | Where |
| --- | --- |
| Runtime entry point (no scene script GUIDs needed) | `Assets/_UOMD/Scripts/Scenes/UomdBootstrap.cs` creates `UIDocument` + `UomdSceneRouter` with runtime `PanelSettings` |
| UI theme | `Assets/_UOMD/Resources/UI/UomdRuntimeTheme.tss` (Unity default theme + `uomd-tokens.uss`) |
| URP 2D, build scenes, Android IL2CPP ARM64 landscape, API 25–35 (Unity 6.3 minimum is 25) | `Assets/_UOMD/Editor/UomdProjectSetup.cs` (menu **UOMD → Apply Project Setup**) |
| Android build + signing from env | `Assets/_UOMD/Editor/UomdBuild.cs` (`UOMD_KEYSTORE_FILE`, `UOMD_KEYSTORE_PASSWORD`, `UOMD_KEY_ALIAS`, `UOMD_KEY_PASSWORD`, `UOMD_VERSION_CODE`, `UOMD_VERSION_NAME`) |
| Native Java bridges + Gradle deps (Credential Manager, Billing 8, Ads 24, UMP 3) | `Assets/Plugins/Android/UomdNative.androidlib/` |
| WebP → PNG siblings (Unity cannot decode WebP) | `tools/export_unity_bundle.ts` `writePngSiblings` + `Core/UomdTextureLoader.cs` |
| Parity tests | `Assets/_UOMD/Tests/EditMode/` with vectors from `npx tsx tools/export_unity_parity_vectors.ts` |
