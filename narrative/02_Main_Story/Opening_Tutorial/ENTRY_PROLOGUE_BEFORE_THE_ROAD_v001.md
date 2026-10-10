# Before the Road — first-download light novel

Duration: **2:00 / 120 seconds**, including scene dissolves. Language: **English**. Version: v001, authored 2026-10-07 from existing history. New narration is an adaptation draft, not a change to the history ledger. No gameplay progression or rewards.

Read in a quiet, measured narrator voice. The text-only version uses the same timing; recorded narration is not yet provided. Keep the Entry main theme running. Audio cue IDs below are reserved, silent until a real asset is assigned.

## 0:00–0:12 — Before the Road

**Visual / animation:** Slow inward movement over the living street. Warm lamps; no eclipse.

**Narrator (entry_past_001):**

> Before the roads filled with ash, Veyrhold measured its days in bells. A sound from the tower meant another hour had passed.

**Audio slot:** `prologue_hours`.

## 0:12–0:26 — Names to Remember

**Visual / animation:** A slight lateral drift towards the name board. No legible invented names.

**Narrator (entry_past_002):**

> People carved their names on doors and trees, and wrote them in roadside registers. Not for fame. So someone would remember that they had been here.

**Audio slot:** `prologue_names`.

## 0:26–0:38 — Ordinary Days

**Visual / animation:** Hold the warm candle and inhabited doorway. No protagonist childhood reveal.

**Narrator (entry_past_003):**

> There were markets, journeys, and doors that opened to strangers. Small things, easily forgotten. Until the day people began to lose them.

**Audio slot:** `prologue_days`.

## 0:38–0:50 — The Throne Wars

**Visual / animation:** Dissolve into damaged city gates; no faction emblems or identifiable leaders.

**Narrator (entry_past_004):**

> The great houses fought over a throne. Fields emptied. Families took to the roads, carrying what they could. The war drew closer to the capital.

**Audio slot:** `prologue_wars`.

## 0:50–1:06 — Six Years Ago

**Visual / animation:** Slow upward drift through smoke. Never depict the king's death or its cause.

**Narrator (entry_past_005):**

> Then came Crownfall. The capital fell. The king died. By dawn, survivors were leaving behind streets they had once known by heart.

**Audio slot:** `prologue_crownfall`.

## 1:06–1:22 — What Remained

**Visual / animation:** Hold the open gate, then darken gently. No ritual, seal or villain.

**Narrator (entry_past_006):**

> They carried blankets, tools, and the names of those who had not come with them. Beyond the walls, the roads were still there. Home was not.

**Audio slot:** `prologue_aftermath`.

## 1:22–1:36 — A Name on the Road

**Visual / animation:** Return to the roadside name board. The knight is represented by his search, not an invented encounter.

**Narrator (entry_past_007):**

> Among the travelers was a knight who searched the village registers for one name. Village after village, winter after winter, he kept looking.

**Audio slot:** `prologue_search`.

## 1:36–1:48 — Found Again

**Visual / animation:** Dissolve to the approved forest road; do not depict or name the hill village as a new canon location.

**Narrator (entry_past_008):**

> In a hill village, he found her. She asked him to stay. He did. The road ahead would no longer be hers alone.

**Audio slot:** `prologue_reunion`.

## 1:48–2:00 — The Journey Begins

**Visual / animation:** Slow forward drift and a gentle hold. No ending, prognosis, family or mechanism reveal.

**Narrator (entry_past_009):**

> Now Fadyme and Mahmut walk together. The bells still ring. Neither has told the other everything. This is where their story begins.

**Audio slot:** `prologue_beginning`.

## Narrative boundaries

The living kingdom's everyday name rituals, succession wars, public Crownfall catastrophe, Mahmut's search and the reunion come from the sources listed in the runtime JSON. Ambient description adds no named character, event or historical cause. Exact declarations, royal legitimacy, sealing/delivery orders, Yseldra's past role, Cael, the Unwritten Hour, hidden motives, Fadyme's prognosis and the letter are excluded. The king's killer and why the Silent Bell was silenced remain unknown.

The main Part I opening remains the existing roadside-shrine scene. This prelude is a separate presentation during content download, with no story completion callback.

## Playback contract

- Play once during the first content installation; Skip dismisses only the story. Replay is available after it finishes while the download continues.
- Show actual transfer bytes and download/install state. Story elapsed time never drives download percentage.
- If installation finishes early, Finish/Skip can release the pending restart; the player can continue watching before restarting.
- Errors dismiss the presentation so Retry remains reachable. Interrupted viewing is not marked complete.
- Reduced Motion keeps scene timing and text, removes pan/zoom and uses immediate scene cuts.
- Locally shipped art and script are available before gameplay content mounts.

## Deliverables

- Runtime timeline: `game/data/entry/prologue_v001.json`.
- Playback UI: `game/scripts/ui/entry/entry_prologue.gd`.
- Data validation: `game/scripts/ui/entry/entry_prologue_script.gd`.
- Illustrated assets: `game/assets/ui/narrative/prologue_v001/`.
