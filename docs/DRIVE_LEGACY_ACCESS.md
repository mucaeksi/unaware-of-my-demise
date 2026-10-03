# Google Drive LEGACY Access

Phase 1.5 of the master execution prompt. Verified **2026-10-03** through the
connected Google Drive MCP integration (not a web fetch, not a mounted
filesystem). The archive was only read; nothing in Drive was created, moved,
renamed, modified, shared or deleted.

LEGACY folder: `LEGACY` — id `1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy`
(owner = project owner account; created 2026-10-01).

## DRIVE_ACCESS_STATUS

| Field | Status | Evidence |
|---|---|---|
| CONNECTOR_STATUS | VERIFIED — Google Drive MCP connected and authenticated | `get_file_metadata(1oe_…)` returned folder metadata |
| FOLDER_ACCESS | VERIFIED | `search_files(parentId = '1oe_…')` lists children |
| NESTED_FOLDER_ACCESS | VERIFIED | listed `assets/`, `narrative/`, `build/`, `Claude outputs/` children |
| SEARCH_STATUS | VERIFIED with caveats — `parentId`, `mimeType`, `title` queries work; result pages are small and paginated (`nextPageToken` even on short pages); there is no recursive "descendant of" query, so traversal is folder-by-folder | multiple `search_files` calls |
| FILE_RETRIEVAL_STATUS | VERIFIED for text and small binaries; LIMITED for large binaries (see LIMITATIONS) | see table below |

### Verified retrieval by file type

| Type | Method | Result | Status |
|---|---|---|---|
| Markdown (`text/markdown`) | `read_file_content` | plain text returned (`assets/README.md`) | VERIFIED |
| Markdown | `download_file_content` | base64 of exact bytes (`README.md`, 11.5 KB) | VERIFIED |
| Python source (`text/x-python`) | `download_file_content` | base64 of exact bytes (`main.py`) | VERIFIED |
| Small binary / zip (`application/x-zip`) | `download_file_content` | base64, valid `PK\x03\x04` header (963 B Gradle cache entry) | VERIFIED |
| JPEG | `read_file_content` | empty text (no OCR/vision description) | UNREADABLE as text |
| JPEG / PNG | `download_file_content` | VERIFIED 2026-10-03: 19 PNGs of 0.5–6.3 MB transferred byte-exact (size + id + full ffmpeg decode; embedded `uomd_*` chunks intact) | VERIFIED |
| WAV / MP3 / OGG | `download_file_content` | VERIFIED 2026-10-03: MP3 0.5 MB and 2.9 MB, OGG 1.6 MB transferred byte-exact, ffprobe OK | VERIFIED |
| APK (86.7 MB) | metadata only | not transferred | UNREADABLE_IN_CURRENT_ENVIRONMENT (size) |
| PDF / Office / Google Docs | none encountered yet in LEGACY traversal | — | UNVERIFIED |
| Archives (zip/7z/tar) | small zip downloadable; extraction only practical for small archives | — | PARTIALLY_VERIFIED |

### VERIFIED_FILE_TYPES
`.md`, `.py`, small binaries (zip)

### UNVERIFIED_FILE_TYPES
`.pdf`, `.docx`, `.xlsx`, Google Docs/Sheets (none found yet), large images, audio content

### UNREADABLE_FILE_TYPES
Images as text (no vision via `read_file_content`); very large binaries (APK
86.7 MB) because content arrives as base64 inside the model context.

## LIMITATIONS

1. ~~Binary content is returned as base64 into the model context.~~
   **Resolved 2026-10-03:** results larger than the tool-output limit are
   saved by the harness to a session file instead of entering the context;
   they are decoded in the sandbox (`drive_decode.py` pattern: verify Drive id
   and `fileSize`, then sha256). Small results still arrive inline.
   **Size cap:** a 6.3 MB file (8.4 M base64 chars) transferred fine; the
   10.3 MB git pack exceeded the MCP message limit and dropped the connection
   (2026-10-03). Practical per-file ceiling ≈ 6–7 MB. Files under ~20 KB
   return inline (into the model context); migrating many small files this
   way is costly and a re-typing error is undetectable without a Drive
   checksum (none is exposed). Bulk path: OQ-010.
   Original note: Images
   (≈150–500 KB) and audio (≈0.1–4.5 MB) are technically retrievable but
   transferring them consumes large amounts of context and they cannot be
   streamed into the sandbox filesystem directly. Consequences:
   - image dimensions/alpha, audio duration/sample rate are derived only when a
     file is deliberately transferred; otherwise only name/size/time metadata
     are recorded.
   - legacy visuals are reference-only per project policy (regenerate from
     scratch), so bulk transfer is not required.
