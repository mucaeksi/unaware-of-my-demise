# English player-string catalog

Owner scope (2026-10-11): **English source only; Turkish is deferred.** Spoken narrative dialogue is Japanese (`ja-JP`, Chirp 3 HD) with English subtitles. UI labels/toasts and developer diagnostics in this file are not automatically voiced.

Read-only source audit at `5c83e3d1` (game files unchanged by subsequent docs-only work). TypeScript 5.9.3 AST enumerated every string/template occurrence in 38 production `.ts` files under `apps/game/src/**`, then rendering/helper/enum contexts were manually reviewed. Tests and declaration-only types are outside player UI scope. Full source hashes and exact raw expressions are in `SOURCE_CATALOG.json`; all noncatalog literals (imports, URLs, IDs, styles, comparisons, empty separators, etc.) and exclusion reason are in `LITERAL_AUDIT.json`. This is a handoff catalog, not localization wiring or an executed browser audit.

## Stable keys and placeholders

`game.<source namespace>.sNNN` is an **allocated identifier**, not an algorithm to rerun and renumber later. Preserve an existing key when English wording or source location changes. Append unused numbers for new messages; retire without reuse. Repeated phrases at distinct call sites retain independent keys until Claude deliberately aliases them. Source line numbers are audit pointers, never part of key identity.

`{p1}`, `{p2}`, … preserve interpolation order; the JSON catalog maps each placeholder to its original TypeScript expression. Nested formatted clauses have their own entries; do not translate embedded IDs or substitute untrusted template code. Keep literal braces/percent signs/star symbols, newlines and number formatting. EN number-format `en-US` is existing code behavior. Future localization should replace concatenated clauses with whole-message/plural templates, but this task preserves the actual source text. `pull(s)` and `purchase(s)` are source wording, not an implemented plural rule.

Some displayed labels (hp/atk/def/spd and gear slots) are also data identifiers. Map to separate display strings/uppercase at the renderer; never replace identifiers in API payloads. Patch-lab/boot/error messages are included because users of the preview can see them. This catalog does not claim those diagnostics are appropriate final store UX.

## Dynamic content and boundary findings

The following visible content is supplied at runtime rather than as fixed English literals in apps/game/src. Use its stable source ID when building a separate data catalog, not new invented prose: character/enemy names and elements/roles, skill names/descriptions/types, status names/remaining turns, scene narrative/speaker/choice text/line IDs, chapter/encounter titles, task titles/objective notes, mail titles/bodies/attachment names, catalog items/gear/passives, banner pool/disclosure data, product titles and native Google Play prices. Currency display_name is server data with built-in fallback Bell's Remains. Google/UMP native UI and native Java error strings are outside this TypeScript-only assignment.

`HubScene.errText` displays raw API error message/code and arbitrary Error.message. Therefore unknown backend/native messages cannot be exhaustively translated by this file; Claude should map known codes to vetted display keys instead of leaking technical errors. Dynamic user profile names/order IDs/numbers are values, not translatable strings. Story line IDs must survive EN subtitle → reviewed Japanese transcript → voice asset mapping; choosing ja-JP voice for English text is not translation.

Settings display `textSpeed` raw values: current UI toggles normal/fast, though the inc/dec helper also references slow and Prefs type declares normal/fast. This discrepancy is recorded, not silently rewritten. Material/role tokens obtained from the API use underscore replacement/uppercasing in the current renderer and need explicit display mappings later.

## Catalog by source file

### `apps/game/src/battle/UnitView.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.battle.unitview.s001` | "▼" | 69 | "" |
| `game.battle.unitview.s002` | "▼" | 135 | "" |
| `game.battle.unitview.s003` | "▸ {p1} → {p2}" | 149 | "p1 = text; p2 = targetsLabel" |
| `game.battle.unitview.s004` | "▸ {p1}" | 149 | "p1 = text" |
| `game.battle.unitview.s005` | "SH {p1}" | 154 | "p1 = shield" |
| `game.battle.unitview.s006` | "{p1} {p2}" | 155 | "p1 = statusNames.get(s.statusId) ?? s.statusId; p2 = s.turnsLeft" |
| `game.battle.unitview.s007` | "  ·  " | 155 | "" |

### `apps/game/src/content/ArtLibrary.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.content.artlibrary.s001` | "failed to load {p1}" | 37 | "p1 = file.key" |
| `game.content.artlibrary.s002` | "no art for unit {p1}" | 52 | "p1 = k" |
| `game.content.artlibrary.s003` | "unit art {p1} not loaded" | 72 | "p1 = artKey" |
| `game.content.artlibrary.s004` | "unit {p1} has no idle state" | 79 | "p1 = artKey" |
| `game.content.artlibrary.s005` | "no background for {p1}" | 106 | "p1 = location" |
| `game.content.artlibrary.s006` | "background {p1} not loaded" | 131 | "p1 = location" |

### `apps/game/src/content/ContentService.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.content.contentservice.s001` | "base release manifest missing (HTTP {p1})" | 28 | "p1 = res.status" |
| `game.content.contentservice.s002` | "base content has no {p1}" | 39 | "p1 = path" |
| `game.content.contentservice.s003` | "base file {p1}: HTTP {p2}" | 41 | "p1 = path; p2 = r.status" |
| `game.content.contentservice.s004` | "base file {p1} failed its integrity check" | 44 | "p1 = path" |

### `apps/game/src/content/remote.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.content.remote.s001` | "manifest request failed: HTTP {p1}" | 12 | "p1 = res.status" |
| `game.content.remote.s002` | "object {p1} failed: HTTP {p2}" | 18 | "p1 = sha256.slice(0, 8); p2 = res.status" |

