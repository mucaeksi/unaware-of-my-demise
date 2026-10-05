"""Build the Part I asset plan (every image the game needs) from the content data.

Writes art/asset_plan_part1.json (machine-readable, read by the batch tooling) and docs/ASSET_PLAN_PART1.md.
Run from the narrative folder:  python3 tools/build_asset_plan.py
Statuses already set in the JSON (approved, generated, ...) are preserved on rebuild.
"""
import json, os, glob, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
N = os.path.normpath(os.path.join(HERE, ".."))
R = os.path.normpath(os.path.join(N, ".."))
J = lambda p: json.load(open(os.path.join(R, p), encoding="utf-8"))

chars = J("content/characters_part1.json")["characters"]
brand = J("content/brand_assets_part1.json")
enemies = J("content/enemies_part1.json")["enemies"]
CID = [c["character_id"] for c in chars]

# script usage per speaker
lines = collections.Counter()
for f in glob.glob(os.path.join(N, "content", "story_script_ch0*.json")) + [os.path.join(N, "content", x) for x in ("character_stories_part1.json", "events_part1.json")]:
    for m in re.finditer(r'"speaker_id":\s*"([^"]+)"', open(f, encoding="utf-8").read()):
        lines[m.group(1)] += 1

EXPR = {  # defined expression sets (prompt files exist)
    "fadyme": ["composed", "quiet_pain", "honest_fear", "warm"],
    "mahmut": ["watchful", "dry_humor", "protective_resolve", "gentle_concern", "grief"],
    "kera_voss": ["tsundere_scowl", "focused", "proud_smile", "flustered", "guilty", "defiant"],
    "brin_alder": ["quiet_focus", "protective_concern", "small_smile"],
}
PROMPT = {"fadyme": "prompts/asset_pipeline/pilot_fadyme.md", "mahmut": "prompts/asset_pipeline/mahmut.md",
          "kera_voss": "prompts/asset_pipeline/kera_voss.md", "brin_alder": "prompts/asset_pipeline/brin_alder.md"}
SHEET_PROMPT = {os.path.basename(p)[:-9]: "prompts/sheets/" + os.path.basename(p) for p in glob.glob(os.path.join(N, "prompts", "sheets", "*_sheet.md"))}
SHEET_PROMPT["sister_aveline"] = SHEET_PROMPT.pop("sister_aveline", "prompts/sheets/sister_aveline_sheet.md")
SHEET_PROMPT["lady_yseldra_vale"] = SHEET_PROMPT.pop("yseldra", None)
SHEET_PROMPT["lord_cael_veyr"] = SHEET_PROMPT.pop("cael", None)
POSES = ["idle", "attack", "hit", "skill", "guard", "victory"]
KEY = {"fadyme": "#00FF00", "mahmut": "#00FFFF", "kera_voss": "#00FFFF", "brin_alder": "#FF00FF", "nixie_vale": "#FF00FF"}

items = []


def add(asset_id, group, kind, subject, variant, mode, aspect, wave, approval, prompt, depends=(), refs=(), notes="", key=None, size="2K"):
    items.append(dict(asset_id=asset_id, file=f"{asset_id}_v001.png", group=group, kind=kind, subject=subject, variant=variant,
                      mode=mode, aspect=aspect, size=size, key_colour=key or ("opaque" if mode == "narrative" and kind in ("bg", "cg", "key_art", "banner", "cut_in", "sheet", "concept") else "#00FF00"),
                      wave=wave, approval=approval, prompt_source=prompt, depends_on=list(depends), refs=list(refs), status="todo", notes=notes))


def dash(i): return i.replace("_", "-")

# ---------------- W0 reference set (owner approves) ----------------
add("brand_logo_wordmark", "brand", "brand", "logo", "wordmark_r2", "narrative", "16:9", 0, "owner", "prompts/brand/brand_r2.md#1", key="#00FF00",
    refs=["art/brand/brand_logo.png"])
add("brand_key_art_portrait", "brand", "key_art", "key_art", "portrait_r2", "narrative", "9:16", 0, "owner", "prompts/brand/brand_r2.md#2",
    refs=["art/sheets/char-fadyme-uomd.png", "art/sheets/char-mahmut-uomd.png"], notes="no text; logo composited afterwards")
