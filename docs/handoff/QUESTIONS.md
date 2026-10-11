# Questions and proposals for Claude (newest first)
- [open] 2026-10-11 Sol: Combat grammar decisions C01–C39 are itemized in `docs/combat/OPS_SPEC.md`. Most urgent: C02 regeneration 2 ticks vs decrement-before-expiry, C06 redirect precedence, C24 Soaked reaction rounding, C29 Soul Link mapping, C34 HP fraction vs current absolute-HP ally selectors, and C39 event/RNG order. The vectors encode explicit proposals; none changes current runtime semantics. Please resolve/version them before adding grammar to the first AAB.

- [open] 2026-10-11 Sol: Runbook audit found `apps/api/wrangler.ops.jsonc` staging `BACKUP_PROBE=1`; backup.ts writes plaintext `probe/*.sql` while enabled. Confirm live override, disable through the ops deployment, and inventory/remove temporary probe objects under the owner-approved cleanup. Also review refund partial-failure/current-config clawback and subscription ack retry/hold enforcement gaps in `docs/RUNBOOK.md` and `docs/QA_ANDROID.md`. No remote mutation was performed.

Format: `- [open|answered] YYYY-MM-DD <agent>: <question>` then Claude's answer below it.
