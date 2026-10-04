class_name GameViews
extends RefCounted
## Display-ready rows for the team, skills and inventory screens (ports of `TeamMember`, `InventoryEntry` and the skill preview of
## client/game_controller.py): names and formatted numbers, never ids; every figure comes from the services. `-1` stands for "none" in the
## integer fields (a Python `None`).


## One owned hero's progression.
class TeamMember extends RefCounted:
	var character_id: String = ""
	var name_en: String = ""
	var rarity: int = 0
	var level: int = 1
	var xp: int = 0
	## XP the next level needs; -1 at the level cap.
	var xp_to_next: int = -1
	var ascension: int = 0
	var level_cap: int = 20
	## Silver Crowns the next level costs; -1 at the level cap.
	var next_level_silver_crowns: int = -1
	var memory_shards: int = 0
	var memory_nodes: int = 0
	var memory_total: int = 0


## One Chronicle item that gives character XP.
class XpItem extends RefCounted:
	var item_id: String = ""
	var name_en: String = ""
	var xp_each: int = 0
	var owned: int = 0


## One skill of a hero, with what its next rank costs.
class SkillRow extends RefCounted:
	var skill_id: String = ""
	var name_en: String = ""
	var type: String = ""
	var rank: int = 1
	var max_rank: int = 1
	## False at the maximum rank.
	var has_next: bool = false
	var next_level: int = 0
	var next_silver_crowns: int = 0
	var next_item_id: String = ""
	var next_item_name: String = ""
	var next_item_quantity: int = 0


## One owned equipment instance.
class InventoryEntry extends RefCounted:
	var table: String = ""
	var instance_id: String = ""
	var template_id: String = ""
	var name_en: String = ""
	## "weapon" | "armor" | "accessory".
	var kind: String = ""
	var rarity: int = 0
	## -1 for an accessory (no level).
	var level: int = -1
	var locked: bool = false
	var slot: String = ""
	## "" when nobody wears it.
	var equipped_character_id: String = ""
	var equipped_character_name: String = ""
	var stats_text: String = ""
	var can_dismantle: bool = false
	var can_reroll: bool = false
	var can_level_up: bool = false


## `2` for 2.0, `0.08` for 0.08: the way the content authors write a stat (JSON numbers all arrive as floats).
static func number_text(value: Variant) -> String:
	if value is float:
		var number: float = value
		if is_equal_approx(number, roundf(number)) and absf(number) < 1.0e9:
			return str(int(number))
		return String.num(number)
	return str(value)
