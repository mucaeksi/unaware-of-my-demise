---
name: uomd-shared-skill-validation
description: "Validate canonical UOMD skill names, frontmatter, relative references, licenses and matching Codex/Claude discovery hashes."
---

# uomd-shared-skill-validation

Read [shared authority](../../standards/authority.md) and [Godot rules](../../standards/godot-development.md). Godot 4.7.2, GDScript, Android portrait 1080×1920, gl_compatibility and strict types remain the target. Codex produces/reviews; Claude integrates runtime changes through a concrete handoff. Shared discovery does not change that ownership.

Use after adding or moving shared skills or cloning the checkout.

1. Keep one canonical root and use the shared bootstrap in the [workflow](../../workflows/shared-skills.md). Refuse normal user folders and conflicting links; do not recreate archived hooks or personal MCP records.
2. Validate uomd names, scalar name/description frontmatter, unique folders, relative references, inventory and upstream license/NOTICE/hash records.
3. Run .codex/scripts/validate_system.py and .codex/scripts/validate_shared_skills.py. Compare both discovery paths to the canonical resolved path and every file hash, not only the SKILL.md header.
4. Record loader evidence separately from filesystem checks. Native Codex/Claude session discovery and real MCP calls are acceptance checks only when those clients are available.
5. Windows Git may materialize link-target text when core.symlinks is false. Bootstrap accepts only exact documented placeholders, then creates relative links or local junctions. After moving a junction checkout, report a conflict and remove only the verified link node before rerunning; never recursively remove a target.

Common bodies use plain Markdown and name/description; client-specific hooks, shell substitution, forced models and tool aliases are excluded. Original sources remain inert in the provenance archive.
