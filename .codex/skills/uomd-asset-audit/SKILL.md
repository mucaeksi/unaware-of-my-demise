---
name: uomd-asset-audit
description: "Audit UOMD asset format, dimensions, hashes, provenance, references and mobile readability without changing originals."
---

# uomd-asset-audit

Read [asset standards](../../standards/asset-pipeline.md) and [audit workflow](../../workflows/asset-audit.md). Run [audit_assets.py](../../scripts/audit_assets.py) on the requested directory for actual measurements. Inspect references, license/source manifests and approval status. Classify measured violations separately from unknowns and suspected orphans. Return COMPLIANT / WARNINGS / NON-COMPLIANT / NOT ASSESSED with evidence and scoped remediation; do not delete, rename, generate or promote assets as part of a read-only audit.
