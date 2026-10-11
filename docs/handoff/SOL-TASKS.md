# Sol 6.1 task list (see docs/AGENT_RULES.md section 5 for deliverables and acceptance)
Tick a box only when committed and accepted; add `commit <hash> - what is left`.

- [x] SOL-1 Combat effect specification and test vectors (`docs/combat/OPS_SPEC.md`, `docs/combat/vectors/*.json`)
  - commit `0cdc0a07` — accepted: 22 missing-op sections, 44 op scenarios + 10 status scenarios; JSON/HP/Focus/coverage checked. Left: Claude resolves C01–C39 and implements the adapter/engine replay; these are proposed vectors, not passing engine tests.
- [ ] SOL-2 Store and legal texts, EN (TR deferred by owner 2026-10-11) (`docs/store/`)
- [ ] SOL-3 Android real-device QA plan (`docs/QA_ANDROID.md`)
- [ ] SOL-4 Runbook (`docs/RUNBOOK.md`)
- [ ] SOL-5 Media production queue (`docs/media/QUEUE.md`)
- [ ] SOL-6 Localization catalog, EN source only (TR deferred by owner 2026-10-11; `docs/i18n/STRINGS.md`)
- [ ] SOL-7 Economy tuning proposal (`docs/economy/TUNING_PROPOSAL.md`)
- [x] SOL-8 Side-story requirements for the engine (`docs/handoff/EVENT_REQUIREMENTS.md`)
  - commit `5a82fae3` — accepted: all 8 packages / 32 encounter variants audited against grammar, enemy IDs and null rewards. Left: production mappings, rewards, event state and Japanese media bindings.

Owner scope (2026-10-11): English player text only for now; all produced spoken dialogue must be Japanese (`ja-JP`, Chirp 3 HD). No media generation is authorized by this handoff task.

Suggested order: SOL-1 first (it unblocks Claude's combat work), then SOL-8, SOL-3, SOL-4, SOL-2, SOL-6, SOL-5, SOL-7.
