# Sol 6.1 task list (see docs/AGENT_RULES.md section 5 for deliverables and acceptance)
Tick a box only when committed and accepted; add `commit <hash> - what is left`.

- [x] SOL-1 Combat effect specification and test vectors (`docs/combat/OPS_SPEC.md`, `docs/combat/vectors/*.json`)
  - commit `0cdc0a07` — accepted: 22 missing-op sections, 44 op scenarios + 10 status scenarios; JSON/HP/Focus/coverage checked. Left: Claude resolves C01–C39 and implements the adapter/engine replay; these are proposed vectors, not passing engine tests.
- [x] SOL-2 Store and legal texts, EN (TR deferred by owner 2026-10-11) (`docs/store/`)
  - commit `22667f1b` — accepted for owner EN-only scope: listing limits, privacy/terms/ads texts, source-mapped Data Safety/IARC and exact app-ads line. Left: legal identity/contact/URLs, retention, final SDK/rating/product review; no submission.
- [x] SOL-3 Android real-device QA plan (`docs/QA_ANDROID.md`)
  - commit `c18fc30e` — accepted: all first-AAB identity/payment/ad/consent/offline acceptance areas have device steps and exact backend evidence. Left: physical-device execution and listed implementation/configuration blockers.
- [x] SOL-4 Runbook (`docs/RUNBOOK.md`)
  - commit `a10e4637` — accepted: source-backed logs/rollback/D1 restore/signing/refund/reset procedures and UNKNOWN gaps. Left: operator restore rehearsal and R01–R06 decisions; plaintext probe flagged to Claude.
- [x] SOL-5 Media production queue (`docs/media/QUEUE.md`)
  - commit `181aa9f9` — accepted: exact 20/27 catalog IDs, 235 English prompts, tutorial-first priority, Japanese VO rules and budget arithmetic checked. Left: reference/candidate approval, casting/transcripts, export contracts and staged Google production; no generation.
- [x] SOL-6 Localization catalog, EN source only (TR deferred by owner 2026-10-11; `docs/i18n/STRINGS.md`)
  - commit `c9774625` — accepted for owner EN-only scope: 38 production source files, 375 stable keys and all 1,378 literal occurrences classified; source hashes and placeholders checked. Left: Claude wires keys, dynamic server/narrative/native text and Japanese dialogue bindings.
- [ ] SOL-7 Economy tuning proposal (`docs/economy/TUNING_PROPOSAL.md`)
- [x] SOL-8 Side-story requirements for the engine (`docs/handoff/EVENT_REQUIREMENTS.md`)
  - commit `5a82fae3` — accepted: all 8 packages / 32 encounter variants audited against grammar, enemy IDs and null rewards. Left: production mappings, rewards, event state and Japanese media bindings.

Owner scope (2026-10-11): English player text only for now; all produced spoken dialogue must be Japanese (`ja-JP`, Chirp 3 HD). No media generation is authorized by this handoff task.

Suggested order: SOL-1 first (it unblocks Claude's combat work), then SOL-8, SOL-3, SOL-4, SOL-2, SOL-6, SOL-5, SOL-7.
