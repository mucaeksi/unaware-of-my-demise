# Engineering decisions (this session)

| ID | Decision | Why |
|---|---|---|
| D-01 | Legacy Neon/Hyperdrive Workers and R2 buckets are left untouched; new Workers are named `uomd-game-*` / `uomd-admin-*` | Production data and owner approval rules; README forbids a second DB but deletion is destructive |
| D-02 | Content signatures are ES256 (P-256) | Ed25519 is missing in older Android WebViews |
| D-03 | Admin auth = Access JWT verified in the Worker + role table, fail closed; a dev-only JWKS override exists for local tests | README: no auth bypass; tests use explicit test identities |
| D-04 | Rollback/kill = publish a new, higher generation | Clients accept only increasing generations; avoids downgrade attacks |
| D-05 | Vertical slice uses the approved legacy tutorial art from Git history (commit `25dc0b2`), no new generation | No approved generation budget; avoids duplicating art with mismatched identity |
| D-06 | Interim SFX are synthesized in code | Real SFX need a verified Google workflow (README) |
| D-07 | `@cloudflare/vitest-plugin` replaces the deprecated `vitest-pool-workers` | upstream rename |
| D-08 | `.npmrc legacy-peer-deps=true` | npm 10 arborist crashes on the peer graph; versions are pinned explicitly |
| D-09 | Apps pin Vite 7.3.7; Vitest 4 pulls Vite 8 for tests only | Phaser/React builds verified on 7; revisit when consolidating |
| D-10 | Combat rule ambiguities resolved as listed in COMBAT_RULES.md | Needs owner confirmation |
| D-11 | 2026-10-10 owner: Context7 removed (MCP server, skill, ZIP); bootstrap excludes it | free tier was quota-limited without a key; replaced by installed type definitions + official Phaser skills |
| D-12 | 2026-10-10 owner: all Godot material removed; Phaser 4 only; the 10 third-party discipline skills and their ZIP removed | they carried GDScript/Godot guidance; history kept on the read-only archive branch `archive/godot-era` |
| D-13 | 2026-10-10 owner: legacy Neon/Hyperdrive/Workers stack retired, D1 only | follows the Cloudflare-only decision |
| D-14 | 2026-10-10 owner: all visuals/audio regenerated with Google models; old media archived and used only as references | `content/base` art is provisional until replaced through data patches |
| D-15 | 2026-10-10 owner: Control Center behind Cloudflare Access (account members = owner) | created via API with the owner's authorisation |
| D-16 | 2026-10-10 owner: push every verified step to `main`, keep it tidy, archive branch before deleting | squash-merged PR #36 as the first example |

- **Paid media guard (2026-10-10):** generation is blocked by default (`approved_usd: 0`). Approval is a reviewed commit of `content/budget/media_budget.json` by the owner; reservations/settlements are appended to the same file so spend is auditable in Git.
