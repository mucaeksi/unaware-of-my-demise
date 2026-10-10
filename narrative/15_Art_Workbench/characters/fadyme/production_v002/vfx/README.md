# Fadyme four-skill VFX v002

Four self-contained canvas_item effect scenes and AnimationPlayer envelopes; production candidates only. Copy this directory as a unit to preserve relative paths. `skill_effect_contract.json` names the existing skill IDs and proposed timing. Release timing must be aligned by Claude with recorded battle events. These assets contain no combat logic.

Basic: a silver Veil thorn, short trail and contained impact ring. Active: interrupted hour dial / three-arm Veil movement, plus a separate ally-local healing cue. Passive: a small silver bell and broken protective ring; no constant aura. Ultimate: bell silhouette and two shallow elliptical rings; no fullscreen overlay or camera shake. Spark overlay can be disabled for the low tier; `reduced_motion=true` retains a static readable motif with the same fade envelope.

GDQuest MIT shader function and Kenney CC0 textures are reused with notices. No GDQuest CC BY-NC-SA artwork is included. Zero particles, zero screen readback, one procedural quad plus one optional spark per scene. Cost is a declared resource bound, not an Android performance claim. Consumer handles instance disposal; at animation end all alpha is zero.