### `apps/game/src/main.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.main.s001` | "The graphics context was lost. Reload to continue." | 47 | "" |
| `game.main.s002` | "This device cannot run the game: {p1}" | 52 | "p1 = e instanceof Error ? e.message : String(e)" |

### `apps/game/src/net/api.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.net.api.s001` | "HTTP {p1}" | 181 | "p1 = res.status" |

### `apps/game/src/net/currency.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.net.currency.s001` | "Bell's Remains" | 2 | "" |

### `apps/game/src/net/identity.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.net.identity.s001` | "Google sign-in is available in the Android app" | 16 | "" |

### `apps/game/src/net/store.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.net.store.s001` | "Purchases run inside the Android app" | 11 | "" |
| `game.net.store.s002` | "Rewarded ads run inside the Android app" | 63 | "" |

### `apps/game/src/platform/idbStorage.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.platform.idbstorage.s001` | "no indexedDB" | 54 | "" |
| `game.platform.idbstorage.s002` | "indexedDB blocked" | 63 | "" |

### `apps/game/src/scenes/AccountScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.accountscene.s001` | "ACCOUNT" | 11 | "" |
| `game.scenes.accountscene.s002` | "Your account is a Google account. Progress, rolls and purchases are bound to it and survive a reinstall." | 24 | "" |
| `game.scenes.accountscene.s003` | "SIGN IN WITH GOOGLE" | 26 | "" |
| `game.scenes.accountscene.s004` | "Google sign-in runs inside the Android app. This browser build cannot sign in." | 27 | "" |
| `game.scenes.accountscene.s005` | "Wayfarer" | 31 | "" |
| `game.scenes.accountscene.s006` | "Player {p1}" | 32 | "p1 = me.id" |
| `game.scenes.accountscene.s007` | "No cloud save yet." | 34 | "" |
| `game.scenes.accountscene.s008` | "Cloud save v{p1} · {p2}" | 34 | "p1 = save.version; p2 = save.updatedAt ?? ''" |
| `game.scenes.accountscene.s009` | "UPLOAD SAVE" | 35 | "" |
| `game.scenes.accountscene.s010` | "DOWNLOAD SAVE" | 36 | "" |
| `game.scenes.accountscene.s011` | "EXPORT MY DATA" | 37 | "" |
| `game.scenes.accountscene.s012` | "SIGN OUT" | 38 | "" |
| `game.scenes.accountscene.s013` | "PRIVACY OPTIONS (ADS)" | 40 | "" |
| `game.scenes.accountscene.s014` | "Privacy choice updated" | 40 | "" |
| `game.scenes.accountscene.s015` | "TAP AGAIN TO DELETE FOREVER" | 41 | "" |
| `game.scenes.accountscene.s016` | "DELETE ACCOUNT" | 41 | "" |
| `game.scenes.accountscene.s017` | "progress, wallet and roster cannot be restored" | 41 | "" |
| `game.scenes.accountscene.s018` | "Welcome, wayfarer. Your company awaits." | 49 | "" |
| `game.scenes.accountscene.s019` | "Welcome back." | 49 | "" |
| `game.scenes.accountscene.s020` | "Your data was saved as a file" | 65 | "" |
| `game.scenes.accountscene.s021` | "Your account was deleted" | 82 | "" |
| `game.scenes.accountscene.s022` | "Signed out" | 92 | "" |
| `game.scenes.accountscene.s023` | "Saved to the cloud" | 99 | "" |
| `game.scenes.accountscene.s024` | "The cloud save changed on another device. Download it first." | 101 | "" |
| `game.scenes.accountscene.s025` | "Cloud progress merged into this device" | 111 | "" |

