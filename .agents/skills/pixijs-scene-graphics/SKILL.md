---
name: pixijs-scene-graphics
description: "Codex/UOMD adaptation. Use this skill when drawing vector shapes and paths in PixiJS v8. Covers the Graphics API: shape-then-fill methods (rect/circle/ellipse/poly/roundRect/star/regularPoly/roundPoly/roundShape/filletRect/chamferRect), path methods (moveTo/lineTo/bezierCurveTo/quadraticCurveTo/arc/arcTo/arcToSvg/closePath), fill/stroke/cut, holes, FillGradient (linear/radial), FillPattern, GraphicsContext sharing, svg import/export, containsPoint hit testing, cloning, clearing, bounds, fillStyle/strokeStyle, draw-time transforms (rotateTransform/scaleTransform/translateTransform/setTransform/save/restore), default styles, GraphicsPath reuse. Triggers on: Graphics, GraphicsContext, rect, circle, poly, roundRect, fill, stroke, cut, hole, beginHole, FillGradient, FillPattern, moveTo, bezierCurveTo, svg, graphicsContextToSvg, svg export, GraphicsOptions, containsPoint, clone, clear, bounds, rotateTransform, translateTransform, setFillStyle, setStrokeStyle, GraphicsPath."
license: "MIT"
---
# pixijs-scene-graphics — Codex adaptation

Read the [canonical skill](../../../.claude/skills/pixijs-scene-graphics/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/pixijs-scene-graphics/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Official PixiJS skill mirrored from the installed `pixi.js` package by `tools/install_pixijs_skills.py`; it matches the version in package-lock.json. Do not edit the copy: upgrade pixi.js and re-run the installer.
- Its llms.txt fallback (`https://pixijs.download/release/docs/llms.txt`) documents the newest release; confirm any API it suggests against `node_modules/pixi.js/lib` before using it here.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