add("sheet_fadyme", "sheets", "sheet", "fadyme", "r2", "narrative", "2:3", 0, "owner", "template:sheet_r2",
    depends=["brand_key_art_portrait"], refs=["art/sheets/char-fadyme-uomd.png", "brand_key_art_portrait"],
    notes="saved as art/sheets/char-fadyme-uomd.png; becomes the layout/style reference for every other sheet")
for i, e in enumerate(EXPR["fadyme"]):
    add(f"vn_bust_fadyme_{e}", "busts", "vn_bust", "fadyme", e, "narrative", "2:3", 0, "owner", f"{PROMPT['fadyme']}#{['1','2','3','3b'][i]}",
        depends=["sheet_fadyme"] + ([] if i == 0 else ["vn_bust_fadyme_composed"]), key="#00FF00",
        notes="v001/v002 approved before sheet r2; keep if they still match the r2 sheet")
for i, p in enumerate(POSES):
    add(f"battle_pose_fadyme_{p}", "poses", "battle_pose", "fadyme", p, "play", "2:3", 0, "owner", f"{PROMPT['fadyme']}#{4+i}",
        depends=["sheet_fadyme"] + ([] if p == "idle" else ["battle_pose_fadyme_idle"]), key="#00FF00")
add("cut_in_fadyme_ultimate", "cut_ins", "cut_in", "fadyme", "ultimate", "narrative", "2:3", 0, "owner", "template:cut_in", depends=["sheet_fadyme"])
add("bg_forest_whispering_ash_ordered", "backgrounds", "bg", "forest_whispering_ash", "ordered", "narrative", "9:16", 0, "owner", f"{PROMPT['fadyme']}#10",
    notes="reference for every background")
add("bg_forest_whispering_ash_battle_plate_ordered", "backgrounds", "bg", "forest_whispering_ash", "battle_plate_ordered", "narrative", "9:16", 0, "owner",
    f"{PROMPT['fadyme']}#11", depends=["bg_forest_whispering_ash_ordered"], notes="reference for every battle plate")
add("icons_pilot_mixed", "icons", "icons", "pilot_mixed", "16_mixed", "play", "1:1", 0, "owner", f"{PROMPT['fadyme']}#12",
    notes="reference for every icon set")

# ---------------- brand variants (W2) ----------------
for v, ar, note in [("key_art_wide", "16:9", "STORE/WEB ONLY, not in game; logo composited"), ("key_art_square", "1:1", "STORE/SOCIAL ONLY, not in game; logo composited"),
                    ("app_icon", "1:1", "1024 px; Fadyme's hooded profile + bell; no text"),
                    ("adaptive_icon_foreground", "1:1", "foreground layer on key colour; background layer is flat plum"),
                    ("play_feature_graphic", "21:9", "STORE ONLY (Google Play requires landscape 1024x500); logo composited")]:
    add(f"brand_{v}", "brand", "key_art", "brand", v, "narrative", ar, 2, "director", "template:brand_variant",
        depends=["brand_key_art_portrait", "brand_logo_wordmark"], notes=note, key="#00FF00" if "foreground" in v else None)

# ---------------- character sheets (W1) ----------------
villains = ["lady_yseldra_vale", "lord_cael_veyr"]
for c in [x for x in CID if x != "fadyme"] + villains:
    note = {"nixie_vale": "fix hair to light brown, clearly darker than Fadyme's (current sheet paints it pale)",
            "kera_voss": "design unchanged; r2 prompt exists", "brin_alder": "design unchanged; r2 prompt exists",
            "sable_wren": "design decision open (audit CC-08) before generation",
            "rikka_ember": "weapon: forge hammer per data (audit CC-07)"}.get(c, "")
    add(f"sheet_{c}", "sheets", "sheet", c, "r2", "narrative", "2:3", 1, "director", SHEET_PROMPT.get(c) or "template:sheet_r2",
        depends=["sheet_fadyme"], refs=[f"art/sheets/char-{dash(c)}-uomd.png"] if os.path.exists(os.path.join(N, "art", "sheets", f"char-{dash(c)}-uomd.png")) else [],
        notes=note)
