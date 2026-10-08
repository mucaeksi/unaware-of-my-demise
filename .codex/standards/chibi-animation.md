# Chibi animation standard

Current implementation evidence: `docs/design/FADYME_PILOT_AND_SIDE_BATTLE_v001_2026-10-08.md`. The pilot is a local runtime candidate pending owner review. It uses key poses plus procedural motion; do not describe it as finished frame-by-frame or skeletal animation.

Choose from available source assets: SpriteFrames/AnimatedSprite2D for frame sequences; AnimationPlayer for property/call tracks; AnimationTree for justified blending; layered cutouts only when actual separated parts exist; Tween for short procedural motion. A flattened PNG is not a bone rig. Preserve genuine transparency, authored facing, complete limbs/weapons/effect silhouette and stable per-pose foot anchors.

For an authorized animation task specify idle, walk, attack, cast/active and ultimate, plus existing hit/defeat/victory when relevant. Record anticipation, action accent/contact or cast release, settle/recovery, loop/interruption rules, event source and Reduced Motion behavior. Timing comes from the real replay/event contract, not new combat math.

Idle should maintain grounded feet with restrained breathing. Walk is readable and stable; attack advances toward the recorded opponent; hit recoils away. Cancel interrupted tweens, prevent stale callbacks from returning a dead actor to idle/victory, and clean up one-shot effects. Mirror only when authored facing differs; check asymmetric costume markers before mirroring.

The existing binding authority is `game/data/presentation/battle_art_v001.json`; reuse crop regions, pose IDs, facing and scale corrections. Portraits, cut-ins and chibi poses preserve the same identity and approval status. Effects must not obscure compact HP/name/status/target information.

Review poses, loop seams, anchors, interruptions, late events, reduced motion and mobile-size silhouette in the native preview. Inspect source alpha/hash measurements with `tools/inspect_battle_art.py` when useful; alpha bounds alone do not prove anatomy. Preserve source masters, provenance and per-derivative import settings. Do not implement AI, attack resolution, progression or summon selection while improving motion.
