---
name: uomd-visual-regression
description: Verify UOMD Unity 6 LTS UI/stage layouts and React Control Center UI behavior using reproducible states, landscape/safe-area captures, Playwright admin flows, and visible error/freshness checks.
---
# UOMD visual and UI regression (`apps/unity/` & `apps/admin/`)

Read README, [uomd-mobile-qa](../uomd-mobile-qa/SKILL.md), [uomd-anime-ui](../uomd-anime-ui/SKILL.md), and [unity-ui-toolkit](../unity-ui-toolkit/SKILL.md). Use `ui-ux-pro-max` for focused local guidance while preserving existing Gothic tokens (`#07050c`, `#f2e9dc`, `#d6b36a`, `#b84a59`) and art direction.

1. Select the affected flow and a deterministic state: content release (`unity_export_manifest.json`), test account/seed, viewport (`1920×1080` reference landscape and `16:9`–`21:9` phone ratios), locale, fonts (`Cinzel`, `Cormorant Garamond`), motion state (`ReducedMotion`), and navigation step. Do not disable live authentication or inject financial state into a shared staging player to make a capture.
2. Exercise desktop landscape and narrow/wide phone landscape with `Screen.safeArea` handling. Check clipped text, readable contrast, button/target sizes (`>= 48 dp`), modal focus trapping, reduced motion, loading, empty/unavailable, failed refresh, and navigation cancellation across both Unity 6 Runtime UI Toolkit (`UIDocument`) overlays and the URP 2D stage (`BattleStageController` / `StoryStageController`), as well as the React Control Center (`apps/admin`).
3. Capture screenshots, console/log exceptions, and relevant failed requests. Label artifacts with source commit and actual viewport/state. Never auto-accept a changed baseline to hide a defect.
4. For the React Control Center (`apps/admin`), use the pinned Chrome DevTools launcher or Playwright when available. For Unity (`apps/unity/`), verify bundle/slice state via `uomd-unity-live` MCP (`unity_bundle_status`, `unity_inspect_unit_slices`) and Unity PlayMode/EditMode captures when the Unity Editor CLI is present.
5. For Monitoring, verify actual provenance/timestamp/stale/error behavior using `uomd-monitoring`. For monetization, UI evidence must be supplemented by Worker verification and actual Android IL2CPP sandbox/device evidence (`uomd-android-release-qa`).
