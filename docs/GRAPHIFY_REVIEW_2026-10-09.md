# Graphify health and map delivery — 2026-10-09

Graphify 0.9.80 is installed in the cloud and CLI query/explain/path work. Native Graphify alone does not include complete Godot structure; `tools/graphify_project.py --refresh` merges conservative Godot extraction and preserves directed parallel relations. Generated outputs are under `graphify-out/`.

Two map issues were found: the HTML was from the preceding native/community export rather than the helper's final Godot-aware graph, and the pinned vis-network CDN (`unpkg.com`) was denied by the cloud network. The helper now exports the overview and a focused Fadyme map from its final graph, using the same vis-network 9.1.6 bytes locally. Bundle SHA/SRI and both upstream licenses are in `tools/vendor/vis-network-9.1.6/`. This is graph tooling; no gameplay code changed.

Open `graphify-out/graph.html` for the aggregated community overview and `graphify-out/fadyme.html` for Fadyme source nodes and their direct neighbors. Keep the adjacent `tools/vendor/` folder with the checkout. The overview intentionally aggregates a graph larger than 5,000 nodes; it is not a node-for-node rendering of all source symbols. Use CLI query/path/explain for the full graph. Fadyme focus includes source, archived/sealed copies and historical notes, so node existence does not make a file current instruction or approved art.

Refresh in the Graphify Python environment:

```bash
graphify update . --no-cluster
python tools/graphify_project.py --refresh
```

Current measured counts/integrity are in `graphify-out/coverage.json`, `diagnostics.json` and `GRAPH_HEALTH.md`. Browser interaction evidence is `graphify-out/browser_validation.json`: canvas render, Fadyme search, node selection/info and community filtering, with outbound networking blocked during the check. CLI path validation uses unambiguous node IDs where names have active and sealed copies.

Coverage limits remain explicit: native AST reports two Gradle parse limitations; Godot duplicate classes/resources include sealed copies and archived contexts. Changed or never-reviewed document semantics are listed in `coverage.json` (`stale_semantic_sources`, `documents_without_semantic_fragment`). File inventory, document headings/links and Godot structure are refreshed; this does not claim every note received a new semantic review. No external LLM API was invoked. Image/audio nodes are reference/metadata coverage, not automatic image understanding or audio transcription.

The Fadyme game/script/asset audit is under `narrative/15_Art_Workbench/characters/fadyme/audit_v001/`. The graph's scope now includes those documents and the byte-exact recovered historical reference anchors. Runtime coding and later AAB responsibility remain with Claude; Codex produces reviews and creative assets.
