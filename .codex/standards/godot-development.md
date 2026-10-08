# Godot development and live review

Godot 4.7.2 Standard, GDScript, Android portrait; project root `game/`. Use actual project settings and preserve gl_compatibility, strict typing, installed plugins and existing state ownership. Read `docs/ARCHITECTURE.md` and relevant current implementation decisions when a change crosses a system boundary.

Prefer Godot AI MCP for editor-aware inspection and complex scene/resource authoring. Inspect node/resource properties before modifying them. Save editor changes explicitly. When editor writes are unavailable during play, use scoped source edits and hot reload, then inspect the real runtime.

Keep the existing editor, live game and reusable Local UI Preview window open. The helper is `game/scripts/art_review/preview_session.gd` (`res://scripts/art_review/preview_session.gd` at runtime); inspect its available methods before invoking. Refresh the same preview after each validated phase using local sample data. Avoid account, server and reward requests from preview tooling.

Hot reload may require freeing old preview instances and awaiting destruction before refreshing resources. Restart only for a concrete parse/debugger/lifecycle problem; explain why. Minimize the editor only while live tools remain reliable. Run unattended tests headlessly and retain native screenshots from the existing runtime for UI/animation/VFX evidence.

Parser success alone does not complete a visual feature. Meaningful scene, UI, animation, navigation or resource work needs real editor/runtime inspection, relevant logs, behavior checks and screenshots. Desktop evidence does not certify Android frame time or release acceptance.

Use typed GDScript and existing naming conventions. UI requests changes through the current controllers/events; it never owns authoritative gameplay state. Do not silently introduce replacement singletons, routers or transaction systems.
