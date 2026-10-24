---
name: unity-2d-animation
description: Implement and tune Unity 6 LTS 2D character and visual novel animations — 16-cell 4x4 SD Chibi 8-state frame loops, bottom-left foot pivot grounding, 2-phase anticipation + impact snap (1.35x hold), knee-up Light Novel portrait breathing/cross-fade, and reducedMotion support.
license: MIT
---
# Unity 6 LTS 2D Character & Portrait Animation (`Uomd.Battle` & `Uomd.Narrative`)

Use this skill when implementing or debugging SD Chibi battle animations (`ChibiUnitView`), visual novel knee-up (`boydan`) portrait rigs (`PortraitRigView`), ultimate cut-ins, or hit-stop timing in `apps/unity/`.

## 1. 16-Cell (`4×4`) SD Chibi 8-State Atlas Specification
Every playable character and enemy in `content/base/art/chibi/` has 8 state sheets (`idle`, `walk`, `basic`, `active`, `ultimate`, `hit`, `defeat`, `victory`), each laid out as a `4×4` grid (`16` frames) with unit-specific slice parameters in `unity_export_manifest.json` (`unit_slices[unitId]`).

| State | Loop Mode | Base FPS | Combat Animation Contract |
| :--- | :--- | :--- | :--- |
| `idle` | Loop | `8–10` | Continuous subtle breathing and weapon poise on formation slot. |
| `walk` | Loop | `12` | Dash/advance to target slot and return to home formation slot. |
| `basic` | Once → `idle` | `12` | 2-phase anticipation (frames `0..6`), impact snap at frame `7` (`1.35x` frame hold), recovery (`8..15`). |
| `active` | Once → `idle` | `12` | Tactical skill cast with signature element VFX trigger at impact frame. |
| `ultimate` | Once → `idle` | `12–14` | Preceded by 2D cut-in banner (`cutin_<unitId>`), camera zoom, and hit-stop on impact frame. |
| `hit` | Once → `idle` | `12` | Knockback jitter + white/crimson `MaterialPropertyBlock` flash + squash/stretch. |
| `defeat` | Once (Clamp last frame) | `10` | Collapse to frame `15` and hold with dimmed desaturation tint. |
| `victory` | Once / Loop tail | `10` | Played by surviving allies on battle clear (`VICTORY` state). |

## 2. Foot Pivot Grounding & Formation Scale
- **Normalized Unity Pivot**: `new Vector2(spec.unity_pivot.x, spec.unity_pivot.y)` where `unity_pivot.y = 1.0f - spec.foot_y`.
- Because the sprite pivot sits directly at the unit's feet, placing `unitTransform.position = slotWorldPosition` grounds the unit's feet exactly on the tactical formation ring regardless of sprite padding or scale.
- **Scale & Facing**:
  - Apply `spec.scale` to `visualRoot.localScale`.
  - Flip facing direction via `spriteRenderer.flipX` (or `localScale.x` sign when `pivot_x == 0.5f`) according to `spec.default_facing` (`left` vs `right`) and team side (allies face right `+X`, enemies face left `-X`).

## 3. Impact Snap, Hit-Stop, and TimeScale Discipline
- Drive all sprite frame stepping and procedural squash/stretch from a custom battle clock (`BattleClock.DeltaTime = Time.deltaTime * BattleSpeedMultiplier * HitStopFactor`), where `BattleSpeedMultiplier` is `1.0f` (`1x`) or `2.0f` (`2x`) and `HitStopFactor` drops to `0.0f` for `45–80 ms` on critical/ultimate impacts.
- On the impact frame of `basic`, `active`, and `ultimate`:
  1. Hold the impact frame for `1.35x` its normal frame duration.
  2. Trigger the mapped `vfx_presets.json` effect and damage number popup at the target's chest anchor (`footWorldPos + Vector3.up * torsoHeight`).
  3. Apply a quick squash-and-stretch impulse (`scale = (1.12f, 0.90f)` recovering to `(1.0f, 1.0f)` over `0.14s`).

## 4. Visual Novel Knee-Up (`Boydan`) Portrait Rig (`PortraitRigView`)
- **Breathing Loop**: Apply a continuous vertical sine wave `offsetY = Mathf.Sin(time * 1.8f + phaseOffset) * 0.025f` and micro-scale `1.0f + Mathf.Sin(time * 1.8f) * 0.004f` to active portraits.
- **Active Speaker Emphasis**: Active speaker cross-fades to `Color.white` (`1.02x` scale, `SortingOrder + 2`), while non-speaking stage portraits dim smoothly to `new Color(0.62f, 0.60f, 0.66f, 1f)` (`0.98x` scale) over `0.18s`.
- **Emotion Cross-Fade**: Switching expressions (`portrait_sable_neutral` → `portrait_sable_solemn`) cross-fades a secondary overlay `SpriteRenderer` over `0.15s` so facial transitions never pop abruptly.
- **Reduced Motion**: When `AccessibilitySettings.ReducedMotion` is enabled, disable continuous sine breathing, screen shake, and rapid impact squash while keeping clean discrete frame changes and cross-fades.
