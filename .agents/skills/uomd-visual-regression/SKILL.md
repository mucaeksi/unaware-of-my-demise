---
name: uomd-visual-regression
description: Verify UOMD Phaser game and React Control Center UI behavior using reproducible browser states, landscape/touch screenshots, existing Playwright flows and visible error/freshness checks.
---
# UOMD visual and browser regression

Read README, [phaser4-mobile-qa](../phaser4-mobile-qa/SKILL.md), [phaser4-anime-ui](../phaser4-anime-ui/SKILL.md) and their canonical sources. Use ui-ux-pro-max for focused local guidance while preserving existing Gothic tokens/art direction. Inspect current tests/e2e configs, fixtures and screenshots before adding coverage.

1. Select the affected flow and a deterministic state: content release, test account/seed, viewport, locale, fonts, motion state and navigation step. Reuse existing Playwright test flows and the local test stack; do not disable live authentication or inject financial state into a shared staging player to make a screenshot.
2. Exercise desktop landscape and narrow/wide phone landscape with touch/safe-area handling. Check clipped text, readable contrast, button/target sizes, dialog focus, reduced motion, loading, empty/unavailable, failed refresh and navigation cancellation. Phaser canvas assertions need gameplay/UI behavior or accessible DOM state where available, not DOM assumptions about drawn text.
3. Capture screenshots, console/page exceptions and relevant failed requests, plus trace when useful. Label artifacts with source commit and actual viewport/state. Existing screenshots are visual evidence, not automatically enforced pixel baselines. Add approved stable snapshot comparisons only when they catch a meaningful regression; never auto-accept a changed baseline to hide a defect.
4. Check actual browser availability and live tool schemas. Use the pinned Chrome DevTools launcher only when connected; use available Playwright otherwise. The existing `UOMD_CHROMIUM_PATH` option may select a provisioned browser. Do not auto-download unreviewed tooling or bypass network policy when a browser is missing.
5. Run focused affected scenarios first and required checks appropriate to the change. Inspect local test setup: it can write .cache/ and test screenshots and manipulate only its isolated local D1/R2. In a source-only review, report these side effects and keep artifacts in scratch/an isolated disposable checkout; do not write tracked screenshot baselines or shared databases.

For Monitoring, verify actual provenance/timestamp/stale/error behavior using uomd-monitoring. For monetization, browser evidence must be supplemented by Worker verification and actual Android sandbox/device evidence. Avoid claiming measured FPS or native acceptance from software-rendered WebGL screenshots.
