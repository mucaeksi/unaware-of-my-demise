# Content release contract — R08-A

New server publications are signed, self-contained snapshots. This completes the dependency/compatibility prerequisite of R08; the versioned economic catalog, full grammar, storage budgets and key rotation remain open.

## Authoring and composition

`POST /admin/api/releases` accepts `minClient`, optional `maxClient` and `contentSchema`, plus optional `dependsOn` as an authoring source. The source must already be published on the same channel. The server copies its effective path/hash set, overlays supplied files, validates the complete result and stores every effective file in the new draft. Neither the resulting manifest nor the D1 release row retains a runtime dependency. The immutable `release.draft` audit records `composedFrom`, supplied-file count and complete-file count.

Composition can therefore start from a previous patch without requiring that intermediate patch on a device. It replaces files by path and does not implement deletion. A reviewed complete root snapshot can omit files; clients do not silently borrow those omissions from their embedded base.

The final set, including inherited files, is limited to 512 paths. Hash metadata reads deduplicate and chunk at 100 D1 parameters. Duplicate supplied paths, missing objects, incompatible channels, empty client ranges and oversized effective sets fail before draft/file/audit writes. Publication revalidates content and checks that the D1 file index matches the manifest before signing. Existing role, generation, transactional pointer/audit and economic-policy fences remain in effect.

Compatibility is the intersection of the requested and source client ranges, with the higher content-schema requirement. A composition cannot lower a source minimum, raise its maximum or lower its schema requirement. The Control Center release list displays the effective bounds and schema before publication.

```bash
npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" \
  --dir content/patches/rel_0003_part1_campaign --id rel_reviewed_next \
  --channel staging --depends rel_previous \
  --min-client 0.1.1 --max-client 0.9.0 --content-schema 1
```

Use existing Access credentials through the supported environment variables. Omitting `--publish` creates a reviewable draft. `--depends` selects a composition source; it does not add an installed-client dependency. `tools/make_release.ts` also exposes min/max/schema metadata for offline manifests; explicit dependencies there describe legacy embedded-base overlays, not server composition.

## Binary boundary and device reads

Client 0.1.1 is the first binary with the corrected snapshot read contract. The game package and Android default version name are 0.1.1; actual signed versionCode/environment/device acceptance remains R11/R18. New server snapshots and offline root manifests require at least 0.1.1 even if a caller requests a lower minimum. Existing 0.1.0 binaries reject them before object download; this requires a new AAB, rather than a data patch to the older reader.

For an active snapshot, every readable path must appear in its signed manifest. Device semantic validation uses that exact set. Embedded bytes can satisfy a declared file only when its path and hash match, avoiding a redundant download and the previous false-corruption rollback. Hash checks still apply. Legacy dependent manifests retain the exact embedded release ID/generation admission check and may inherit that base's omitted paths. Previous/staged state and generation high-water behavior remain intact.

## Historical releases, rollback and kill

Published historical chains remain readable on the server. Resolution checks manifest/row identity, channel, generation and dependency metadata, rejects missing/cyclic/incoherent chains, and explicitly rejects a ninth layer instead of silently truncating. Legacy dependent drafts must be recreated through composition (`draft_needs_rebuild`); they are not rewritten in place or signed as unsupported chains.

Rollback publishes a higher-generation complete snapshot, revalidates its effective content and retains the source maximum and content schema. Its minimum is retained or tightened to 0.1.1. A legacy maximum below this floor rejects rollback before new rows are written; publish a reviewed compatible snapshot instead.

Kill also publishes a higher generation and retains the source compatibility exactly, including a legacy 0.1.0 range. Clients process kill before reading its files, so older compatible binaries can still be disabled. Semantic validation is intentionally bypassed for kill so broken gameplay JSON cannot prevent emergency disablement; structural chain/object-index checks still apply. A kill's source range must cover the intended recipients. The existing economic-floor cutover remains independent of client adoption.

Existing frozen battle/rule/party records are not migrated or rebuilt. New source changes do not claim acceptance for an unchanged old AAB, a deployed Worker or a signed device build.

## Catalog staging

R08-B1 adds an optional [catalog snapshot](CATALOG_SNAPSHOT.md) at `catalog/economy.json` with strict shared reference validation and admin/CLI export. Such drafts cannot publish or become rollback targets until release-scoped economic activation is implemented. Legacy catalog-free releases retain the R08-A publication path.

## Verification and remaining scope

The R08-A evidence record in [DEV_TRACKER.json](DEV_TRACKER.json) records actual checks and source revision. Tests cover composed publications through the real patch manager, compatibility inheritance and rollback/kill, legacy admission and depth, the effective 512-file limit, signed/index agreement and snapshot-versus-overlay validation. Browser checks use actual local game/admin Workers and desktop/touch-phone clients.

Next: bind D1 character/skill/item/gear/drop/banner/config definitions to the same effective release and prove recruit → grow → equip → summon → fight for a newly declared identity. This snapshot contract does not version those mutable tables. Full admitted-JSON grammar/capabilities, key rotation/revocation, IndexedDB transaction completion, retained-byte/quota accounting, media deadlines/cancellation and cache cleanup remain R08 work.
