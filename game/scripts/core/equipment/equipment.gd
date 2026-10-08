class_name Equipment
extends RefCounted
## Equipment compatibility and accessory set resolution (port of core/equipment.py).
##
## Needs the loaded ContentRegistry. Invalid content (a malformed slot list or set bonus) is reported through `error`
## where the reference raises ValueError; the calls then return the neutral value (empty slots / null).

## A content-authored percentage stat modifier from an accessory set.
class StatModifier extends RefCounted:
	var stat_id: String = ""
	var value_pct: float = 0.0


var _registry: ContentModels.ContentRegistry = null

## Last content problem ("" = none); reset by the public calls that can set it.
var error: String = ""


func _init(registry: ContentModels.ContentRegistry) -> void:
	_registry = registry


func _accessory_slots() -> Array[String]:
	var slots: Array[String] = []
	var raw: Variant = _registry.accessory_slots
	var valid: bool = raw is Array and not (raw as Array).is_empty()
	if valid:
		for slot: Variant in raw:
			if not (slot is String) or (slot as String).is_empty() or slots.has(slot):
				valid = false
				break
			slots.append(slot)
	if not valid:
		error = "accessories_part1.json has an invalid accessory_slots list"
		return []
	return slots


func _armor_slot_count() -> int:
	var raw: Variant = _registry.armor_slot_count
	if not (raw is int or raw is float) or float(raw) != floorf(float(raw)) or int(raw) < 0:
		error = "armors_part1.json has an invalid armor_slot_count"
		return -1
	return int(raw)


## Whether a weapon is legal for this character. A character's own signature weapon is allowed explicitly; any other
## character's signature weapon is rejected before the shared weapon-family check, even if its family matches.
func can_equip_weapon(character: ContentModels.Character, weapon: ContentModels.Weapon) -> bool:
	if weapon.weapon_id == character.signature_weapon_id:
		return true
	if not weapon.owner_character_id.is_empty() and weapon.owner_character_id != character.character_id:
		return false
	# Also protects signature weapons whose owner metadata was omitted from the weapon row but which stay linked
	# from a character record.
	for other: ContentModels.Character in _registry.characters.values():
		if other.character_id != character.character_id and other.signature_weapon_id == weapon.weapon_id:
			return false
	return weapon.weapon_type == character.equip_weapon_type


## All loadout validation errors; an empty array means valid. `armor`, `necklace` and `ring` may be null.
func validate_loadout(
	character: ContentModels.Character,
	weapon: ContentModels.Weapon,
	armor: ContentModels.Armor,
	accessory_necklace: ContentModels.AccessoryTemplate,
	accessory_ring: ContentModels.AccessoryTemplate
) -> Array[String]:
	error = ""
	var errors: Array[String] = []
	if not can_equip_weapon(character, weapon):
		errors.append("%s cannot equip weapon %s; expected signature %s or weapon type %s." % [
			character.name_en, weapon.weapon_id, ContentLoader.py_repr(character.signature_weapon_id),
			ContentLoader.py_repr(character.equip_weapon_type)])
	var armor_slots: int = _armor_slot_count()
	if armor_slots != 1:
		errors.append("Part I requires exactly one armor slot; catalog declares %d." % armor_slots)
	if armor == null:
		errors.append("Exactly one armor item is required in the 'armor' slot.")
	elif armor.slot != "armor":
		errors.append("The armor item must occupy the single 'armor' slot.")
	var slots: Array[String] = _accessory_slots()
	if accessory_necklace == null:
		errors.append("Exactly one accessory is required in the 'necklace' slot.")
	elif not slots.has("necklace") or accessory_necklace.slot != "necklace":
		errors.append("The necklace accessory must use the 'necklace' slot.")
	if accessory_ring == null:
		errors.append("Exactly one accessory is required in the 'ring' slot.")
	elif not slots.has("ring") or accessory_ring.slot != "ring":
		errors.append("The ring accessory must use the 'ring' slot.")
	return errors


## The authored set modifier when the equipped pieces meet its gate, else null.
func resolve_set_bonus(accessory_necklace: ContentModels.AccessoryTemplate, accessory_ring: ContentModels.AccessoryTemplate) -> StatModifier:
	error = ""
	if accessory_necklace.slot != "necklace" or accessory_ring.slot != "ring":
		return null
	if accessory_necklace.set_id != accessory_ring.set_id:
		return null
	if not _registry.accessory_sets.has(accessory_necklace.set_id):
		return null
	var set_record: Dictionary = _registry.accessory_sets[accessory_necklace.set_id]
	var pieces: Variant = set_record.get("pieces_for_bonus")
	var stat_id: Variant = set_record.get("bonus_stat_id")
	var value_pct: Variant = set_record.get("bonus_value_pct")
	if not (pieces is int or pieces is float) or not (value_pct is int or value_pct is float):
		error = "Accessory set %s has an invalid bonus definition" % ContentLoader.py_repr(accessory_necklace.set_id)
		return null
	var required_pieces: int = int(pieces)
	if required_pieces <= 0 or not (stat_id is String) or (stat_id as String).is_empty():
		error = "Accessory set %s has an invalid bonus threshold/stat" % ContentLoader.py_repr(accessory_necklace.set_id)
		return null
	if required_pieces > 2:
		return null
	var modifier: StatModifier = StatModifier.new()
	modifier.stat_id = stat_id
	modifier.value_pct = float(value_pct)
	return modifier
