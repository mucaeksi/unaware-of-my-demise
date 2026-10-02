---
paths:
  - "game/**/shaders/**"
  - "**/*.gdshader"
---

# Shader Code Standards

All Godot shader files in this project must follow these standards to maintain
visual quality, performance, and cross-platform compatibility.

## Naming Conventions
- File naming: `[type]_[category]_[name].[ext]`
  - `spatial_env_water.gdshader` (Godot)

- Use descriptive names that indicate the material purpose
- Use Godot-appropriate shader naming and type prefixes where they are part of the final convention.

## Code Quality
- All uniforms/parameters must have descriptive names and appropriate hints
- Group related parameters (Godot: `group_uniforms`, Unity: `[Header]`, Unreal: Category)
- Comment non-obvious calculations (especially math-heavy sections)
- No magic numbers — use named constants or documented uniform values
- Include authorship and purpose comment at the top of each shader file

## Performance Requirements
- Document the target platform and complexity budget for each shader
- Use appropriate precision: `half`/`mediump` on mobile where full precision isn't needed
- Minimize texture samples in fragment shaders
- Avoid unnecessary dynamic branching; prefer Godot shader-language idioms such as `step()`, `smoothstep()`, and `mix()` where appropriate.
- No texture reads inside loops
- Two-pass approach for blur effects (horizontal then vertical)

## Cross-Platform
- Test shaders on minimum spec target hardware
- Provide fallback/simplified versions for lower quality tiers
- Document that the shader targets Godot 4.7.2 Mobile renderer or the actual project renderer.
- Do not mix shaders from different render pipelines in the same directory

## Variant Management
- Minimize shader variants — each variant is a separate compiled shader
- Document all keywords/variants and their purpose
- Use feature stripping where possible to reduce build size
- Log and monitor total variant count per shader
