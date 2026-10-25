---
name: unity-deterministic-combat
description: Implement and verify the bit-exact C# 5v5 tactical turn-based combat engine in Uomd.Combat — Mulberry32Rng, IEEE-754 double math, RoundHalfUp, D-27 UomdStatMath, canonical JSON serialization, and SHA-256 battle log parity with Cloudflare Worker /api/v1/battles/verify.
license: Proprietary
---
# Bit-Exact C# Deterministic Combat (`Uomd.Combat` & `Uomd.Core`)

Use this skill whenever touching combat simulation, RNG, stat formulas, status effects, turn order, or battle verification in `apps/unity/Assets/_UOMD/Scripts/Combat/` or `Core/`.

## 1. Why Bit-Exact Parity Matters
The Cloudflare Worker endpoint `POST /api/v1/battles/verify` (`apps/api/src/routes/battles.ts`) re-simulates every completed battle on the server using `@uomd/combat` (`packages/combat/src/engine.ts`) and compares the SHA-256 hex digest of the canonical battle log (`log_hash`). Any divergence of even `1` HP or `1` RNG call between C# (`Uomd.Combat`) and TypeScript (`@uomd/combat`) will cause server verification to reject the battle.

## 2. Mandatory Mathematical Primitives (`UomdCorePrimitives.g.cs`)
`npm run export:unity` generates `apps/unity/Assets/_UOMD/Scripts/Core/Generated/UomdCorePrimitives.g.cs`. Always use these primitives inside `Uomd.Combat`:

1. **IEEE-754 `double` Only (Never `float` or `Mathf`)**:
   - JavaScript `number` is an IEEE-754 64-bit float (`double` in C#).
   - Never use `float` (`Single`) or `UnityEngine.Mathf` in combat or stat formulas; `0.1f` in single precision diverges from `0.1d` in double precision and breaks rounding boundaries.
2. **JavaScript `Math.round` Parity (`RoundHalfUp`)**:
   - C# `Math.Round(2.5)` defaults to banker's rounding (`ToEven` → `2`), whereas JavaScript `Math.round(2.5)` rounds half toward `$+\infty$` (`3`).
   - Always call `UomdCorePrimitives.RoundHalfUp(double value)` (`Math.Floor(value + 0.5d)`).
3. **`Mulberry32Rng` State Machine**:
   - Uses unsigned 32-bit integer (`uint`) wrapping arithmetic (`unchecked`) identical to `packages/core/src/rng.ts`:
     ```csharp
     uint t = unchecked(_state += 0x6D2B79F5u);
     t = unchecked((t ^ (t >> 15)) * (t | 1u));
     t ^= unchecked(t + unchecked((t ^ (t >> 7)) * (t | 61u)));
     double u = ((t ^ (t >> 14)) & 0xFFFFFFFFu) / 4294967296.0d;
     ```
   - Never call `UnityEngine.Random` or `System.Random` inside `Uomd.Combat`.

## 3. D-27 Canonical Stat Pipeline (`UomdStatMath.ComputeCharacterStats`)
All combat unit initialization must evaluate stats in the exact 6-step D-27 order:
1. **Level & Awakening Base Scaling**:
   - `levelMult = 1.0d + (level - 1) * 0.085d`
   - `awkMult = 1.0d + awakening * 0.06d`
   - `hp, atk, def = RoundHalfUp(base * levelMult * awkMult)`
2. **Flat Character Passives** (`hp_flat`, `atk_flat`, `def_flat`, `spd_flat`)
3. **Percentage Character Passives** (`RoundHalfUp(stat * (1.0d + pct))`)
4. **Gear Flat Bonuses**
5. **Gear Percentage Bonuses** (`RoundHalfUp(stat * (1.0d + pct))`)
6. **Set Bonuses** (`2-piece` and `4-piece` flat + pct bonuses)

## 4. Canonical JSON & SHA-256 `log_hash`
- `CanonicalJson.Serialize(node)` recursively sorts object keys lexicographically by UTF-16 code units (ordinal comparison), omits `undefined`/null-omitted fields identically to `packages/core/src/canonical-json.ts`, and formats numbers without trailing `.0`.
- `Sha256Hash.ComputeHex(CanonicalJson.Serialize(battleResult.Log))` produces the exact 64-character lowercase hex digest sent in `POST /api/v1/battles/verify`.

## 5. Verification Gate
- Maintain the golden vectors exported by `tools/export_unity_combat_vectors.ts` (`Tests/EditMode/combat_vectors.json`) and run them in `CombatParityTests` (headless and inside Unity) to prove `100%` identical `log_hash` output across seeds, skills, status effects, and boss phases.
