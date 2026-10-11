# SOL-1–8 documentation/data acceptance

2026-10-11. Owner override: English deliverables only; spoken dialogue Japanese. All eight task packages are committed to `main`; hashes and remaining implementation/review decisions are in [SOL-TASKS.md](SOL-TASKS.md). Machine-readable executed checks: [SOL_VALIDATION.json](SOL_VALIDATION.json).

| Package | Deliverable | Executed acceptance |
|---|---|---|
| SOL-1 | [Combat specification](../combat/OPS_SPEC.md), vectors, source-usage data | All22 missing ops have sections and two cases;9 missing-status sections;54 scenarios, full snapshot bounds, valid JSON |
| SOL-8 | [Event requirements](EVENT_REQUIREMENTS.md), audit | All8 packages/32 encounter variants, canonical enemy IDs, unknown rewards left null |
| SOL-3 | [Android QA](../QA_ANDROID.md) | All24 named cases and first-AAB requirement mapping, source tables/endpoints reviewed |
| SOL-4 | [Runbook](../RUNBOOK.md) | Logs, code/content rollback, local/remote restoration boundary, signing, refund and player reset covered |
| SOL-2 | [English store pack](../store/README.md) | Play text lengths, exact authorized-seller line, export/delete mapping, UNKNOWN legal/SDK/rating facts |
| SOL-6 | [English string catalog](../i18n/STRINGS.md) | 38 source files,375 unique allocated keys,1,003 excluded literals; all1,378 offsets/lines/raw literals, source hashes and placeholder bindings match |
| SOL-5 | [Media queue](../media/QUEUE.md) | Exact20 playable/27 enemy IDs,235 prompts, source hashes, adult ages, tutorial priority and $18.941 baseline arithmetic |
| SOL-7 | [Economy proposal](../economy/TUNING_PROPOSAL.md) | Eight runs of actual analyzeFlow source, three archetypes each, cash conservation, fee/XP totals, strict no-ad recovery and shop counterexample |

Every authored package commit touches only `docs/**`. `git diff --check` passed. Other agents' upstream changes were merged, including the Cloudflare build-path update; Sol did not author workflow deletions or application/narrative/content changes. No runtime code or runtime-read JSON changed, so code-test gates were not triggered for these docs-only packages.

These checks accept the **documents/data handoff**, not a game release or reviewer approval of proposed gameplay/canon/legal decisions. Combat vectors require the future adapter/engine implementation; no engine replay is claimed. Android/Play/AdMob device tests, browser rendering, signed-patch activation, authenticated economy HTTP, media production and operator recovery operations were not performed. The economy execution used the exact pure function behind POST /admin/api/economy/flow locally, not an authenticated live call.

Outstanding decisions are in [QUESTIONS.md](QUESTIONS.md) and each package's UNKNOWN list. Critical source finding: ops staging BACKUP_PROBE=1 can write plaintext SQL backup probes; Claude must inspect actual deployed configuration and handle approved cleanup. No bucket/deployment/data mutation was performed. Legal identity/URLs/retention, advanced combat semantics, final-boss repeat5★ contradiction, unconditional income implementation, Japanese transcript/casting and art-reference/export approvals remain explicit.