for npc, why in [("marshal_oren", "boss + 5 lines"), ("captain_rusk", "boss + lines (speaker rusk)"), ("red_vial_matron", "boss + line")]:
    add(f"sheet_{npc}", "sheets", "sheet", npc, "mini", "narrative", "2:3", 1, "director", "template:mini_sheet", depends=["sheet_fadyme"], notes=why)

# ---------------- VN busts ----------------
for c in [x for x in CID if x != "fadyme"] + villains:
    ex = EXPR.get(c) or [f"expression_{i+1}" for i in range(4 if lines[c] >= 30 else 3)]
    for i, e in enumerate(ex):
        add(f"vn_bust_{c}_{e}", "busts", "vn_bust", c, e, "narrative", "2:3", 2 if i == 0 else 3, "director",
            f"{PROMPT[c]}" if c in PROMPT else "template:vn_bust", depends=[f"sheet_{c}"] + ([] if i == 0 else [f"vn_bust_{c}_{ex[0]}"]),
            key=KEY.get(c), notes="" if c in EXPR else f"{lines[c]} script lines; name the expressions from the script's emotion values")
NPC_BUST = {"marshal_oren": 3, "captain_rusk": 2, "red_vial_matron": 2, "ashen_lord_wraith": 1, "shrine_keeper": 1, "old_priest": 1,
            "oakhaven_innkeeper": 1, "red_vial_alchemist_npc": 1, "refugee_woman": 1, "estate_servant": 1, "council_herald": 1,
            "old_potter": 1, "red_vial_agent": 1}
for npc, n in NPC_BUST.items():
    for i in range(n):
        e = "neutral" if i == 0 else f"expression_{i+1}"
        dep = [f"sheet_{npc}"] if npc in ("marshal_oren", "captain_rusk", "red_vial_matron") else ["sheet_fadyme"]
        add(f"vn_bust_{npc}_{e}", "busts", "vn_bust", npc, e, "narrative", "2:3", 2 if i == 0 else 3, "director", "template:vn_bust_npc",
            depends=dep + ([] if i == 0 else [f"vn_bust_{npc}_neutral"]), notes="NPC" if npc not in ("marshal_oren", "captain_rusk", "red_vial_matron", "ashen_lord_wraith") else "boss")

# ---------------- battle poses + cut-ins (playable) ----------------
for c in [x for x in CID if x != "fadyme"]:
    for p in POSES:
        add(f"battle_pose_{c}_{p}", "poses", "battle_pose", c, p, "play", "2:3", 2 if p == "idle" else 3, "director",
            PROMPT.get(c, "template:battle_pose"), depends=[f"sheet_{c}", "battle_pose_fadyme_idle"] + ([] if p == "idle" else [f"battle_pose_{c}_idle"]),
            key=KEY.get(c), refs=[f"art/sheets/chibi_ref/chibi_ref_{c}.png"] if p == "idle" else [])
    add(f"cut_in_{c}_ultimate", "cut_ins", "cut_in", c, "ultimate", "narrative", "2:3", 3, "director", "template:cut_in",
        depends=[f"sheet_{c}", "cut_in_fadyme_ultimate"])

# ---------------- enemies ----------------
for e in enemies:
    eid = e["enemy_id"]; boss = eid.startswith("boss_")
    if eid == "boss_bell_widow":
        subj_dep = ["sheet_lady_yseldra_vale"]
    elif eid in ("boss_marshal_oren", "boss_captain_rusk", "boss_red_vial_matron"):
        subj_dep = ["sheet_" + eid[5:].replace("captain_rusk", "captain_rusk")]
    else:
        add(f"concept_{eid}", "enemies", "concept", eid, "design", "narrative", "2:3", 1, "director", "template:enemy_concept",
            depends=["sheet_fadyme", "bg_forest_whispering_ash_ordered"], notes=f"{e['name_en']} · {e['role']} · {e['element']} · {e['faction_id']}")
        subj_dep = [f"concept_{eid}"]
    poses = ["idle", "attack", "skill", "hit"] if boss else ["idle", "attack", "hit"]
    for p in poses:
        add(f"battle_pose_{eid}_{p}", "enemies", "battle_pose", eid, p, "play", "1:1" if boss else "2:3", 2 if p == "idle" else 3, "director",
            "template:enemy_pose", depends=subj_dep + ["battle_pose_fadyme_idle"] + ([] if p == "idle" else [f"battle_pose_{eid}_idle"]))
