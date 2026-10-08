## Phase 3A: UX Spec Validation Checklist

Run all checks against a `ux-spec.md`-based document.

### Completeness (required sections)

- [ ] Document header present with Status, Author, Platform Target
- [ ] Purpose & Player Need — has a player-perspective need statement (not
  developer-perspective)
- [ ] Player Context on Arrival — describes player's state and prior activity
- [ ] Navigation Position — shows where screen sits in hierarchy
- [ ] Entry & Exit Points — all entry sources and exit destinations documented
- [ ] Layout Specification — zones defined, component inventory table present
- [ ] States & Variants — at minimum: loading, empty/populated, and error states
  documented
- [ ] Interaction Map — covers all target input methods (check platform target
  in header)
- [ ] Data Requirements — every displayed data element has a source system and owner
- [ ] Events Fired — every player action has a corresponding event or null
  explanation
- [ ] Transitions & Animations — at least enter/exit transitions specified
- [ ] Input Method Completeness Checklist — a block for each input method in
  the Platform Target line; any unticked item is listed under Open Questions
- [ ] Accessibility Requirements — screen-level requirements present
- [ ] Localization Considerations — max character counts for text elements
- [ ] Acceptance Criteria — specific testable criteria proportionate to scope

### Quality Checks

**Player Need Clarity**
- [ ] Purpose is written from player perspective, not system/developer perspective
- [ ] Player goal on arrival is unambiguous ("The player arrives wanting to ___")
- [ ] The player context on arrival is specific (not just "they opened the
  inventory")

**Completeness of States**
- [ ] Error state is documented (not just happy path)
- [ ] Empty state is documented (no data scenario)
- [ ] Loading state is documented if the screen fetches async data
- [ ] Any state with a timer or auto-dismiss is documented with duration

**Input Method Coverage**
- [ ] If platform includes PC: keyboard-only navigation is fully specified
- [ ] If platform includes console/gamepad: d-pad navigation and face button
  mapping documented
- [ ] No interaction requires mouse-like precision on gamepad
- [ ] Focus order is defined (Tab order for keyboard, d-pad order for gamepad)

**Data Architecture**
- [ ] No data element has "UI" listed as the owner (UI must not own game state)
- [ ] Update frequency is specified for all real-time data (not just "realtime" —
  what triggers update?)
- [ ] Null handling is specified for all data elements (what shows when data is
  unavailable?)

**Accessibility**
- [ ] Accessibility tier from `accessibility-requirements.md` is matched or exceeded
- [ ] If Basic tier: no color-only information indicators
- [ ] If Standard tier+: focus order documented, text contrast ratios specified
- [ ] If Comprehensive tier+: screen reader announcements for key state changes
- [ ] Colorblind check: any color-coded elements have non-color alternatives

**GDD Alignment**
- [ ] Every GDD UI Requirement referenced in the header is addressed in this spec
- [ ] No UI element displays or modifies game state without a corresponding GDD
  requirement
- [ ] No GDD UI Requirement is missing from this spec (cross-check the referenced
  GDD sections)

**Pattern Library Consistency**
- [ ] All interactive components reference the pattern library (or note they are
  new patterns)
- [ ] No pattern behavior is re-specified from scratch if it already exists in
  the pattern library
- [ ] Any new patterns invented in this spec are flagged for addition to the
  pattern library

**Localization**
- [ ] Character limit warnings present for all text-heavy elements
- [ ] Any layout-critical text has been flagged for 40% expansion accommodation

**Acceptance Criteria Quality**
- [ ] Criteria are specific enough for a QA tester who hasn't seen the design docs
- [ ] Performance criterion present (screen opens within Xms)
- [ ] Resolution criterion present
- [ ] No criterion requires reading another document to evaluate

---

## Phase 3B: HUD Validation Checklist

Run all checks against a `hud-design.md`-based document.

### Completeness

- [ ] HUD Philosophy defined
- [ ] Information Architecture table covers ALL systems with UI Requirements in GDDs
- [ ] Layout Zones defined with safe zone margins for all target platforms
- [ ] Every HUD element has a full specification (zone, visibility trigger, data
  source, priority)
- [ ] HUD States by Gameplay Context covers at minimum: exploration, combat,
  dialogue/cutscene, paused
- [ ] Information Hierarchy gives every HUD element a priority tier (MUST KEEP /
  SHOULD KEEP / CAN HIDE / ALWAYS HIDE)
- [ ] Visual Budget defined (max simultaneous elements, max screen %)
- [ ] Platform Adaptation covers all target platforms
- [ ] Tuning Knobs present for player-adjustable elements
- [ ] Acceptance Criteria — specific testable criteria proportionate to scope

### Quality Checks

- [ ] No HUD element covers the center play area without a visibility rule to
  hide it
- [ ] Every information item that exists in any GDD is either in the HUD or
  explicitly categorized as "hidden/demand"
- [ ] All color-coded HUD elements have colorblind variants
- [ ] HUD elements in the Feedback & Notification section have queue/priority
  behavior defined
- [ ] Visual Budget compliance: total simultaneous elements is within budget

### GDD Alignment

- [ ] All systems in the current systems index when available with UI category have
  representation in HUD (or justified absence)

---

## Phase 3C: Pattern Library Validation Checklist

- [ ] Pattern catalog index is current (matches actual patterns in document)
- [ ] All standard control patterns are specified: button variants, toggle,
  slider, dropdown, list, grid, modal, dialog, toast, tooltip, progress bar,
  input field, tab bar, scroll
- [ ] All game-specific patterns needed by current UX specs are present
- [ ] Each pattern has: When to Use, When NOT to Use, full state specification,
  accessibility spec, implementation notes
- [ ] Animation Standards table present
- [ ] Sound Standards table present
- [ ] No conflicting behaviors between patterns (e.g., "Back" behavior consistent
  across all navigation patterns)

---



Apply the Android/Entry scope and input rules in `.codex/standards/ui.md`; generic platform branches apply only when that platform is actually targeted.
