# Catalog draft snapshots — R08-B1

R08-B1 stages a versioned catalog document and validates its references. It does not activate a release-scoped economic catalog. Existing game operations still read the editable D1 tables; R08-B2 must move those reads and transaction guards to the selected release before catalog-bearing releases may publish.

## Export and stage

In Control Center, open **Catalog → Summary → Export catalog snapshot**. Viewers may export definitions they can already inspect. Loading, failure/retry, counts, byte size and SHA-256 are visible; downloading does not change rules or players. The download is `economy.json`; place it at `catalog/economy.json` in a complete content directory.

Alternatively, the existing publisher can export and stage in one command:

```bash
npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" \
  --dir content/patches/rel_0003_part1_campaign --id rel_catalog_review \
  --channel staging --depends rel_current_staging --catalog-snapshot
```

Use existing Access authentication. `--depends` retains R08-A's same-channel snapshot composition. `--catalog-snapshot` fetches and verifies the export's bytes/hash/schema, adds the document to the upload set and creates an unsigned draft. It rejects a directory that already contains that path; manually authored catalog documents can instead use the normal publisher without the flag. The 512-file limit includes the catalog.

Combining `--catalog-snapshot` with `--publish` fails before uploads. Every API publication of a catalog-bearing draft returns `409 catalog_activation_unavailable` before signing, publication audit or pointer changes. Rollback into a catalog-bearing source is also blocked. Emergency kill remains available. Draft objects remain inaccessible through the public object endpoint, and later edits of the live D1 tables do not rewrite the stored draft document.

## Document and authority

`GET /admin/api/catalog/snapshot` performs eight SELECTs in one D1 batch/transaction, orders rows by stable IDs, validates a closed schema and returns canonical JSON with its SHA-256, UTF-8 byte count and row counts. Query limits read one row beyond each schema cap, so excess rows fail rather than disappear. Unknown config kinds and malformed stored data return explicit 503 errors without repair. `MAX_CATALOG_BYTES` bounds the document to 1 MiB; increasing this initial staging budget requires measured resource review.

The source tables are `characters`, `character_skills`, `item_defs`, `gear_defs`, `accessory_sets`, `weapon_types`, `banners` and `game_config`. The canonical seed exports 20 characters, 80 skill identities, 18 items, 258 gear templates, seven accessory sets, 20 weapon types and 12 banners, plus progression/gear/drop/task rules. Row audit/version bookkeeping, player records and credentials are excluded.

Skill mechanics remain in the release's compiled `UnitPack`; raw `character_skills.data_json` is uncompiled source and is not a second executable grammar. Catalog skill IDs/types/names and character names/stats/growth/role/element/rarity/formation must agree with that pack. The first catalog grammar admits the four supported character skill types. Source weapon banner tags are preserved as `source_banner_id`: for example, canon `hall_of_armaments` differs from executable banner `hall_of_armaments_weapons`. These tags are acquisition metadata; actual banner identity, kind, rarity and membership are validated through the declared banner configs and pools. No alias is guessed or rewritten.

The catalog grammar validates unique identities; character/skill/weapon-family/signature ownership; item kinds/caps; finite weapon/armor/accessory shapes, stat pools, sets, reroll and dismantle materials; banner configs/schedules/pools; and existing progression/drop/task schemas. Undefined signature-passive prose remains metadata; R06's explicit runtime rejection remains authoritative.

When `catalog/economy.json` is present, the shared content validator additionally checks rewards, drop tables and eligible gear pools, per-node boss-set pools, progression battle gates, recruitment selector items and loan equipment against that exact document, pack and chapter graph. Missing, retired or mismatched references fail before draft/file/audit writes. Prototype-inherited record properties do not count as declared drop-table identities. The only admitted catalog path is `catalog/economy.json`; unknown catalog files and documents above the byte budget fail closed. Worker draft checks and device semantic validation use this same implementation.

Catalog-free legacy releases retain their existing behavior. This opt-in staging contract does not imply that all legacy rewards or all other JSON kinds now have complete cross-resource validation. It does not automatically add a catalog to the embedded base or publish new heroes.

## Next acceptance

R08-B2 must load the chosen catalog in player catalog/roster, character progression, recruitment, gacha, gear, party/loan construction, drops and shared grants, with coherent transaction-time authority and existing original-result recovery. It must define bootstrap/current/allowlisted/historical behavior and freeze the relevant catalog/rule inputs. Only then remove the activation block and prove a new declared identity through recruit → grow → equip → summon → fight. Live draft editing, retirement/support workflows, complete grammar/capabilities, keys, quota/storage and signed-device acceptance remain separate requirements.

Verification is recorded in [DEV_TRACKER.json](DEV_TRACKER.json). All evidence is local unless a deployed version or signed device/build identifier is explicitly attached.