for ph in ("phase_1", "phase_2"):
    add(f"boss_art_eclipse_construct_{ph}", "enemies", "cg", "boss_eclipse_construct", ph, "narrative", "2:3", 3, "director", "template:boss_splash",
        depends=["concept_boss_eclipse_construct", "bg_altar_first_eclipse_ordered"], notes="content/visual_assets_part1.json boss_art")

# ---------------- backgrounds ----------------
HUBS = ["forest_whispering_ash", "cathedral_saint_luthos", "village_oakhaven", "undercity_subterranean", "bridge_forsaken", "estate_ashen_lord", "altar_first_eclipse"]
for h in HUBS:
    for st in ("ordered", "uneasy", "chaotic"):
        for kind in ("", "battle_plate_"):
            aid = f"bg_{h}_{kind}{st}"
            if any(x["asset_id"] == aid for x in items):
                continue
            base = f"bg_{h}_ordered"
            add(aid, "backgrounds", "bg", h, kind + st, "narrative", "9:16", 2 if (st == "ordered" and not kind) else 3, "director", "template:bg",
                depends=["bg_forest_whispering_ash_ordered"] + ([] if aid == base else [base]) + (["bg_forest_whispering_ash_battle_plate_ordered"] if kind else []))
    add(f"map_node_{h}", "backgrounds", "bg", h, "map_node", "play", "1:1", 3, "director", "template:map_node", depends=[f"bg_{h}_ordered", "icons_pilot_mixed"])
reg = open(os.path.join(N, "lore", "locations", "registry.md"), encoding="utf-8").read()
for m in re.finditer(r"^\| `([a-z0-9_]+)` \| (`[a-z0-9_]+`|road / side content) \|", reg, flags=re.M):
    lid, parent = m.group(1), m.group(2).strip("`")
    side = parent == "road / side content"
    add(f"bg_{lid}_ordered", "backgrounds", "bg", lid, "ordered", "narrative", "9:16", 3, "director", "template:bg",
        depends=["bg_forest_whispering_ash_ordered"] + ([] if side else [f"bg_{parent}_ordered"]),
        notes="needs a location brief first (registry: none)" if side else f"variant of {parent}")

# ---------------- story CGs ----------------
CG = [("opening_letter", "opening_sad_scene", "Fadyme alone in the wayshrine at night, writing the letter by one candle, a blood-marked glove, rain at the door"),
      ("the_roof", "1-2", "Brin bracing a burning beam over the woodcutters' shelter while Mahmut takes the other end"),
      ("ash_falls_upward", "ch1_camp", "night camp at the shrine; ash above the fire drifts upward; a cracked handbell rings far off"),
      ("bell_widow_verdict", "2-5", "Yseldra in the flooded nave calling Fadyme's name; the company below her"),
      ("the_well", "3-3", "Fadyme raising the bell over the poisoned well, the spell costing more than she shows"),
      ("measure_of_a_life", "4-3", "the Red Vial ward ledger open; Fadyme reading her own count"),
      ("white_strand", "5-4", "on the bridge in fog, Fadyme's hood slips and one bone-white lock shows; Mahmut does not see it"),
      ("oren_holds_the_span", "5-5", "Marshal Oren alone on the bridge span, holding it, then leaving by the estate road"),
      ("portraits_without_names", "6-2", "gallery of portraits with cut nameplates; the mother's portrait with the bell pin; the gloved attendant beside a watch with no hands"),
      ("stair_of_seven_chains", "7-1", "a stair through the mountain crossed by seven chains, each with a gray seven-notched seal"),
      ("those_who_held_the_road", "7-2", "the companions arriving on the stair to hold the road"),
      ("names_we_kept", "7-3", "Mirel writing Fadyme's name back on the record while the others speak it"),
      ("the_words_he_did_not_know", "part1_emotional_confession", "outer dais at dawn; Mahmut's confession; Fadyme's composed face finally breaking"),
      ("the_hour_that_remained", "part1_clockless_reveal", "Cael revealed in the reflection of the altar; a pocket watch with no hands"),
      ("uncle", "ending", "Fadyme looking at Cael: 'Uncle.'")]
