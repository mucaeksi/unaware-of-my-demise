# UI v2 and 2.5D battle — design brief (Decision D-34)

Owner decision 2026-10-25: the client UI is redesigned from scratch ("UI v2") and battles move to a 2.5D presentation.
Gameplay, combat logic (bit-exact server parity), content, patching, backend and the Android bridge stay as they are; only
what the player sees changes. This brief sits under the README (it is not a second master prompt) and next to
[ART_BIBLE](../media/ART_BIBLE.md), whose palette, identity anchors and colour rules still apply. Prompts for the owner's
Gemini runs: [UI_V2_GEMINI_PROMPTS](UI_V2_GEMINI_PROMPTS.md).

## 1. Why UI v2

The ported screens were rebuilt 1:1 from the retired web client, laid out in C# coordinates, with no approved visual design
and almost no UI art (procedural panels plus a few textures). Changing layouts on top of that did not fix it. UI v2 changes
the order of work: **approved visual design first, then a UI art kit, then implementation** — never code first.

## 2. Design language: "The Bell Ledger"

The UI is the chronicle a pilgrim keeps on the road: ledger pages, wax seals, bell motifs, thin gilt rules, inked
marginalia, under an eclipsed sky. Three references are merged as principles only (README R-references: no assets, logos,
icons or distinctive layouts are copied, and no game or franchise name ever appears in a prompt):

| Take from | What we take | What we leave |
|---|---|---|
| Limbus Company (lead) | dark high-contrast staging, sharp angular frames and cut corners, one aggressive accent colour, cinematic battle camera with close-ups on key hits, grim institutional mood | its setting, logos, typography, UI chrome, its clash mechanic (our combat rules do not change) |
| Reverse: 1999 | editorial layouts: asymmetric pages, typography-led hierarchy, large character on stage, documents/collage as material, generous negative space | 1920s art deco, its paper and stamp designs |
| Arknights | functional clarity: consistent grid, readable stat blocks, every number legible at a glance, calm list/detail screens | sci-fi industrial look |

Rules that make it ours:
- **Palette**: ART_BIBLE §1 unchanged. Dark-dominant (void `#0A0610`, ink `#120A18`, plum `#2A1530`), bone ivory `#E9E2D4`
  text, gilt `#B8975A`/`#E3C37D` rules, **crimson `#8F1D3A`/`#D4325C` as the one aggressive accent** (wax seal = primary
  action, clash slashes, enemy marks). Lilac `#C9B6E4` for Veil/ornament.
- **Shapes**: cut-corner rectangles and angled slashes (not rounded pills), hairline gilt rules, wax-seal discs for primary
  actions, bell and eclipse-ring motifs used sparingly.
- **Type**: Cinzel (display, letter-spaced caps), Cormorant Garamond (body, italics for flavour). A third face for numbers
  and stats is an open decision (§6); it must be OFL-licensed.
- **Materials**: aged vellum and ink only as accents (headers, cards, seals) on dark grounds — never a full parchment screen.
- **Hierarchy**: one primary action per screen, at most four primary paths on a hub, everything else secondary text or icons.
- **Motion**: page-turn and ink-bleed transitions, seal-press on confirm, slow ash drift; all honour reduced motion.

## 3. Screen set and order

1. **Home** — character on stage (left 55%), numbered ledger menu (right): I Chapters, II Summon, III Roster, IV Team;
   secondary links and a utility strip. The Home prototype (`HomePrototypeScreen.cs`) is a layout study only.
2. **Battle (2.5D)** — §4.
3. **Title** — key art, wordmark, one "tap to begin" line, sign-in, settings.
4. **Roster / character detail** — Arknights-like clarity in Bell Ledger dress: portrait, stat block, skills, gear.
5. **Summon** — banner art full-bleed, rates/pity one tap away (economy transparency rules stay).
6. **Story / dialogue** — portraits, dialogue plate, AUTO/SKIP/LOG.
7. Remaining hub screens reuse the components from 1–6.

## 4. 2.5D battle

Goal: the feel of a cinematic, depth-staged battle — 2D painted characters in a scene with real depth, a perspective
camera that pushes in on actions and cuts to close-ups on counters, crits and ultimates.

Technical plan (presentation only; `Uomd.Combat` and the server replay are untouched):
- Today the whole battle is drawn in UI Toolkit. The battle **world** moves to scene GameObjects: `SpriteRenderer` units,
  a **perspective camera**, and the painted background split into 3–5 depth planes (sky, far, mid, ground, foreground fog).
  URP 2D renderer stays (2D lights, sprite sorting by depth); no renderer switch is needed for this step.
- UI Toolkit keeps only the HUD (turn order, skill cards, HP/focus, AUTO/speed/menu).
- Camera language: idle wide shot with slow drift; push-in on the acting unit; short cut-ins (0.4–0.8 s) for counters,
  crits and ultimates (events the engine already emits); screen shake and hit-stop already exist (`game-feel` rules).
- Readability first: the BrownDust2/AFK principle in the README still holds — targeting and HP must be readable in the
  wide shot; close-ups never hide a decision the player must make.

Phases: **B1** layered stage + perspective camera with the existing chibi atlases (cheap, proves the feel) → **B2** camera
moves and cut-ins → **B3** chibi sheets refreshed for the 2.5D stage (three-quarter view, contact shadows, depth scale);
proportions stay chibi (owner, 2026-10-25). Stage-1 targets approved: [REVIEW](../../narrative/15_Art_Workbench/ui_v2/REVIEW_2026-10-25.md).

## 5. Workflow

1. Claude writes prompts → the owner generates in Gemini (3–4 variants per prompt), saves them to
   `narrative/15_Art_Workbench/ui_v2/mockups/<prompt_id>_v###.png`.
2. Claude reviews against this brief and ART_BIBLE, picks or adjusts prompts; the owner approves one target per screen.
3. From approved targets: UI art kit prompts (frames, buttons, seals, textures, icons, stage planes), green-keyed per
   ART_BIBLE §3.0, ingested with `tools/ingest_art.ts`.
4. Implementation in **UI Builder (UXML + USS)** so the owner can tweak layouts in the Editor; C# binds data and behaviour.
   This replaces the "screens built only in C#" rule for UI v2 screens (README update when implementation starts).
5. Each screen: Play-mode captures at 16:9, 20:9 and 4:3, safe-area check, owner sign-off, then the next screen.

Mockups are design targets only and are never shipped; ART_BIBLE's "no text in images" rule applies to shipped assets.

## 6. Open owner decisions

- ~~Battle unit proportions for B3~~ — resolved 2026-10-25: cute 3–3.5-head chibi units, staged in 2.5D.
- Number/stat typeface (OFL candidates to compare in mockups).
- Whether UI v2 ships in the first AAB or as the first client update after it (release roadmap D-29).
