# Versioned economic catalog

R08 now supports publication and rollback of complete catalog snapshots. The API and installed game select the same immutable release. Read [the full runtime/storage/trust contract](R08_CONTENT_RUNTIME.md) and [snapshot composition](CONTENT_RELEASE_CONTRACT.md); dated verification remains in DEV_TRACKER.json.

## Export, review and publish

Control Center **Catalog → Summary → Export catalog snapshot** returns one validated canonical `economy.json`, with loading/retry, counts, SHA-256 and UTF-8 byte size. Viewers may export definitions they can already inspect. Place it at `catalog/economy.json` in a reviewed content directory, or use:

```bash
npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" \
  --dir content/patches/rel_0003_part1_campaign --id rel_catalog_review \
  --channel staging --depends rel_current_staging --catalog-snapshot
```

This creates an unsigned draft. The normal reviewed Publish action, or explicit `--publish`, signs/activates it after complete revalidation and a bounded check that the bound game runtime supports its capabilities and migration 0027. Failed readiness leaves the draft unsigned; emergency kill stays available. Unpublished objects remain 404 publicly. Editing authoring rows never rewrites an exported/staged document. The server derives `catalog_v1` and a **0.1.2** minimum client; older B1/B2 readers require a newly built application. Old drafts missing the current declaration must be recreated, never silently modified.

Export reads eight tables in one D1 batch, orders stable IDs and validates a closed schema. Limit-plus-one reads reject excess rows. Invalid stored JSON/config/identities fail with an explicit error, without repair. The document is bounded to 1 MiB. Canonical definitions include 20 characters, 80 skill identities, 18 items, 258 gear templates, seven sets, 20 weapon types and 12 banners, plus progression/gear/drop/task rules. No player data, credentials or audit bookkeeping are exported.

Source tables: `characters`, `character_skills`, `item_defs`, `gear_defs`, `accessory_sets`, `weapon_types`, `banners`, `game_config`. Compiled skill mechanics come from the same release's UnitPack. Raw skill source/prose is not another interpreter. Names/stats/growth/role/element/rarity/formation and skill identities must agree with the pack. Exact chapter rewards/drops/boss pools, selectors, battle gates and virtual loan equipment validate against this catalog. Unknown/retired references, unsupported config kinds, inherited prototype properties and mismatched pools fail admission. Source weapon banner tags remain provenance; actual banner membership is explicit.

`config.gear.roleStatOrder` preserves the authoring map's first matching role priority after canonical key sorting. It must cover each non-default key exactly once. Omission is accepted only when every character has an unambiguous match. Ambiguous old drafts need a fresh export; no numerical rule is retuned.

<a id="battle-runtime--r08-b2a"></a>
<a id="identity-storage-and-recruitgrowth--r08-b2b1"></a>
<a id="gear-and-gacha--r08-b2b2"></a>

## Runtime authority

`loadReleaseCatalog` reads the exact published same-channel snapshot and verifies manifest/index agreement, object/declared bytes, UTF-8, SHA-256 and closed schema. Declared failures never fall back to editable tables or another release. Definitions are request-local. Catalog-free historical releases explicitly retain legacy behavior; publication bootstrap does not invent a selected release.

Display APIs may select a published release through `?releaseId`; omission uses the current publication or prepublication legacy data. Unknown/draft/wrong-channel explicit selection fails. Fresh public mutations under a current catalog require a selected installed release. Growth, gear, gacha, teams and task claims join the existing transactional economic/account guards. Current publication, finite allowlists, frozen battle grace, revocation and persistent kill floor remain authoritative. Stable inventory identity alone grants no admission.

Battle start freezes release-bound party/rules/effects. Submission uses that release for drops, grants and task events. Recruitment freezes the eligible invitation/hero choice and atomically spends/grants. Character growth/ranks/ascension and equipment upgrades/assignment/reroll/dismantle use selected costs/caps/templates and optimistic fences. Summon uses selected banner pools/schedules/costs/pity/grants. Original canonical request/results, immutable grant journals and provenance precede any new release/catalog read on retry. Assignment/lock are version-fenced repeatable setters; durable economic requests retain their identities across reload.

Migration 0026 stores immutable character/item/gear IDs separately from editable definitions and preserves player rows, journals, indexes and equipment sequence high-water. Catalog-only grants register validated IDs in the caller's transaction; they never copy definitions into live authoring tables. Signup uses the current free-start catalog atomically; existing login stays independent of catalog availability.

## Obligations and support

Migration 0027 freezes weekly task config and referenced grant definitions per player/UTC week. Window/target/payout changes cannot open a second claim in the same week. Earned historical segments use their original grace/definitions under the currently selected admitted release. Legacy migration-time backfill is explicitly legacy; unknown historical terms are not reconstructed.

New earned mail stores its promised grant subset, names and origin hash. Provider-confirmed purchase terms similarly freeze instant/periodic benefits; recovery/renewal mail does not reinterpret an already recorded period using a new catalog. Paid/earned obligations remain deliverable after catalog loss or offer retirement. Existing legacy records retain legacy terms. Native price/offer binding remains R02, and existing refund/entitlement rules are unchanged.

Absent/retired owned heroes stay in inventory with an unavailable explanation. Equipment stays visible with its real instance state and permits guarded unequip/lock cleanup; no playable stats are invented. New use of unsupported definitions fails explicitly. Teams containing unavailable identities must be edited before fresh activation/battle admission. There is no implicit conversion, deletion or compensation.

Local signed-fixture acceptance clones existing numeric definitions, reuses art and publishes through the real API, then recruits/grows/equips/summons/fights in the same built browser binary. It is a synthetic correctness fixture, not new canon, balance tuning, deployed proof or signed physical-AAB acceptance. Those evidence levels remain distinct in DEV_TRACKER and R18.