for cid, scene, desc in CG:
    add(f"cg_{cid}", "story_cgs", "cg", scene, cid, "narrative", "9:16", 3, "director", "template:cg", notes=desc,
        depends=["brand_key_art_portrait", "sheet_fadyme", "sheet_mahmut"])

# ---------------- banners ----------------
for b in J("content/visual_assets_part1.json")["banner_key_art"]:
    add(f"banner_{b['id']}", "banners", "banner", b["id"], "key_art", "narrative", "9:16", 3, "director", "template:banner",
        depends=[f"sheet_{b['featured_character']}", "brand_key_art_portrait"], notes=b["brief"])
for b in J("content/visual_assets_part1.json")["weapon_banner_key_art"]:
    add(f"banner_{b['id']}", "banners", "banner", b["id"], "key_art", "narrative", "9:16", 3, "director", "template:banner",
        depends=["brand_key_art_portrait"], notes=b["brief"])
add("banner_hall_of_armaments", "banners", "banner", "hall_of_armaments", "key_art", "narrative", "9:16", 3, "director", "template:banner",
    depends=["brand_key_art_portrait"], notes="standard weapon banner")

# ---------------- icon sets ----------------
def chunk(prefix, names):
    for i in range(0, len(names), 16):
        cells = names[i:i + 16]
        add(f"icons_{prefix}_{i // 16 + 1}", "icons", "icons", prefix, f"{len(cells)}_cells", "play", "1:1", 2 if i == 0 else 3, "director",
            "template:icon_set", depends=["icons_pilot_mixed"], notes="cells: " + ", ".join(cells))
chunk("elements_statuses", [x["entity_id"] for x in brand["elements"]] + [x["entity_id"] for x in brand["statuses"]])
chunk("currencies_items", [x["entity_id"] for x in brand["currencies"]] + [x["entity_id"] for x in brand["progression_items"]])
chunk("weapon_families", [x["entity_id"] for x in brand["weapon_families"]])
chunk("signature_weapons", [x["entity_id"] for x in brand["weapons"]])
chunk("accessories_armor", [x["entity_id"] for x in brand["accessory_sets"]] + [x["entity_id"] for x in brand["armor_families"]])
chunk("skills", [s["skill_id"] for c in chars for s in c["skills"]])
chunk("enemies_villains", [e["enemy_id"] for e in enemies] + [x["entity_id"] for x in brand["villains"]])
chunk("chapters_banners", [x["entity_id"] for x in brand["chapters"]] + [x["entity_id"] for x in brand["banners"]])

# ---------------- VFX (needs a technical spec first) ----------------
for c in CID:
    for v in ("active", "ultimate"):
        add(f"vfx_{c}_{v}", "vfx", "vfx", c, v, "play", "1:1", 4, "director", "template:vfx (after tech spec)",
            depends=[f"battle_pose_{c}_skill"], notes="frame count / sheet layout from the technical team")
for el in [x["entity_id"] for x in brand["elements"]]:
    add(f"vfx_hit_{el}", "vfx", "vfx", el, "hit", "play", "1:1", 4, "director", "template:vfx (after tech spec)", depends=["icons_elements_statuses_1"])

# ---------------- preserve statuses, write ----------------
out = os.path.join(N, "art", "asset_plan_part1.json")
old = {x["asset_id"]: x for x in json.load(open(out))["assets"]} if os.path.exists(out) else {}
for x in items:
    if x["asset_id"] in old:
        x["status"] = old[x["asset_id"]].get("status", "todo")
for x in items:
    if x["asset_id"] in ("vn_bust_fadyme_composed", "vn_bust_fadyme_warm", "vn_bust_fadyme_honest_fear", "vn_bust_fadyme_quiet_pain") and x["status"] == "todo":
        x["status"] = "approved_pre_sheet_r2"