### `apps/game/src/scenes/BattleScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.battlescene.s001` | "This battle could not be loaded" | 91 | "" |
| `game.scenes.battlescene.s002` | "BACK" | 93 | "" |
| `game.scenes.battlescene.s003` | "{p1}  ·  {p2}" | 156 | "p1 = this.encounter.stage_id; p2 = this.encounter.title_en" |
| `game.scenes.battlescene.s004` | "TURN ORDER" | 158 | "" |
| `game.scenes.battlescene.s005` | "×1" | 160 | "" |
| `game.scenes.battlescene.s006` | "AUTO" | 161 | "" |
| `game.scenes.battlescene.s007` | "MENU" | 162 | "" |
| `game.scenes.battlescene.s008` | "×{p1}" | 201 | "p1 = this.speed" |
| `game.scenes.battlescene.s009` | "AUTO ✓" | 206 | "" |
| `game.scenes.battlescene.s010` | "AUTO" | 206 | "" |
| `game.scenes.battlescene.s011` | "PAUSED" | 217 | "" |
| `game.scenes.battlescene.s012` | "RESUME" | 218 | "" |
| `game.scenes.battlescene.s013` | "RETREAT" | 219 | "" |
| `game.scenes.battlescene.s014` | "Leave the battle" | 219 | "" |
| `game.scenes.battlescene.s015` | "{p1}'S TURN" | 293 | "p1 = actor.def.name_en.toUpperCase()" |
| `game.scenes.battlescene.s016` | "Passive — {p1}: {p2}" | 294 | "p1 = passive.name_en; p2 = passive.description_en" |
| `game.scenes.battlescene.s017` | "ULTIMATE" | 297 | "" |
| `game.scenes.battlescene.s018` | "BASIC" | 297 | "" |
| `game.scenes.battlescene.s019` | "SKILL" | 297 | "" |
| `game.scenes.battlescene.s020` | "Cooldown {p1}" | 298 | "p1 = o.cooldownLeft" |
| `game.scenes.battlescene.s021` | "Focus {p1}/{p2}" | 298 | "p1 = actor.focus; p2 = o.def.focus_cost" |
| `game.scenes.battlescene.s022` | "TAP THE SKILL AGAIN OR THE TARGET" | 329 | "" |
| `game.scenes.battlescene.s023` | "CHOOSE A TARGET" | 329 | "" |
| `game.scenes.battlescene.s024` | "TAP AGAIN TO CAST" | 332 | "" |
| `game.scenes.battlescene.s025` | "no view for {p1}" | 352 | "p1 = id" |
| `game.scenes.battlescene.s026` | "STAGGERED" | 423 | "" |
| `game.scenes.battlescene.s027` | "COUNTER" | 466 | "" |
| `game.scenes.battlescene.s028` | "INTERCEPT" | 467 | "" |
| `game.scenes.battlescene.s029` | "-{p1}!" | 468 | "p1 = e.amount" |
| `game.scenes.battlescene.s030` | "-{p1}" | 468 | "p1 = e.amount" |
| `game.scenes.battlescene.s031` | "BLOCKED" | 469 | "" |
| `game.scenes.battlescene.s032` | "({p1} absorbed)" | 469 | "p1 = e.absorbed" |
| `game.scenes.battlescene.s033` | "+{p1}" | 482 | "p1 = e.amount" |
| `game.scenes.battlescene.s034` | "+{p1} SHIELD" | 491 | "p1 = e.amount" |
| `game.scenes.battlescene.s035` | "CLEANSED" | 505 | "" |
| `game.scenes.battlescene.s036` | "{p1} {p2}" | 509 | "p1 = e.stat.replace('_', ' ').toUpperCase(); p2 = e.amount &gt;= 0 ? '▲' : '▼'" |
| `game.scenes.battlescene.s037` | "▲" | 509 | "" |
| `game.scenes.battlescene.s038` | "▼" | 509 | "" |
| `game.scenes.battlescene.s039` | "ULTIMATE READY" | 516 | "" |
| `game.scenes.battlescene.s040` | "GUARDING" | 522 | "" |
| `game.scenes.battlescene.s041` | "VICTORY" | 569 | "" |
| `game.scenes.battlescene.s042` | "DEFEAT" | 569 | "" |
| `game.scenes.battlescene.s043` | "{p1} turns  ·  {p2} actions" | 586 | "p1 = result.turns; p2 = this.recorded.length" |
| `game.scenes.battlescene.s044` | "Server verification: checking…" | 587 | "" |
| `game.scenes.battlescene.s045` | "CONTINUE" | 591 | "" |
| `game.scenes.battlescene.s046` | "RETRY" | 591 | "" |
| `game.scenes.battlescene.s047` | "LEAVE" | 592 | "" |
| `game.scenes.battlescene.s048` | " · rewards: {p1}" | 606 | "p1 = r.rewards.map((a) =&gt; describeAttachment(a, names)).join(', ')" |
| `game.scenes.battlescene.s049` | "Progress saved to your account{p1}" | 607 | "p1 = gained" |
| `game.scenes.battlescene.s050` | "Progress not saved: {p1}" | 609 | "p1 = e.message" |
| `game.scenes.battlescene.s051` | "Progress not saved" | 609 | "" |
| `game.scenes.battlescene.s052` | "Server verification: this release is not published on the server" | 625 | "" |
| `game.scenes.battlescene.s053` | "HTTP {p1}" | 628 | "p1 = res.status" |
| `game.scenes.battlescene.s054` | "Server verification: ✓ replay matches ({p1})" | 631 | "p1 = out.logHash.slice(0, 10)" |
| `game.scenes.battlescene.s055` | "Server verification: ✗ replay rejected" | 632 | "" |
| `game.scenes.battlescene.s056` | "Server verification: unavailable offline" | 634 | "" |

### `apps/game/src/scenes/BootScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.bootscene.s001` | "The game could not start: {p1}" | 48 | "p1 = e instanceof Error ? e.message : String(e)" |

### `apps/game/src/scenes/ChaptersScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.chaptersscene.s001` | "CHAPTERS" | 22 | "" |
| `game.scenes.chaptersscene.s002` | "BACK" | 40 | "" |
| `game.scenes.chaptersscene.s003` | "Locked — finish \"{p1}\" first" | 48 | "p1 = titles.get(node.requires ?? '') ?? node.requires" |
| `game.scenes.chaptersscene.s004` | "Story and battle" | 48 | "" |
| `game.scenes.chaptersscene.s005` | "Story" | 48 | "" |
| `game.scenes.chaptersscene.s006` | "NEW · {p1}" | 51 | "p1 = patchedBy" |

