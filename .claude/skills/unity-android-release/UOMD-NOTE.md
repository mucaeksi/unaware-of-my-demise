# UOMD vendoring note

Vendored from https://github.com/tipoLi5890/unity-dev-skills (MIT, pinned commit in `.claude/skills-lock.json`).
Shell and Python helpers (`*.sh`, `*.py`, `build-env.example`) are intentionally not vendored: this repository only
installs markdown and reference code under `.claude/skills/`. Use the skill's reasoning and reference pages; for the
actual UOMD commands use the project skills:

- Android build/sign/record: `unity-android-il2cpp` (`apps/unity/cloud/unity_ci.sh build`, `UomdBuild.cs`, `tools/record_unity_build.mjs`).
- Tests and captures: `uomd-mobile-qa` (`npm run test:unity-logic`, `unity_ci.sh test|capture`).

Cross-references to sibling skills of that repository that are not vendored here (for example `unity-debug`,
`unity-game-ui`, `unity-cli`) have no local target.