2. **No recursive search.** Each folder must be listed individually.
3. **Pagination quirk.** Some pages return few items plus a `nextPageToken`;
   every listing must be paged until exhausted.
4. **Throughput.** Most `search_files` queries return ~5 items per page
   regardless of `pageSize`, and file bodies arrive base64-encoded inside the
   model context (each migrated file passes through the context twice:
   download + write). Enumerating and byte-exact migrating the LEGACY Godot
   project, content packs and tools (several hundred files) through this
   channel is possible but slow and expensive. Preferred bulk path: OQ-010.
5. Tool/build noise (`.git/`, `.venv313/`, `.mypy_cache/`, `.ruff_cache/`,
   `.pytest_cache/`, Gradle caches under `build/`/`game/.godot`) is
   inventoried at folder level only and classified `ARCHIVE_IN_DRIVE`.

## REQUIRED_USER_ACTIONS

0. **CRITICAL — sharing:** `get_file_permissions` on the LEGACY folder returns
   `{role: writer, type: anyone}` plus the owner. Anyone with the link can
   modify/delete LEGACY files and read `narrative/.secrets/`. Set link sharing
   to *Restricted*. (Verified 2026-10-03; Claude did not change it — permission
   changes are an owner action.) A Drive API v3 call with the proxy's API key
   returns 401, so link sharing is not needed for Claude's access.
1. **Security:** the archive contains `narrative/.secrets/`
   (id `1iLJTkOwBhMTXL6OdyyKqrUMvZ9jVy6e3`). Its contents were deliberately
   not opened. If it holds live credentials (API keys, keystores, tokens),
   rotate them and remove them from Drive. Claude will not read it.
2. Optional, to enable full binary inspection: none required for the current
   plan (visuals are regenerated). If exact legacy audio needs to be migrated
   later, a per-file transfer will be done case by case.

## Top-level LEGACY layout (verified listing)

| Folder / file | Drive id | Notes |
|---|---|---|
| `README.md` (11.5 KB) | `17MK5JQCp3Nnt_SMhjikjR3O_HjKPzls7` | legacy project overview — retrieved |
| `CLAUDE.md` (8.8 KB) | `1pBY0OZcC2o40n1m1v1ocNhe6bXgJSG9v` | legacy agent rules |
| `Unaware_of_My_Demise_Part1_GDD.md` (96.6 KB) | `17pi9ULybDLxKHaRtzQoUhlXaSLql_ZHn` | Part I GDD |
| `README_ANDROID.md`, `main.py`, `buildozer.spec`, `pyproject.toml`, `requirements-*.txt`, `Dockerfile.server`, `.env.example`, `.gitignore`, `.gitattributes` | — | Python/Kivy era root files |
| `game/` | `1sUuCQc1RMcQn1xBhMPEwxvK2OwCAJZuN` | legacy Godot 4.7 port |
| `content/` | `1simd_nzO6ukqoCXHQNwiSesFbmOIlEiD` | generated JSON data packs |
| `docs/` | `1ul6O03C01Bjhc7NOVf1ereb9_L3Oyt0D` | design/canon/economy/decision docs |
| `narrative/` | `1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK` | story team workspace: `art/`, `audio/`, `tools/`, `archive/`, `.secrets/` |
| `tools/` | `1bVaM5WVAR2wdv2s5QMjzCgt_sw65fM0P` | content builder/validator/parity tools |
| `assets/` | `1SVNqsHt0ePaEy3e-m2OT_1Ze8KUDnCYH` | asset README (+ further children) |
| `Claude outputs/` | `1XyiTLp_jvPV8LHp3bJVdDU3GMN86SrLo` | previews, voice/BGM previews |
| `server/`, `backend/`, `core/`, `game_logic/`, `client/` | — | Python reference implementation |
| `parity/`, `tests/` | — | golden fixtures, test suite |
| `addons/`, `android_src/`, `recipes/`, `archive/`, `.github/` | — | |
| `build/` | `1yKlklTTNStExf74MVY_0XULlB0SJRoNl` | `uomd-debug.apk` (86.7 MB), `verify/`, `ui_preview/` |
| `.git/`, `.venv313/`, `.mypy_cache/`, `.ruff_cache/`, `.pytest_cache/` | — | tooling noise → `ARCHIVE_IN_DRIVE` |

The deep content audit is recorded in `docs/LEGACY_AUDIT.md`.