### `apps/game/src/scenes/CharacterScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.characterscene.s001` | "weapon" | 9 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s002` | "armor" | 9 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s003` | "necklace" | 9 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s004` | "ring" | 9 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s005` | "COMPANION" | 13 | "" |
| `game.scenes.characterscene.s006` | "You do not own this companion." | 32 | "" |
| `game.scenes.characterscene.s007` | "{p1}   {p2} · {p3}" | 40 | "p1 = stars(meta.rarity); p2 = meta.element; p3 = meta.role.replaceAll('_', ' ')" |
| `game.scenes.characterscene.s008` | "Level {p1} / {p2}    Ascension {p3}" | 41 | "p1 = c.level; p2 = c.cap; p3 = c.ascension" |
| `game.scenes.characterscene.s009` | "Maximum level" | 42 | "" |
| `game.scenes.characterscene.s010` | "XP {p1} / {p2}" | 42 | "p1 = c.xp; p2 = c.xpToNext" |
| `game.scenes.characterscene.s011` | "hp" | 44 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s012` | "atk" | 44 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s013` | "def" | 44 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s014` | "spd" | 44 | " · Source token is also a machine identifier; map display text separately, do not translate the identifier in data/API calls. UI uppercases this token." |
| `game.scenes.characterscene.s015` | "{p1} {p2}" | 44 | "p1 = k.toUpperCase(); p2 = Math.round(s[k] ?? 0)" |
| `game.scenes.characterscene.s016` | "LEVEL UP" | 48 | "" |
| `game.scenes.characterscene.s017` | "uses 1 {p1}" | 48 | "p1 = nm(xpItem.itemId)" |
| `game.scenes.characterscene.s018` | "no XP items" | 48 | "" |
| `game.scenes.characterscene.s019` | "Level up" | 48 | "" |
| `game.scenes.characterscene.s020` | "ASCEND" | 51 | "" |
| `game.scenes.characterscene.s021` | "→ cap {p1} · account Lv {p2}" | 51 | "p1 = asc.cap; p2 = asc.accountLevel" |
| `game.scenes.characterscene.s022` | "fully ascended" | 51 | "" |
| `game.scenes.characterscene.s023` | "Ascended" | 51 | "" |
| `game.scenes.characterscene.s024` | "{p1}  ·  {p2} {p3}" | 52 | "p1 = asc.items.map((i) =&gt; `${nm(i.itemId)} ${(have.get(i.itemId) ?? 0)}/${i.quantity}`).join('  ·  '); p2 = Math.ceil(asc.fee); p3 = currency.name" |
| `game.scenes.characterscene.s025` | "{p1} {p2}/{p3}" | 52 | "p1 = nm(i.itemId); p2 = (have.get(i.itemId) ?? 0); p3 = i.quantity" |
| `game.scenes.characterscene.s026` | "  ·  " | 52 | "" |
| `game.scenes.characterscene.s027` | "SKILLS" | 55 | "" |
| `game.scenes.characterscene.s028` | "{p1} · rank {p2}/{p3}" | 60 | "p1 = sk.type; p2 = sk.rank; p3 = sk.maxRank" |
| `game.scenes.characterscene.s029` | "RANK UP" | 63 | "" |
| `game.scenes.characterscene.s030` | "MAX" | 63 | "" |
| `game.scenes.characterscene.s031` | "{p1} ×{p2}" | 63 | "p1 = nm(n.itemId); p2 = n.quantity" |
| `game.scenes.characterscene.s032` | "{p1} improved" | 63 | "p1 = sk.name" |
| `game.scenes.characterscene.s033` | "— empty —" | 72 | "" |
| `game.scenes.characterscene.s034` | "CHANGE" | 74 | "" |

### `apps/game/src/scenes/GearScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.gearscene.s001` | "{p1} {p2}" | 10 | "p1 = s.stat.replace('_pct', '%'); p2 = s.value" |
| `game.scenes.gearscene.s002` | "%" | 10 | "" |
| `game.scenes.gearscene.s003` | "ARMORY" | 14 | "" |
| `game.scenes.gearscene.s004` | "{p1} · {p2} owned" | 44 | "p1 = this.slot; p2 = this.list.length" |
| `game.scenes.gearscene.s005` | "{p1} items" | 44 | "p1 = this.list.length" |
| `game.scenes.gearscene.s006` | "{p1}  {p2}" | 49 | "p1 = g.name; p2 = stars(g.rarity)" |
| `game.scenes.gearscene.s007` | "{p1} · Lv {p2}/{p3}{p4}   {p5}" | 50 | "p1 = g.slot; p2 = g.level; p3 = g.levelCap; p4 = g.equippedBy ? ` · on ${g.equippedBy}` : ''; p5 = statLine(g)" |
| `game.scenes.gearscene.s008` | " · on {p1}" | 50 | "p1 = g.equippedBy" |
| `game.scenes.gearscene.s009` | "REMOVE" | 52 | "" |
| `game.scenes.gearscene.s010` | "EQUIP" | 52 | "" |
| `game.scenes.gearscene.s011` | "Removed" | 52 | "" |
| `game.scenes.gearscene.s012` | "Equipped" | 52 | "" |
| `game.scenes.gearscene.s013` | "‹" | 57 | "" |
| `game.scenes.gearscene.s014` | "{p1} / {p2}" | 58 | "p1 = this.page + 1; p2 = pages" |
| `game.scenes.gearscene.s015` | "›" | 59 | "" |

### `apps/game/src/scenes/HomeScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.homescene.s001` | "THE COMPANY" | 9 | "" |
| `game.scenes.homescene.s002` | "SUMMON" | 20 | "" |
| `game.scenes.homescene.s003` | "Banners, rates, pity" | 20 | "" |
| `game.scenes.homescene.s004` | "ROSTER" | 21 | "" |
| `game.scenes.homescene.s005` | "Your company" | 21 | "" |
| `game.scenes.homescene.s006` | "ERRANDS" | 22 | "" |
| `game.scenes.homescene.s007` | "Daily and weekly" | 22 | "" |
| `game.scenes.homescene.s008` | "ARMORY" | 23 | "" |
| `game.scenes.homescene.s009` | "Weapons and relics" | 23 | "" |
| `game.scenes.homescene.s010` | "MAIL" | 24 | "" |
| `game.scenes.homescene.s011` | "Rewards and notices" | 24 | "" |
| `game.scenes.homescene.s012` | "SHOP" | 25 | "" |
| `game.scenes.homescene.s013` | "Offers and ads" | 25 | "" |
| `game.scenes.homescene.s014` | "ACCOUNT" | 26 | "" |
| `game.scenes.homescene.s015` | "Signed in" | 26 | "" |
| `game.scenes.homescene.s016` | "Sign in" | 26 | "" |
| `game.scenes.homescene.s017` | "Your progress, wallet and rolls are kept on the server." | 33 | "" |
| `game.scenes.homescene.s018` | "Sign in to keep your progress, wallet and rolls on the server." | 33 | "" |
| `game.scenes.homescene.s019` | "The servers are in maintenance: some actions may be refused." | 36 | "" |
| `game.scenes.homescene.s020` | "Offline: server features are unavailable." | 38 | "" |

### `apps/game/src/scenes/MailScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.mailscene.s001` | "MAIL" | 12 | "" |
| `game.scenes.mailscene.s002` | "{p1} waiting" | 32 | "p1 = open.length" |
| `game.scenes.mailscene.s003` | "Nothing is waiting for you." | 32 | "" |
| `game.scenes.mailscene.s004` | "{p1}   ·   {p2}" | 39 | "p1 = describeAttachments(m.attachments, this.names); p2 = done ? 'claimed' : `expires ${m.expires_at.slice(0, 10)}`" |
| `game.scenes.mailscene.s005` | "claimed" | 39 | "" |
| `game.scenes.mailscene.s006` | "expires {p1}" | 39 | "p1 = m.expires_at.slice(0, 10)" |
| `game.scenes.mailscene.s007` | "CLAIMED" | 40 | "" |
| `game.scenes.mailscene.s008` | "CLAIM" | 40 | "" |
| `game.scenes.mailscene.s009` | "‹" | 44 | "" |
| `game.scenes.mailscene.s010` | "{p1} / {p2}" | 45 | "p1 = this.page + 1; p2 = pages" |
| `game.scenes.mailscene.s011` | "›" | 46 | "" |
| `game.scenes.mailscene.s012` | "CLAIM ALL" | 48 | "" |
| `game.scenes.mailscene.s013` | "Claimed: {p1}" | 57 | "p1 = describeAttachments(m.attachments, this.names)" |

### `apps/game/src/scenes/RosterScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.rosterscene.s001` | "ROSTER" | 11 | "" |
| `game.scenes.rosterscene.s002` | "{p1} of {p2} companions" | 31 | "p1 = this.list.length; p2 = total" |
| `game.scenes.rosterscene.s003` | "{p1} · {p2}" | 40 | "p1 = c.element; p2 = c.role.replaceAll('_', ' ')" |
| `game.scenes.rosterscene.s004` | "copies {p1} · shards {p2}" | 41 | "p1 = c.copies; p2 = c.shards" |
| `game.scenes.rosterscene.s005` | "tap for details" | 41 | "" |
| `game.scenes.rosterscene.s006` | "‹" | 45 | "" |
| `game.scenes.rosterscene.s007` | "{p1} / {p2}" | 46 | "p1 = this.page + 1; p2 = pages" |
| `game.scenes.rosterscene.s008` | "›" | 47 | "" |

### `apps/game/src/scenes/ShopScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.shopscene.s001` | "SHOP" | 13 | "" |
| `game.scenes.shopscene.s002` | "{p1} earlier purchase(s) restored" | 26 | "p1 = restored" |
| `game.scenes.shopscene.s003` | "Payments are handled by Google Play." | 31 | "" |
| `game.scenes.shopscene.s004` | "Purchases and rewarded ads run inside the Android app." | 31 | "" |
| `game.scenes.shopscene.s005` | "No offers are on sale yet." | 32 | "" |
| `game.scenes.shopscene.s006` | "Watch a memory" | 36 | "" |
| `game.scenes.shopscene.s007` | "{p1} {p2} per view · {p3} of {p4} left in the last 12 hours" | 37 | "p1 = ads.reward; p2 = currencyLabel(); p3 = ads.perWindow - ads.windowViews; p4 = ads.perWindow" |
| `game.scenes.shopscene.s008` | "WATCH" | 38 | "" |
| `game.scenes.shopscene.s009` | "{p1}-day blessing: tokens now and twice a day" | 46 | "p1 = p.subscription.duration_days" |
| `game.scenes.shopscene.s010` | "{p1} {p2}" | 47 | "p1 = g.amount; p2 = currencyLabel(g.currency)" |
| `game.scenes.shopscene.s011` | "BUY" | 49 | "" |
| `game.scenes.shopscene.s012` | "Purchase complete. Check your mail and wallet." | 59 | "" |
| `game.scenes.shopscene.s013` | "Already delivered." | 59 | "" |
| `game.scenes.shopscene.s014` | "Payment is pending; it will be delivered when it clears." | 59 | "" |
| `game.scenes.shopscene.s015` | "Purchase cancelled." | 59 | "" |
| `game.scenes.shopscene.s016` | "The purchase could not be confirmed." | 59 | "" |
| `game.scenes.shopscene.s017` | "Thank you. The reward is on its way to your wallet." | 73 | "" |
| `game.scenes.shopscene.s018` | "The memory was cut short: no reward this time." | 73 | "" |
| `game.scenes.shopscene.s019` | "No memory is available right now. Try again later." | 73 | "" |
| `game.scenes.shopscene.s020` | "Ads need your privacy choice first (Account &gt; Privacy options)." | 73 | "" |
| `game.scenes.shopscene.s021` | "The ad could not be shown." | 73 | "" |

### `apps/game/src/scenes/StoryScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.storyscene.s001` | "This scene could not be loaded" | 113 | "" |
| `game.scenes.storyscene.s002` | "BACK" | 115 | "" |
| `game.scenes.storyscene.s003` | "▼" | 148 | "" |
| `game.scenes.storyscene.s004` | "SKIP" | 151 | "" |
| `game.scenes.storyscene.s005` | "AUTO" | 152 | "" |
| `game.scenes.storyscene.s006` | "LOG" | 153 | "" |
| `game.scenes.storyscene.s007` | "AUTO ✓" | 340 | "" |
| `game.scenes.storyscene.s008` | "AUTO" | 340 | "" |
| `game.scenes.storyscene.s009` | "SKIP ✓" | 346 | "" |
| `game.scenes.storyscene.s010` | "SKIP" | 346 | "" |
| `game.scenes.storyscene.s011` | "BACKLOG" | 382 | "" |
| `game.scenes.storyscene.s012` | "{p1}  " | 385 | "p1 = l.speakerDisplay.toUpperCase()" |
| `game.scenes.storyscene.s013` | "{p1}{p2}" | 386 | "p1 = who; p2 = l.text" |
| `game.scenes.storyscene.s014` | "CLOSE" | 390 | "" |

### `apps/game/src/scenes/SummonScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.summonscene.s001` | "SUMMON" | 15 | "" |
| `game.scenes.summonscene.s002` | "No banner is open right now." | 46 | "" |
| `game.scenes.summonscene.s003` | "{p1} / {p2}{p3}" | 54 | "p1 = this.idx + 1; p2 = this.banners.length; p3 = b.endsAt ? `   ·   ends ${b.endsAt.slice(0, 10)}` : ''" |
| `game.scenes.summonscene.s004` | "   ·   ends {p1}" | 54 | "p1 = b.endsAt.slice(0, 10)" |
| `game.scenes.summonscene.s005` | "‹" | 56 | "" |
| `game.scenes.summonscene.s006` | "›" | 57 | "" |
| `game.scenes.summonscene.s007` | "Featured: {p1} — {p2} on a 5★{p3}" | 61 | "p1 = b.pools.fiveFeatured.map((i) =&gt; this.name(i)).join(', '); p2 = pct(b.featured.chance, 0); p3 = b.featured.lossesToGuarantee === 1 ? ', guaranteed after a miss' : `, guaranteed after ${b.featured.lossesToGuarantee} misses`" |
| `game.scenes.summonscene.s008` | ", guaranteed after a miss" | 61 | "" |
| `game.scenes.summonscene.s009` | ", guaranteed after {p1} misses" | 61 | "p1 = b.featured.lossesToGuarantee" |
| `game.scenes.summonscene.s010` | "5★ pool: {p1}" | 61 | "p1 = b.pools.fiveOther.map((i) =&gt; this.name(i)).join(', ')" |
| `game.scenes.summonscene.s011` | "5★ rate {p1}{p2}, guaranteed by pull {p3}" | 63 | "p1 = pct(b.baseFiveStarRate); p2 = b.softPity ? `, rising ${pct(b.softPity.increment, 0)} per pull from pull ${b.softPity.startPull}` : ''; p3 = b.hardPity" |
| `game.scenes.summonscene.s012` | ", rising {p1} per pull from pull {p2}" | 63 | "p1 = pct(b.softPity.increment, 0); p2 = b.softPity.startPull" |
| `game.scenes.summonscene.s013` | "A 4★ or better at least every {p1} pulls. A 10-pull has no bonus rate." | 65 | "p1 = b.minFourStarEvery" |
| `game.scenes.summonscene.s014` | "Average {p1} pulls per 5★{p2}" | 66 | "p1 = b.analysis.expectedPullsPerFiveStar.toFixed(1); p2 = b.analysis.expectedPullsPerTarget ? `, ${b.analysis.expectedPullsPerTarget.toFixed(1)} per featured (at most ${b.analysis.worstCasePullsForTarget})` : ''" |
| `game.scenes.summonscene.s015` | ", {p1} per featured (at most {p2})" | 66 | "p1 = b.analysis.expectedPullsPerTarget.toFixed(1); p2 = b.analysis.worstCasePullsForTarget" |
| `game.scenes.summonscene.s016` | "PITY" | 71 | "" |
| `game.scenes.summonscene.s017` | "Pull {p1} of {p2}" | 72 | "p1 = next; p2 = b.hardPity" |
| `game.scenes.summonscene.s018` | "5★ chance on the next pull: {p1}" | 77 | "p1 = pct(rateNow)" |
| `game.scenes.summonscene.s019` | "The next 5★ is the featured one." | 79 | "" |
| `game.scenes.summonscene.s020` | "Misses so far: {p1} / {p2}" | 79 | "p1 = p.lost; p2 = b.featured.lossesToGuarantee" |
| `game.scenes.summonscene.s021` | "4★ guaranteed in {p1} pull(s)" | 80 | "p1 = Math.max(1, b.minFourStarEvery - p.pity4)" |
| `game.scenes.summonscene.s022` | "TARGET: {p1}" | 82 | "p1 = this.name(this.target ?? '')" |
| `game.scenes.summonscene.s023` | "PULL ×1" | 86 | "" |
| `game.scenes.summonscene.s024` | "{p1} {p2}" | 86 | "p1 = one.toLocaleString('en-US'); p2 = currency.name" |
| `game.scenes.summonscene.s025` | "PULL ×10" | 87 | "" |
| `game.scenes.summonscene.s026` | "{p1} {p2}" | 87 | "p1 = (one * 10).toLocaleString('en-US'); p2 = currency.name" |
| `game.scenes.summonscene.s027` | "You have {p1} {p2}. The same currency pays for upgrades and the shop: after ×10 you keep {p3}." | 89 | "p1 = this.balance.toLocaleString('en-US'); p2 = currency.name; p3 = Math.max(0, this.balance - one * 10).toLocaleString('en-US')" |
| `game.scenes.summonscene.s028` | "POOLS" | 90 | "" |
| `game.scenes.summonscene.s029` | "HISTORY" | 91 | "" |
| `game.scenes.summonscene.s030` | "RESULT (already rolled)" | 120 | "" |
| `game.scenes.summonscene.s031` | "THE THREAD PULLS TIGHT" | 120 | "" |
| `game.scenes.summonscene.s032` | "+{p1} shards" | 131 | "p1 = p.shards" |
| `game.scenes.summonscene.s033` | "NEW · guaranteed" | 131 | "" |
| `game.scenes.summonscene.s034` | "NEW" | 131 | "" |
| `game.scenes.summonscene.s035` | "CLOSE" | 139 | "" |
| `game.scenes.summonscene.s036` | "POOLS & RATES" | 144 | "" |
| `game.scenes.summonscene.s037` | "—" | 145 | "" |
| `game.scenes.summonscene.s038` | "5★ featured: {p1}" | 147 | "p1 = list(b.pools.fiveFeatured)" |
| `game.scenes.summonscene.s039` | "5★ other: {p1}" | 148 | "p1 = list(b.pools.fiveOther)" |
| `game.scenes.summonscene.s040` | "4★: {p1}" | 149 | "p1 = list(b.pools.four)" |
| `game.scenes.summonscene.s041` | "3★: {p1}" | 150 | "p1 = list(b.pools.three)" |
| `game.scenes.summonscene.s042` | "Duplicates become character-bound Memory Shards: 5★ {p1}, 4★ {p2}, 3★ {p3}." | 152 | "p1 = b.duplicateShards['5']; p2 = b.duplicateShards['4']; p3 = b.duplicateShards['3']" |
| `game.scenes.summonscene.s043` | "Pity is kept per account and shared between banners of the same kind." | 153 | "" |
| `game.scenes.summonscene.s044` | "CLOSE" | 156 | "" |
| `game.scenes.summonscene.s045` | "YOUR LAST PULLS" | 163 | "" |
| `game.scenes.summonscene.s046` | "{p1}  {p2}  ·  {p3}  ·  pull {p4}{p5}" | 164 | "p1 = stars(r.rarity).padEnd(5, ' '); p2 = this.name(r.item_id); p3 = r.banner_id; p4 = r.pull_number; p5 = r.duplicate ? '  (duplicate)' : ''" |
| `game.scenes.summonscene.s047` | "  (duplicate)" | 164 | "" |
| `game.scenes.summonscene.s048` | "Nothing yet." | 164 | "" |
| `game.scenes.summonscene.s049` | "CLOSE" | 166 | "" |

### `apps/game/src/scenes/TasksScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.tasksscene.s001` | "{p1}d {p2}h" | 11 | "p1 = Math.floor(m / 1440); p2 = Math.floor((m % 1440) / 60)" |
| `game.scenes.tasksscene.s002` | "{p1}h {p2}m" | 11 | "p1 = Math.floor(m / 60); p2 = m % 60" |
| `game.scenes.tasksscene.s003` | "ERRANDS" | 16 | "" |
| `game.scenes.tasksscene.s004` | "{p1}   {p2}/{p3}" | 28 | "p1 = v.title; p2 = v.progress; p3 = v.objective.count" |
| `game.scenes.tasksscene.s005` | "{p1}{p2}" | 29 | "p1 = describeAttachments(v.rewards, names); p2 = note ? `   ·   ${note}` : ''" |
| `game.scenes.tasksscene.s006` | "   ·   {p1}" | 29 | "p1 = note" |
| `game.scenes.tasksscene.s007` | "CLAIMED" | 30 | "" |
| `game.scenes.tasksscene.s008` | "CLAIM" | 30 | "" |
| `game.scenes.tasksscene.s009` | "THIS WINDOW · ends in {p1}" | 35 | "p1 = left(d.endsAtMs - t.serverTimeMs)" |
| `game.scenes.tasksscene.s010` | "Window complete" | 38 | "" |
| `game.scenes.tasksscene.s011` | "THIS WEEK" | 41 | "" |
| `game.scenes.tasksscene.s012` | "ends in {p1}" | 43 | "p1 = left(w.endsAtMs - t.serverTimeMs)" |
| `game.scenes.tasksscene.s013` | "claim before it expires" | 43 | "" |
| `game.scenes.tasksscene.s014` | "No errands right now." | 45 | "" |
| `game.scenes.tasksscene.s015` | "Reward claimed" | 53 | "" |

### `apps/game/src/scenes/TitleScene.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.scenes.titlescene.s001` | "No check yet" | 15 | "" |
| `game.scenes.titlescene.s002` | "Up to date ({p1})" | 18 | "p1 = o.releaseId" |
| `game.scenes.titlescene.s003` | "Up to date (embedded base)" | 18 | "" |
| `game.scenes.titlescene.s004` | "Applied {p1} · {p2} files · {p3} KB" | 20 | "p1 = o.releaseId; p2 = o.downloadedFiles; p3 = (o.downloadedBytes / 1024).toFixed(0)" |
| `game.scenes.titlescene.s005` | "Reverted to embedded base (kill switch)" | 22 | "" |
| `game.scenes.titlescene.s006` | "Offline — using installed content" | 24 | "" |
| `game.scenes.titlescene.s007` | "Rejected: {p1}" | 26 | "p1 = o.reason" |
| `game.scenes.titlescene.s008` | "PART I  ·  UNAWARE, I FADE" | 70 | "" |
| `game.scenes.titlescene.s009` | "BEGIN" | 72 | "" |
| `game.scenes.titlescene.s010` | "The First Step" | 72 | "" |
| `game.scenes.titlescene.s011` | "CHAPTERS" | 73 | "" |
| `game.scenes.titlescene.s012` | "SETTINGS" | 74 | "" |
| `game.scenes.titlescene.s013` | "COMPANY" | 75 | "" |
| `game.scenes.titlescene.s014` | "CONTENT {p1}{p2}  ·  {p3}  ·  v{p4}{p5}" | 123 | "p1 = active; p2 = active !== content.base.releaseId ? ' (patch)' : ''; p3 = CHANNEL; p4 = CLIENT_VERSION; p5 = PATCH_LAB_ENABLED ? '  ·  tap for details' : ''" |
| `game.scenes.titlescene.s015` | " (patch)" | 123 | "" |
| `game.scenes.titlescene.s016` | "  ·  tap for details" | 123 | "" |
| `game.scenes.titlescene.s017` | "New content downloaded: {p1}" | 128 | "p1 = out.releaseId" |
| `game.scenes.titlescene.s018` | "Content returned to the installed base" | 129 | "" |
| `game.scenes.titlescene.s019` | "SETTINGS" | 152 | "" |
| `game.scenes.titlescene.s020` | "Music" | 155 | "" |
| `game.scenes.titlescene.s021` | "{p1}%" | 156 | "p1 = Math.round(prefs().musicVolume * 100)" |
| `game.scenes.titlescene.s022` | "Effects" | 161 | "" |
| `game.scenes.titlescene.s023` | "{p1}%" | 162 | "p1 = Math.round(prefs().sfxVolume * 100)" |
| `game.scenes.titlescene.s024` | "Text speed" | 167 | "" |
| `game.scenes.titlescene.s025` | "normal" | 170 | "" |
| `game.scenes.titlescene.s026` | "fast" | 170 | "" |
| `game.scenes.titlescene.s027` | "slow" | 170 | "" |
| `game.scenes.titlescene.s028` | "Reduced motion" | 173 | "" |
| `game.scenes.titlescene.s029` | "ON" | 174 | "" |
| `game.scenes.titlescene.s030` | "OFF" | 174 | "" |
| `game.scenes.titlescene.s031` | "−" | 184 | "" |
| `game.scenes.titlescene.s032` | "+" | 185 | "" |
| `game.scenes.titlescene.s033` | "RESET PROGRESS" | 188 | "" |
| `game.scenes.titlescene.s034` | "Progress cleared" | 188 | "" |
| `game.scenes.titlescene.s035` | "CLOSE" | 189 | "" |
| `game.scenes.titlescene.s036` | "CONTENT UPDATES" | 197 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s037` | "Reading state…" | 198 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s038` | "Embedded base:  {p1}  (generation {p2})" | 203 | "p1 = content.base.releaseId; p2 = content.base.generation · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s039` | "Active patch:   {p1}" | 204 | "p1 = st.active ? `${st.active.releaseId}  (generation ${st.active.generation}, ${st.active.manifest.files.length} files)` : 'none' · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s040` | "{p1}  (generation {p2}, {p3} files)" | 204 | "p1 = st.active.releaseId; p2 = st.active.generation; p3 = st.active.manifest.files.length · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s041` | "none" | 204 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s042` | "Rollback target:  {p1}" | 205 | "p1 = st.previous ? st.previous.releaseId : st.active ? 'embedded base' : '—' · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s043` | "embedded base" | 205 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s044` | "—" | 205 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s045` | "Denied on this device:  {p1}" | 206 | "p1 = st.denied.length ? st.denied.join(', ') : 'none' · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s046` | "none" | 206 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s047` | "Channel: {p1}   ·   client v{p2}   ·   storage: {p3}" | 207 | "p1 = CHANNEL; p2 = CLIENT_VERSION; p3 = content.persistent ? 'IndexedDB' : 'memory (not persistent)' · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s048` | "IndexedDB" | 207 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s049` | "memory (not persistent)" | 207 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s050` | "Last check:  {p1}" | 208 | "p1 = describe(content.lastCheck.outcome) · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s051` | "CHECK NOW" | 215 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s052` | "Checking for content updates…" | 218 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s053` | "ROLL BACK" | 227 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s054` | "Rolled back" | 235 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s055` | "Already on the embedded base" | 235 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |
| `game.scenes.titlescene.s056` | "CLOSE" | 238 | " · Patch-lab diagnostic UI; visible only when the feature is enabled." |

### `apps/game/src/services.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.services.s001` | "services not initialised" | 15 | "" |
| `game.services.s002` | "content service missing" | 21 | "" |

### `apps/game/src/ui/format.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.ui.format.s001` | "★" | 6 | "" |
| `game.ui.format.s002` | "{p1} {p2}" | 10 | "p1 = a.amount.toLocaleString('en-US'); p2 = currencyLabel(a.currency)" |
| `game.ui.format.s003` | "{p1} ×{p2}" | 12 | "p1 = names.get(a.itemId) ?? a.itemId; p2 = a.quantity" |
| `game.ui.format.s004` | "{p1} account XP" | 14 | "p1 = a.amount" |
| `game.ui.format.s005` | "No attachment" | 19 | "" |
| `game.ui.format.s006` | "{p1} %" | 22 | "p1 = (x * 100).toFixed(digits).replace(/\\.0+$/, '')" |

### `apps/game/src/ui/hub.ts`

| Stable key | Exact EN source/template | Source line | Interpolation / note |
|---|---|---|---|
| `game.ui.hub.s001` | "This feature is switched off for now." | 9 | "" |
| `game.ui.hub.s002` | "{p1} ({p2})" | 9 | "p1 = e.message; p2 = e.code" |
| `game.ui.hub.s003` | "BACK" | 31 | "" |
| `game.ui.hub.s004` | "Sign in to use this screen." | 47 | "" |
| `game.ui.hub.s005` | "ACCOUNT" | 48 | "" |
| `game.ui.hub.s006` | "{p1} {p2}" | 61 | "p1 = currency.name; p2 = this.balance.toLocaleString('en-US')" |

## Coverage result

375 cataloged literal/template occurrences across 27 source files; 1003 excluded occurrences across the 38 scanned files. Every original AST occurrence is accounted for exactly once. Source files were not changed; no Turkish translation or Japanese audio was generated. Keys/placeholder cardinality/source locations are verified in the machine-readable catalog. Future additions must update this inventory without renumbering existing keys.
