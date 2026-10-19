# Stat math (D-27)

Heroes, enemies and bosses share one RPG attribute model. Content is authored in four attributes; the combat stats the engine runs on are derived from them by one function (`deriveStats`, `packages/economy/src/attributes.ts`) that the engine, the server and the content tools all call. Numbers stay small on purpose: a level-1 hero has 10–19 HP, the largest number in Part I is a level-20 boss bar of about 750 HP.

## Attributes

| Attribute | Gives | Second effect |
|---|---|---|
| **STR** | ATK of STR heroes (physical classes) | — |
| **INT** | ATK of INT heroes (casters, healers, supports): damage, healing, ATK-scaled shields | pierces the target's status resistance by 1% per point |
| **VIT** | **3 HP per point** (HP = 4 + 3 × VIT) | — |
| **AGI** | SPD (turn order) | crit chance 2% per point, capped at 40% (AGI 20); every AGI point above the cap adds +5% crit damage |

- Every unit names its **power attribute** (`str` or `int`); that attribute is its ATK. The other one does nothing for damage.
- **DEF comes only from armor**: equipped armor for heroes, natural armor for enemies (`armor` in the attribute block; tanks have 1). VIT never raises DEF, so a high-HP unit is not also hard to hurt.
- Damage is unchanged: `ATK × skill % × 10 / (10 + DEF) × element × status × crit`, rounded down, at least 1. With DEF 0–5 an attack keeps 100–67% of its damage.
- Crit damage is ×1.5 (×2.0 at AGI 30). There is no random damage spread.
- Attributes grow linearly: `base + growth × (level − 1)`, rounded half up after gear points are added. Level cap 20 (Part I); Part II raises it to 40.

## Gear

Gear gives points, not percentages, so every +1 is visible at small numbers.

| Slot | Gives | Example (level 1 → level 20) |
|---|---|---|
| Weapon | **power** points (added to the wielder's STR or INT) + a whole-point role stat (front-liners and healers VIT, everyone else AGI) | 3★ +1 → +3, 5★ signature +2.5 → +8, role stat +1 / +2 |
| Armor | VIT + DEF | 3★ +1 VIT / 1 DEF → +3 VIT / 2 DEF, 5★ +2 VIT / 2 DEF → +5 VIT / 4 DEF |
| Necklace, ring | rolled main + sub stats: whole points of VIT, power, DEF or AGI (1–2), or the special percentages heal, Focus gain, status and element resistance | |
| Set (2 pieces) | the narrative set's percentage became 1 point (Ash-Maw Hide +1 VIT, Road Captain's Oath +1 power, …) | |

Memory Shard resonance gives whole points too: odd tiers +1 VIT, even tiers +1 power (tier 6: +3 / +3).

## Numbers this produces

| Unit | Level 1 | Level 20 | Level 20 + 3★ weapon & armor | Level 20 + 5★ |
|---|---|---|---|---|
| Mahmut (5★ tank, STR) | HP 19 · ATK 3 · DEF 1 | HP 49 · ATK 9 | HP 55 · ATK 12 · DEF 3 | HP 64 · ATK 17 · DEF 5 |
| Fadyme (5★ caster, INT) | HP 13 · ATK 4 | HP 28 · ATK 14 · crit 16% | HP 37 · ATK 17 · DEF 2 | HP 43 · ATK 22 · DEF 4 |
| Nixie (4★ striker, STR) | HP 10 · ATK 4 · crit 8% | HP 25 · ATK 14 · crit 20% | HP 34 · ATK 17 | HP 40 · ATK 22 |
| Bellbound Dead (swarm) | HP 25 · ATK 2 | HP 250 · ATK 8 | | |
| Choir Knight (elite) | HP 40 · ATK 2 · DEF 2 | HP 325 · ATK 10 · DEF 2 | | |
| Ash-Maw (boss, per phase bar) | HP 112 · ATK 3 | HP 748 · ATK 10 | | |

Enemies have more HP than heroes because a wave of three or four of them faces five heroes with area skills and ultimates; their hits stay small (a level-20 normal hits a 3★-armored hero for 5–8).

## Fight length targets

Measured, not guessed: `npm run build:campaign` plays all 35 Part I stages with the Auto Battle policy and writes [CAMPAIGN_BALANCE.md](CAMPAIGN_BALANCE.md) (gearless and with starter gear).

- With starter gear (3★ weapon + armor at the hero's level): every stage is won; normal stages ~4–6 rounds (median ~5), bosses ~8–12 (median ~9). Owner 2026-10-19: fights may run a little longer and harder, never a wall.
- Without gear: 30 of 35 stages are still won; a few bosses and late mixed waves need gear.
- The tutorial fights (two heroes) take 2–6 rounds.

## Where things live

- Formula and constants: `packages/economy/src/attributes.ts` (`ATTRIBUTE_RULES`). Constants are code, tuned together with the probe.
- Unit attributes: `content/balance/attributes.json` — archetypes (tank, bruiser, striker, caster, healer, support; e_swarm … e_boss), one per unit, plus rarity points (4★ +1 power, 5★ +1 power +1 VIT). The narrative keeps names, skills and canon; units it does not list keep their legacy stat block.
- Gear conversion: `tools/lib/balance.ts` (weapons, armor, accessory pools, set bonuses, role stats) feeds `tools/seed_catalog.ts`; `tools/seed_characters.ts` seeds the D1 attribute columns.
- D1: migration `0029_attribute_stats.sql` renamed the `characters` stat columns to `base_str/int/vit/agi` + growth, added `power_stat` and `armor`, and rewrote the seeded rows and gear definitions once.
- Compatibility: content with attribute units requires capability `attributes_v1`. Published releases and catalogs with the old HP/ATK/DEF/SPD blocks keep working unchanged (the engine and server keep the legacy path, so recorded battles still replay).
