# Asset audit and promotion workflow

Read current standards, registry and source/license manifests. Run `.codex/scripts/audit_assets.py` against the requested directory to collect byte sizes, hashes, formats and PNG dimensions/transparency. Cross-check real runtime references separately; an unreferenced filename alone is not an orphan verdict.

Review identity, framing, anchors, licensing, approval/provenance, duplicates and inclusion in base/patch/export. Missing input is NOT ASSESSED, not compliance. Preserve originals; do not delete, re-encode, rename or promote merely because the scanner found a candidate.

For authorized promotion use existing IDs/version conventions, new derivative files and explicit source references. Validate decoding/imports, relevant tests and real runtime appearance. Keep local and read-only-source boundaries.
