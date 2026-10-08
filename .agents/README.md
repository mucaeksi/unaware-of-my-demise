# Consolidated project knowledge

Active maintained system: `.codex/`. Capability/alias/provenance union: `library/capabilities.json` and `library/capabilities/`. Standardized historical role cards: `library/roles/`. All unique original skills, roles, docs, rules, templates, scripts and hooks are retained under `archive/20261008/` and are inert source material.

`skills/` is a local discovery bridge to the canonical `.codex/skills/`; do not edit separate copies. After clone/move run `.codex/scripts/bootstrap_skills.ps1`, then `validate_system.py` and `verify_codex.py`. Windows junctions are local metadata, ignored by Git and rebuilt by the script. A relative symbolic link is preferred when permissions support it.

Deferred capabilities include combat AI, economy, summon algorithms, progression, broad planning and release/live-ops. Preservation is not activation/authorization. Source client settings remain only in the private rollback backup; never copy secrets or personal configuration into this library.