ids = {x["asset_id"] for x in items}
missing = sorted({d for x in items for d in x["depends_on"] if d not in ids})
PRICE = {"batch": 0.050, "standard": 0.101}
gen = [x for x in items if x["group"] != "vfx"]
w0 = [x for x in items if x["wave"] == 0]
rest = [x for x in gen if x["wave"] > 0]
cost = dict(w0_standard=round(len(w0) * PRICE["standard"] * 2.0, 2), rest_batch=round(len(rest) * PRICE["batch"] * 1.6, 2))
json.dump(dict(generated_by="tools/build_asset_plan.py", total=len(items), missing_dependencies=missing, cost_estimate_usd=cost,
               assets=items), open(out, "w", encoding="utf-8"), indent=1)

# ---------------- markdown ----------------
G = collections.OrderedDict((g, []) for g in ["brand", "sheets", "busts", "poses", "cut_ins", "enemies", "backgrounds", "story_cgs", "banners", "icons", "vfx"])
for x in items:
    G[x["group"]].append(x)
TITLE = {"brand": "Brand", "sheets": "Model sheets", "busts": "VN busts", "poses": "Battle poses (chibi)", "cut_ins": "Ultimate cut-ins",
         "enemies": "Enemies and bosses", "backgrounds": "Backgrounds", "story_cgs": "Story illustrations (CG)", "banners": "Banners", "icons": "Icon sets", "vfx": "VFX"}
md = ["# Asset Plan — Part I", "",
      "Generated by `tools/build_asset_plan.py` from the content data (characters, enemies, brand registry, location registry, banners). "
      "Machine-readable copy: `art/asset_plan_part1.json` (read by the batch tooling). Rebuild after data changes; statuses are preserved.", "",
      "## Summary", "", "| Group | Images | Wave 0 (owner) | Wave 1 | Wave 2 | Wave 3 | Wave 4 |", "|---|---|---|---|---|---|---|"]
for g, xs in G.items():
    wc = collections.Counter(x["wave"] for x in xs)
    md.append(f"| {TITLE[g]} | {len(xs)} | {wc[0]} | {wc[1]} | {wc[2]} | {wc[3]} | {wc[4]} |")
md.append(f"| **Total** | **{len(items)}** | {sum(1 for x in items if x['wave']==0)} | {sum(1 for x in items if x['wave']==1)} | {sum(1 for x in items if x['wave']==2)} | {sum(1 for x in items if x['wave']==3)} | {sum(1 for x in items if x['wave']==4)} |")
md += ["", "**Waves.** 0 = reference set, generated one by one, approved by the owner. 1 = model sheets and enemy concepts. "
       "2 = base assets (first bust, idle pose, hub backgrounds, first icon set of each family, brand variants). 3 = everything that depends on a wave-2 image. "
       "4 = VFX, after the technical team specifies frame counts and sheet layout. Waves 1–4 are generated in batches (50% price) and approved by the Narrative & Visual Director.", "",
       f"**Cost estimate (Nano Banana 2, 2K):** wave 0 one by one, two tries each ≈ ${cost['w0_standard']}; waves 1–3 in batches with 60% retries ≈ ${cost['rest_batch']}. VFX not included.", "",
       "**Not in this plan:** UI chrome (frames, buttons, panels: technical/UX team); character roster icons (cropped from the approved base bust, no generation); vector marks (the technical team vectorizes the approved icon cells).", ""]
if missing:
    md += ["**Unresolved dependencies:** " + ", ".join(missing), ""]
for g, xs in G.items():
    md += [f"## {TITLE[g]} ({len(xs)})", "", "| Asset | Wave | Approval | Depends on | Prompt | Status | Notes |", "|---|---|---|---|---|---|---|"]
    for x in xs:
        md.append(f"| `{x['asset_id']}` | {x['wave']} | {x['approval']} | {', '.join(x['depends_on'])} | {x['prompt_source']} | {x['status']} | {x['notes']} |")
    md.append("")
open(os.path.join(N, "docs", "ASSET_PLAN_PART1.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
print(len(items), "assets; missing deps:", missing, cost)
