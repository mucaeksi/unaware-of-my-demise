---
name: pixijs-custom-rendering
description: "Codex/UOMD adaptation. Use this skill when writing custom shaders, uniforms, filters, batchers, or low-level draw code in PixiJS v8. Covers Shader.from({gl, gpu, resources}), GlProgram/GpuProgram, UniformGroup with typed uniforms (f32, vec2, mat4x4), UBO mode, textures as resources, TextureView for depth sampling, 3D and array textures (depth, arrayLayerCount, sampler3D, texture_3d), WebGPU storage textures (storage: true), WGSL override constants, custom bind group layouts (gpuLayout), partial buffer updates (Buffer.update), Geometry.vertexCount/indexCount, TexturePool scratch textures, State winding and culling (clockwiseFrontFace, cullMode), WebGPU render bundles, custom Filter via Filter.from, GLSL ES 3.0 conventions (finalColor), uBackTexture sampling, pixi.js/unsafe-eval for strict CSP, custom Batcher and InstructionPipe.destroyInstructionSet via extensions. Triggers on: Shader, GLSL, WGSL, uniform, custom shader, blendRequired, ShaderOverrides, bind group layout, depth texture, 3D texture, sampler3 …"
license: "MIT"
---
# pixijs-custom-rendering — Codex adaptation

Read the [canonical skill](../../../.claude/skills/pixijs-custom-rendering/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/pixijs-custom-rendering/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Official PixiJS skill mirrored from the installed `pixi.js` package by `tools/install_pixijs_skills.py`; it matches the version in package-lock.json. Do not edit the copy: upgrade pixi.js and re-run the installer.
- Its llms.txt fallback (`https://pixijs.download/release/docs/llms.txt`) documents the newest release; confirm any API it suggests against `node_modules/pixi.js/lib` before using it here.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
