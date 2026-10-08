# Quality review workflow

Review a concrete changed scope against current source requirements. Separate functional issues, visual/accessibility issues, performance measurements and unavailable evidence. Cite file/state/reproduction and a specific correction for each material finding.

Run the relevant headless checks and inspect the existing runtime for visual work. Use the established test harness without new dependencies. Retain native captures, logs and commands. A missing tool is UNVERIFIED/NOT ASSESSED; a reproduced defect is FAIL/NEEDS REVISION. Recheck only affected behavior after fixes.

Before calling a feature complete, verify its actual acceptance criteria and state remaining owner-review/device limits. Current migration validation is configuration/skill discovery; it does not certify game features.
