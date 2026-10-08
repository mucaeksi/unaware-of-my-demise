# Testing and quality evidence

Use the actual repository test runner/addons and paths under `game/tests/`; project.yaml's legacy gdUnit4 preference is not proof of installation. Inspect the present harness before executing. Do not add a testing dependency merely to satisfy a template.

Run unattended checks headlessly. Meaningful logic changes need appropriate deterministic tests; cross-system work needs integration/runtime evidence. UI, animation, shader and feel work need retained native captures and behavioral review. A headless parse check is supporting evidence, not visual acceptance. Reversible wording/layout-only changes do not justify tests that merely mirror implementation.

Preserve strict typing and existing assertions. Never suppress a failing test to obtain a pass. Distinguish a source defect from unavailable tooling. Use PASS/FAIL for observed automated checks and NOT ASSESSED/UNVERIFIED when execution or inputs are absent. UX review vocabulary is APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED / NOT ASSESSED; approval applies only to the reviewed scope and evidence.

For real UI work assess compact/base/tall layouts, touch regions, Android Back, long English copy, Large Text, Reduced Motion, relevant asynchronous states and cleanup. Screenshots alone do not establish frame-time or Android release acceptance. Record commands, versions, fixture mode, results and evidence location. Do not run combat/economy/progression development as part of the current migration or Entry review.
