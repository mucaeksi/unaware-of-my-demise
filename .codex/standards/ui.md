# Premium fantasy UI and UX

Read the applicable source constitution, component kit and Entry flow under `docs/ui/production-v001/source/`. Functional source is the current runtime/spec/registry; visual proposals do not alter mechanics. Runtime visible text is English, voice Japanese, Android portrait, reference 1080x1920.

Use a Control/Container layout, device safe areas, scalable Theme variations, and tested 9-slice frames. Transform animated art on a Node2D stage outside containers when appropriate. Do not bake copy, rarity, status bars or device cutouts into artwork. Keep decorative backgrounds separate from interaction Controls.

Source authoring candidates: side inset 48px; gaps 24/36/48/72px; standard target about 48dp (144px at 3x reference). Use the runtime's existing values and verify physical/logical scaling on target devices. Reduce spacing and nonessential ornament before text or touch targets. Large Text must reflow. Source font recommendations are Cinzel and Source Sans 3 with their licenses; preserve already integrated project fonts.

Required states where relevant: loading, empty/populated, locked, disabled, offline, error, pending, confirmed/success and confirmation. Loading differs from submitted Pending; Locked differs from currently Disabled. Pending blocks duplicate submission; only a confirmed authoritative payload updates final cost/reward/inventory. Preview uses local sample data and never grants rewards.

Define arrival context, navigation position, entry/exit, component/state inventory, data owner/null/update handling, events, transitions, copy expansion and measurable acceptance criteria. Android Back resolves top modal, child sheet, then route. Persistent hub navigation is absent in Entry, battle and VN. Do not impose keyboard/gamepad work on the Android target.

Check non-color meaning, contrast, long English text, Large Text, Reduced Motion and device safe areas. Source handoff targets 4.5:1 body text and 3:1 large text/non-text elements where practical. Retain captures at compact 720x1600, base 1080x1920 and tall 1080x2400/cutout-like layouts when those changed areas need coverage.

Motion source candidates: standard transitions 160-220ms, large sheets 200-280ms, press 70-110ms. Keep established production timings unless changing them is in scope. Reduced Motion removes ornamental parallax, drifting particles and shimmer while retaining essential state feedback. Entry download progress always comes from verified bytes, never story time.

Sources: `docs/ui/production-v001/source/UOMD_Godot_UI_Architecture_v001.md`, current Entry reports and `.codex/references/ux-review-checklist.md`. Preserve their documented limitations and approval states.
