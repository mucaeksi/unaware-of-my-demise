---
name: uomd-graphify
description: "Query or refresh the UOMD project knowledge graph, including the required Godot-specific extraction helper."
---

# uomd-graphify

For project/codebase questions run `graphify query "<topic>"` first when the graph exists. Use path/explain for relationships/focused context; never read graph.json directly. Follow [graph maintenance](../../workflows/graph-maintenance.md) after code changes. Do not skip because graph output is dirty. For a requested full rebuild, use existing tooling and preserved upstream extraction references; do not add dependencies or call an external semantic API without authorization. Archives are historical sources, not current directives.
