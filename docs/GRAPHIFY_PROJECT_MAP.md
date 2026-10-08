# Project Graphify map

The project map covers Git-visible authored files across `game`, `server`,
`database`, `admin`, `narrative`, `parity`, `patch`, `production`, the framework,
and tooling. Generated output, private local configuration, caches and backups
are excluded by Git ignore rules. Sensitive key contents are not extracted.

Start with `graphify query "entry prologue"`, `graphify explain`, or `graphify path`.
Do not manually load the entire graph JSON into an agent context. When a class
and a scene have the same label, use the source-qualified symbol or exact ID:

```powershell
graphify explain game_scripts_ui_entry_entry_screen_entryscreen
graphify path game_scripts_ui_story_director_storydirector game_scripts_ui_entry_entry_screen_entryscreen
```

Outputs in `graphify-out/`:

- `graph.json`: directed multigraph; distinct relations and evidence lines remain.
- `graph.html`: interactive community overview and node navigation.
- `GRAPH_REPORT.md`: architectural hubs, communities, cohesion and suggested queries.
- `coverage.json`, `inventory.json`: scope and file-to-node mapping.
- `diagnostics.json`, `GRAPH_HEALTH.md`: integrity checks and simple-graph collapse risks.
- `duplicate_content.json`: exact hash matches, not deletion recommendations.
- `semantic-project/`, `semantic-framework/`: document coverage/depth and provenance.
- `PROJECT_DOCS_FINDINGS.md`, `FRAMEWORK_DOCS_FINDINGS.md`, `GODOT_EXTRACTION_NOTES.md`: review evidence and limits.

## Refresh

Native Graphify 0.9.80 supports many repository languages but does not parse
GDScript or Godot scenes/resources. `tools/graphify_godot.py` adds conservative
declarations, local direct calls, class-type references, resource/UID links,
scene hierarchy/script/signal wiring, autoloads and editor-plugin settings.
It does not resolve dynamic calls, generated controls, computed paths or save state.

```powershell
graphify update .
& (Get-Content graphify-out/.graphify_python) tools/graphify_project.py --refresh
graphify export html
```

The native update can report its shrink guard because its supported-language
view is smaller than this full project map. Do not force a smaller overwrite.
The project refresh performs its own cached native extraction, then merges
Godot structure, all-file inventory, Markdown headings/links, exact duplicate
hashes and unchanged document semantics. The complete rebuild must be the last
writer. A cold rebuild without semantic sidecars produces structural coverage;
document semantics require the Graphify skill's local-agent extraction again.

The helper checks fragment hashes, omits changed/stale source semantics and
lists them in `coverage.json`. New documents remain structurally mapped and are
listed separately until reviewed. Preserve the semantic sidecars if continuity
of document interpretation matters.

A fragment with a missing coverage manifest fails closed. The normal shrink
guard also remains enabled. After reviewing a deliberate source removal or
semantic refresh that legitimately reduces node count, the helper's explicit
`--allow-reviewed-shrink` option permits that overwrite; it is never automatic.

## Evidence limits

Complete file coverage is distinct from exhaustive interpretation of every
paragraph or media asset. Document fragments record full, focused or duplicate
reads. Image/audio assets have path, metadata/hash and usage relationships;
their contents were not exhaustively visually interpreted or transcribed.
Procedural SQL blocks and one Gradle expression are outside native symbol
extraction; the files remain in the inventory. Unresolved literal path prefixes
and intentional test inputs are recorded separately from missing scene resources.

No paid external LLM calls were made. Actual host-agent semantic token metrics
are unavailable; zero API cost does not mean zero host-agent usage. Graphify's
benchmark is an estimate, not measured savings from a model session.

This mapping changes no gameplay, story canon, scene layout, creative source,
audio provider, deployment or runtime lifecycle. Current inspection and resumption
findings are recorded in the dated Graphify audit.
