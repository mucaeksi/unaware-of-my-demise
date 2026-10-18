---
name: pixijs-core-concepts
description: "Codex/UOMD adaptation. Use this skill when understanding how PixiJS v8 renders frames: the systems-and-pipes renderer, the render loop, and how the library adapts to different environments. Covers WebGLRenderer/WebGPURenderer/CanvasRenderer selection, renderer.render() pipeline, environment detection, rendering into RenderTextures and RenderTargets (flipY, mipLevel, layer, bind/push/pop, copyDepthTexture), WebGL context loss and WebGPU device loss recovery, and pointers to per-topic deep dives. Triggers on: renderer, WebGL, WebGPU, Canvas, render loop, render pipeline, systems, environments, autoDetectRenderer, RenderTexture, RenderTarget, render to texture, flipY, mipLevel, layer, 3D texture, depth slice, renderTarget.bind, copyToTexture, copyDepthTexture, depth-only, WebGLLoader, WebGPULoader, CanvasLoader, RendererLoader, lazy-load renderer systems, code splitting, context lost, webglcontextlost, device lost, GPUDevice.lost."
license: "MIT"
---
# pixijs-core-concepts — Codex adaptation

Read the [canonical skill](../../../.claude/skills/pixijs-core-concepts/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/pixijs-core-concepts/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Official PixiJS skill mirrored from the installed `pixi.js` package by `tools/install_pixijs_skills.py`; it matches the version in package-lock.json. Do not edit the copy: upgrade pixi.js and re-run the installer.
- Its llms.txt fallback (`https://pixijs.download/release/docs/llms.txt`) documents the newest release; confirm any API it suggests against `node_modules/pixi.js/lib` before using it here.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
