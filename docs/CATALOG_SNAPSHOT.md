# Economic catalog snapshots — R08-B1 / R08-B2a

R08-B1 stages a versioned catalog document and validates its references. It does not activate a release-scoped economic catalog. R08-B2a binds the battle path to the selected catalog behind the existing activation block. Other game operations still read the editable D1 tables; those reads and transaction guards must migrate before catalog-bearing releases may publish.

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

## Battle runtime — R08-B2a

`loadReleaseCatalog` accepts an exact published release on the configured channel. Catalog-free legacy releases explicitly retain their live-table behavior. A declared catalog requires a complete snapshot with matching manifest/index hash, declared/object byte size, a maximum of 1 MiB, valid UTF-8, verified SHA-256 and the closed catalog schema. Missing index/object entries, corrupt bytes or invalid definitions fail explicitly; none falls back to live authoring data. Definitions remain request-local, with no channel-keyed cache. Loading a published definition is not economic admission; callers still apply `requireEconomic` and the transaction-time fence.

The exporter records the live gear role-map matching order as `config.gear.roleStatOrder`; canonical JSON key sorting must not change a multi-word role's first matching bonus. The order must contain each non-default key exactly once. An omitted order is accepted only when every declared character has an unambiguous result; ambiguous B1 drafts need a fresh export and draft, without rewriting stored objects. Owned and virtual equipment use the same explicit priority. Earlier B1 client validators reject this additional field; before catalog activation, require a compatible newly built reader through the client compatibility floor and signed-device checks.

Battle start uses this catalog for character base/growth/formation, progression and role-stat rules, equipped templates/set bonuses and deterministic virtual loan equipment. Ownership, character levels/ranks, equipment instances and rolled accessory stats remain player state in D1. Missing/retired catalog identities and incompatible instance slots fail admission. Compiled skills/rules still come from the same release's UnitPack; the resulting party remains frozen in the existing session.

Battle submission uses that exact release catalog for drop tables and eligible gear/boss pools, item stack caps, character rarity/duplicate grants, gear/accessory minting and task event definitions. Original claim recovery still precedes release/catalog loading. New start responses and recorded claims disclose `catalogSha256`; existing catalog-free and pre-upgrade results need no new field. The existing transaction-time account/release/session fences, revocation/kill floor, bounded allowlist/grace and atomic reward journals remain authoritative. Selecting an allowlisted older release does not select the current release's catalog.

This is a runtime preparation slice, not public activation. Local integration tests explicitly admit unsigned catalog fixtures in isolated D1 to exercise the dormant path; the publication/rollback API still rejects them. Player catalog/roster, signup, recruitment, progression, gear operations, gacha, tasks/claims and non-battle grants still require migration. Existing `player_stacks`, `player_chars` and `player_gear` foreign keys also require a reviewed identity-lifecycle bridge before an identity declared only in a catalog can grow/equip. No global definition-table materialization or numeric retuning is introduced here. Bootstrap/current selection, historical ownership/retirement support and claim policy across differing task catalogs and the compatible catalog-reader floor remain part of the next slice.

## Next acceptance

Continue R08-B2 with player catalog/roster, signup, character progression, recruitment, gacha, gear, task claims and non-battle shared grants. Reuse B2a's exact release loader and retain transaction-time authority and original-result recovery. It must define bootstrap/current/allowlisted/historical behavior and freeze the relevant catalog/rule inputs. Only then remove the activation block and prove a new declared identity through recruit → grow → equip → summon → fight. Live draft editing, retirement/support workflows, complete grammar/capabilities, keys, quota/storage and signed-device acceptance remain separate requirements.

Verification is recorded in [DEV_TRACKER.json](DEV_TRACKER.json). All evidence is local unless a deployed version or signed device/build identifier is explicitly attached.
