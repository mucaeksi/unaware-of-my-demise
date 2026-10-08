---
name: uomd-code-review
description: "Review scoped UOMD Godot presentation code for correctness, typed interfaces, state ownership, lifecycle and meaningful evidence."
---

# uomd-code-review

Use [Godot](../../standards/godot-development.md) and [testing](../../standards/testing.md) rules plus the actual source requirements. Trace changed execution paths, event data ownership, async/pause/skip/replay cleanup and resource lifetimes. Report actionable defects with file/line, reproduction and impact; avoid style-only or implementation-mirroring tests. Preserve user changes and architecture. Review is read-only unless the owner asks for fixes; parser success alone does not establish UI quality.
