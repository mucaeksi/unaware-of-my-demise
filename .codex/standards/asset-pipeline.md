# Asset pipeline and promotion

Read `docs/UOMD_ASSET_PIPELINE.md`, `docs/UOMD_REFERENCE_LOCK.md`, relevant current review docs and existing registries before assigning IDs, names or destinations. Creative staging uses `narrative/`; the secondary Production folder and Drive LEGACY are read-only. Existing naming/version/ID conventions win over generic templates.

Lifecycle: specification -> generation request -> candidate -> canon/reference check -> technical validation -> approval status -> metadata/provenance -> authorized production promotion -> base-game or patch classification. A candidate/reference copy is not production approval. Locked originals are immutable; optimized derivatives record their reference and are new files.

Retain asset/content/character IDs, type, version, model/tool/configuration, prompt/source references, timestamp, approval state, supersession, destination and base/patch class. Do not place credentials, tokens, private client paths/configuration or raw API responses in shared metadata. Preserve licensed masters and source notices.

The documented Gemini stack and newer built-in ImageGen work coexist as provenance. Follow the owner's specified tool and relevant approved workflow; verify availability before any generation. Do not introduce paid calls, change modality models, replace locked images/voice/theme or fabricate a missing reference. The main theme remains owner-controlled.

Technical checks cover decoding/format, transparency, dimensions/aspect, complete silhouette, identity, mobile readability, stable anchors, references and hashes, duplicates/supersession, import settings and build/PCK exclusions. Use `.codex/scripts/audit_assets.py` for a non-mutating inventory; it reports measurements, not subjective compliance or orphan certainty. Use existing `tools/inspect_battle_art.py` when alpha/pose measurement is relevant.

Promotion requires verified references, technical validity, metadata, correct destination/version and build/patch inclusion decision. Work remains local; promotion within the authorized repository scope never implies pushing or publishing. Do not mass-delete suspected orphans or automatically rewrite source assets.
