# Handoff — GPT 6.1 Sol rebuilds Unaware of My Demise in Unity (2026-10-26)

Owner decision (2026-10-26): the whole project moves to **GPT 6.1 Sol**. Sol rebuilds the game from the beginning in Unity,
brings the existing work over piece by piece, regenerates every approved visual asset with its own image engine, and keeps
producing voice and music with the Gemini API. This note is the starting map, written by Claude Opus 5.5 at handoff. It
does not replace [README](../../README.md) or [DECISIONS](../DECISIONS.md); record this handoff there as the next decision.

## State at handoff

- `main` at `00e9d725` (local, not yet pushed by the owner). Working tree clean.
- `npm run verify` passes (lint, typecheck, all workspace tests, content check: 205 files reproduced exactly).
- Unity 6.3 LTS `6000.3.27f1`: reference compile 0 errors, EditMode 99/99, headless logic tests 98/98.
- The owner pushes to GitHub; agents do not push. A push to `main` deploys staging through Cloudflare Workers Builds.

## Where things are

| Path | What |
|---|---|
| `apps/unity/` | current Unity client (C#, URP 2D, Runtime UI Toolkit built in C#) |
| `packages/` | TypeScript engines: `combat`, `story`, `patch`, `economy`, `content-schema` — the behavioural oracle |
| `apps/api/` | Cloudflare Workers + D1 backend (accounts, economy, gacha, server battle re-simulation, patch manifests) |
| `apps/admin/` | React Control Center |
| `content/base/` | base release `rel_0001`; `content/approved_art/` approved art and its entries; `content/provenance.json` |
| `narrative/` | canon (story, characters, locations, VO scripts); `narrative/15_Art_Workbench/` art drafts and mockups |
| `art_specs/`, `docs/media/ART_BIBLE.md` | generation specs and the visual contract (palette, identity anchors, keying rules) |
| `docs/design/` | UI v2 brief and prompts (D-34); the owner stopped this direction on 2026-10-26 — reference only |

## Must not break, whatever is rebuilt

1. **Server battle parity.** The Worker re-simulates every battle; the client engine must stay bit-exact with
   `@uomd/combat` (Mulberry32, round-half-up, stat math in `docs/combat/STAT_MATH.md`). Vectors:
   `tools/export_unity_combat_vectors.ts`, `export_unity_parity_vectors.ts`, `export_unity_patch_vectors.ts`.
2. **Content arrives only as signed data patches** (ES256), never as code. Every file passes `packages/content-schema`
   (`npm run check:content`); videos are WebM and at most 20 MiB each.
3. **Canon.** `narrative/` is the source of story, names and text; never invent UI text, lore or canon IDs.
4. **Economy transparency.** Exact cost, balance, rates and pity visible before any spend; server is authoritative.
5. **Secrets** only from the environment or a local `.env` (git-ignored); never in code or commits.

## Assets and generation

- Approved visuals: `content/approved_art/entries/*.json` + `content/base/art/art_manifest.json`; identity and colour rules
  in ART_BIBLE §1–§4. New art enters through `tools/ingest_art.ts` so provenance stays complete.
- Voice and music (Gemini): `tools/record_game_vo.py`, `build_all_voiceovers.py`, `build_campaign_trio_vo.py`,
  `generate_phase1_music_lyria35.py`, `generate_main_theme_lyria35.py`, `build_campaign_music_suite.py`. These Python tools
  read `.env` themselves. `tools/gen_image.ts` reads `GEMINI_API_KEY` from the process environment only.
- `.env` keys the tools look for: `GEMINI_API_KEY` (and `GOOGLE_API_KEY` as an alias in the music/VO tools),
  `GOOGLE_CLOUD_PROJECT` (`record_game_vo.py`); release tooling: `UOMD_ADMIN_JWT`, `CF_ACCESS_CLIENT_ID`,
  `CF_ACCESS_CLIENT_SECRET`.
- Spending limit: `content/budget/media_budget.json` (20 USD per month, 3 USD per batch); larger spends need the owner.

## Known issues found in the last review

- `apps/unity/.../UI/UomdGothicVfx.cs` (1161 lines) runs ten 33 ms style-writing loops; profile on a phone before keeping it.
- ~100 UI images in `apps/unity/Assets/_UOMD/Resources/UomdUI/` were added without `ingest_art` provenance (Kenney CC0
  packs plus generated art).
- The prologue WebM (`content/base/video/`) has subtitles and captions burned in with a plain font; the owner wanted a
  subtitle-free video with in-game, localizable subtitles. Clean per-scene segments exist only in Antigravity's local
  scratch folder, not in the repo.
- Antigravity's "2K" chibi sheets were 1K images upscaled; they were not committed. The current chibi atlases in
  `content/base/art/atlas_*.webp` are native ~2K.
- `HomePrototypeScreen` and `BattleStage25DPrototype` are Editor-only design prototypes (the latter reads workbench images).
- Antigravity found the Google Flow prologue clips by scanning the browser cache and history; avoid repeating that.
