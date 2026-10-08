# Project organization and opening extraction — 2026-10-08

Local preparation is complete. `game/` remains the authoring project; `release/current/` holds one verified current source/artifact version. No GitHub push, deployment or store publication occurred. The existing Editor, game and reusable native Local UI Preview remain open.

## File discovery and boundaries

The local catalogue covers more than 6,100 Git-visible authored files with categories, hashes, feature tags and current AAB membership. [Project map](../PROJECT_MAP.md) gives feature-to-file entry points. `tools/project_catalog.py find <words> --scope active|aab|history` supplies exact paths quickly. `check` detects changed/added/removed source entries; updates regenerate the index automatically.

Resource paths, UIDs, source/reference originals and unrelated working-tree changes are preserved. Current tooling authority is `.codex/`. Historical `.claude/`, archived framework material and old deployment descriptions are explicitly labelled. Superseded README/toolchain/architecture/inventory originals are retained under `.archive/project-docs-20261008/`. Secondary Production and LEGACY originals remain read-only.

## Current test folder

`release/current/game/` contains authored inputs mapped from all 540 real base-PCK entries, plus the explicit native/export support needed for the Android build. Compiled scripts/resources map to their original source; imported textures/fonts map to raw assets and their settings. Shared executable registry/services/menu code remains necessary for patch/restart and normal content handling; main-story chapter payloads are excluded. The content registry is unchanged.

`FILE_INDEX.json` records file hashes, purposes and source hashes. `release.json` seals the index and records artifact identity and acceptance. Private config, keystores, editor/test addons, preview files, reference libraries, superseded writing-hand art and generation logs are excluded. Selected runtime art and required notices remain. Portable provenance copies replace personal generated-image paths with generation identifiers; originals are untouched.

Test artifact: `release/current/artifacts/game.aab`, 134,499,472 bytes, SHA-256 `ed8bbea01d640877214f4f7d481819afc0e0af9bd41d418e1164156498f2ea10`. Base PCK: 101,413,100 bytes, SHA-256 `bf41afc947e36c492ac4d0b991d7ddf7aec4247f80e29c533852f124fd30e50f`. These identify this review build only. Later successful updates replace them and update the manifest.

## Validation evidence

- Current-folder seal and upstream staleness checks passed; unexpected files and modified sources are rejected.
- Twelve release-integrity/native-packaging unit tests passed, including failed-install rollback, preservation of unmarked folders, private-input refusal, index/file tampering, stale source and missing native classes/registration.
- Actual exported opening runtime passed all three tutorial fights, 32 character/enemy pose lookups, round icons, ultimates, two paired illustrations and complete-arm checks. Main story, MCP config and superseded writing art were absent from the base.
- The separate clean-source rebuild has the same 540 entries; 520 runtime/config-independent entries match exactly. All 17 loaded scene graphs have matching nodes, properties and signal connections. Three engine configuration/cache entries and scene-internal IDs are intentionally regenerated.
- The local AAB debug signature and bundletool validation passed. Every AAB game-data entry agrees with the accepted base PCK. Native bridge, credential/sign-in, billing, ads and consent class descriptors and manifest registration are present.
- A clean standalone Android export exposed an early-quit issue: the exporter produced a structurally valid AAB without native dependencies. Removing the extra `--quit` fixed it. The final standalone wrapper passed signing, bundletool and native-packaging checks; the real incomplete bundle was correctly rejected by the new gate. The test folder's selected AAB retained native dependencies throughout.
- The live Godot preview was refreshed and captured; game logs contain no new errors. Native screenshot: `build/project-organization-20261008/native-preview.png`.

Complete raw evidence is under `build/project-organization-20261008/`, `build/aab-organization-clean-20261008/` and the dated `build/current-source-check-*/` folders. These are ignored local evidence, outside current. The generated current folder carries portable build, pack, source-rebuild, privacy and native-packaging acceptance reports.

## Asset and graph scope

The nonmutating asset audit measured 1,566 runtime-source assets and 251 narrative assets; 1,323 raster decodes, 270 SVG parses, 1,422 reference-collection hashes and 15 generated asset hashes passed. Duplicate groups are preserved, not automatically deleted. Three v001 prologue backgrounds remain actively referenced. Historical reference-lock paths are stale and the current owner direction supersedes their visual authority; current approved originals are preserved.

The initial asset audit compared an earlier pack and understated manifest inclusion. Direct inspection of the fresh PCK found two asset-generation JSON records with personal paths. All asset `SOURCE.json` and `provenance.json` records are now excluded from exports; portable review provenance remains in current's docs. No runtime script/data/scene references those source records.

Graphify native update and the Godot/project refresh helper were run after code changes. The helper retains full authored-file inventory, Godot structure, directions and parallel relations. Current measured coverage is in `graphify-out/coverage.json`; queries resolve the new current-build/materialization boundaries. Changed document semantics remain explicitly flagged, and hundreds of mostly framework/history documents lack semantic fragments. This is complete file inventory and structural coverage, not a claim of exhaustive semantic review or hidden-bug absence. No external semantic API was called. Native Gradle AST extraction reports a parser limitation; the actual Android build succeeds.

## Ongoing use

Run [Update-CurrentAAB.ps1](../../tools/Update-CurrentAAB.ps1) after each accepted game change before giving the owner the latest test AAB. It builds fresh by default, verifies and replaces current atomically, then updates the file catalogue. A failed rebuild preserves the last verified version. See [workflow](CURRENT_AAB.md).

Final voice/music, balance, gameplay/UI polish and owner-reported bugs remain future development work. These debug artifacts have not been accepted on an Android device or production-signed. Publishing source/binaries requires the owner's later instruction; binaries and caches are excluded by the snapshot's Git policy.
