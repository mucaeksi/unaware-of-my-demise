extends GutTest
## G5: the team, skills, inventory and settings screens on their own (ports of the screen tests of tests/test_hub_screens.py): what each
## shows, which buttons are enabled when, and which signal each raises. The rules behind them are test_game_menus.gd.


func _member(character_id: String, level: int = 3, xp_to_next: int = 120) -> GameViews.TeamMember:
	var member: GameViews.TeamMember = GameViews.TeamMember.new()
	member.character_id = character_id
	member.name_en = character_id.capitalize()
	member.rarity = 5
	member.level = level
	member.xp = 40
	member.xp_to_next = xp_to_next
	member.level_cap = 20
	member.memory_total = 6
	member.memory_nodes = 1
	member.memory_shards = 12
	return member


func _item(item_id: String, owned: int, xp_each: int = 100) -> GameViews.XpItem:
	var item: GameViews.XpItem = GameViews.XpItem.new()
	item.item_id = item_id
	item.name_en = item_id.capitalize()
	item.xp_each = xp_each
	item.owned = owned
	return item


func _team_screen() -> TeamScreen:
	var team: TeamScreen = add_child_autofree(TeamScreen.new())
	var members: Array[GameViews.TeamMember] = [_member("mahmut"), _member("fadyme", 20, -1)]
	var items: Array[GameViews.XpItem] = [_item("page", 2), _item("book", 0, 500)]
	team.load_team(members, items, "Silver Crowns 50")
	return team


func test_the_team_screen_needs_a_hero_before_anything_can_be_spent() -> void:
	var team: TeamScreen = _team_screen()
	assert_eq(team.member_ids(), ["mahmut", "fadyme"] as Array[String])
	assert_eq(team.status_text(), "Select a hero.")
	assert_false(team.can_use_item("page"))
	assert_false(team.can_open_skills())
	team.choose("mahmut")
	assert_eq(team.selected, "mahmut")
	assert_true(team.can_use_item("page"))
	assert_false(team.can_use_item("book"), "none owned")
	assert_true(team.can_open_skills())


func test_the_team_screen_shows_the_progress_of_each_hero_in_two_lines() -> void:
	var team: TeamScreen = _team_screen()
	assert_eq(team.member_label("mahmut"), "Mahmut  5★  Lv 3/20\nXP 40/120  Asc 0  Mem 1/6 (12 sh)")
	assert_string_contains(team.member_label("fadyme"), "MAX", "a hero at the cap has no XP bar")
	assert_eq(team.item_label("page"), "Use 1 Page (+100 XP, owned 2)")


func test_the_team_screen_reports_the_chosen_hero_and_item() -> void:
	var team: TeamScreen = _team_screen()
	watch_signals(team)
	team.press_item("page")
	assert_signal_not_emitted(team, "use_item", "no hero chosen yet")
	team.choose("fadyme")
	team.press_item("page")
	assert_signal_emitted_with_parameters(team, "use_item", ["fadyme", "page"])
	team.press_item("book")
	assert_signal_emit_count(team, "use_item", 1, "an item the player does not have cannot be pressed")
	team.press_skills()
	assert_signal_emitted_with_parameters(team, "skills_requested", ["fadyme"])
	team.press_memory()
	assert_signal_emitted_with_parameters(team, "memory_requested", ["fadyme"])


func test_reloading_the_team_keeps_the_hero_and_shows_the_status() -> void:
	var team: TeamScreen = _team_screen()
	var members: Array[GameViews.TeamMember] = [_member("mahmut", 4), _member("fadyme", 20, -1)]
	team.load_team(members, [_item("page", 1)] as Array[GameViews.XpItem], "Silver Crowns 10", "mahmut", "Mahmut: +100 XP, Lv 3 -> 4")
	assert_eq(team.selected, "mahmut")
	assert_eq(team.status_text(), "Mahmut: +100 XP, Lv 3 -> 4")
	assert_true(team.can_use_item("page"))
	assert_eq(team._wallet_label.text, "Silver Crowns 10")


func _skill(skill_id: String, rank: int, max_rank: int, has_next: bool, item: String = "") -> GameViews.SkillRow:
	var row: GameViews.SkillRow = GameViews.SkillRow.new()
	row.skill_id = skill_id
	row.name_en = skill_id.capitalize()
	row.type = "active"
	row.rank = rank
	row.max_rank = max_rank
	row.has_next = has_next
	row.next_level = 5
	row.next_silver_crowns = 2000
	row.next_item_id = item
	row.next_item_name = item.capitalize()
	row.next_item_quantity = 3 if not item.is_empty() else 0
	return row


func test_the_skills_screen_offers_an_upgrade_only_for_a_skill_that_has_a_next_rank() -> void:
	var skills: SkillsScreen = add_child_autofree(SkillsScreen.new())
	watch_signals(skills)
	var rows: Array[GameViews.SkillRow] = [_skill("strike", 1, 3, true), _skill("guard", 3, 3, false), _skill("notes", 1, 3, true, "tactical_notes")]
	skills.load_skills("Mahmut - Skills", rows)
	assert_eq(skills.title_text(), "Mahmut - Skills")
	assert_false(skills.can_upgrade(), "nothing chosen")
	skills.choose("guard")
	assert_false(skills.can_upgrade(), "already at the maximum rank")
	skills.choose("strike")
	assert_true(skills.can_upgrade())
	skills.press_upgrade()
	assert_signal_emitted_with_parameters(skills, "upgrade_requested", ["strike"])
	assert_eq(skills.row_label("strike"), "Strike [active]  Rank 1/3\nNext: Lv 5, 2000 Silver Crowns")
	assert_eq(skills.row_label("guard"), "Guard [active]  Rank 3/3  (max)")
	assert_eq(skills.row_label("notes"), "Notes [active]  Rank 1/3\nNext: Lv 5, 2000 Silver Crowns + 3 Tactical Notes")


func test_the_skills_screen_keeps_the_chosen_skill_across_a_reload() -> void:
	var skills: SkillsScreen = add_child_autofree(SkillsScreen.new())
	skills.load_skills("S", [_skill("strike", 1, 3, true)] as Array[GameViews.SkillRow])
	skills.load_skills("S", [_skill("strike", 2, 3, true)] as Array[GameViews.SkillRow], "strike", "Rank 1 -> 2")
	assert_eq(skills.selected, "strike")
	assert_true(skills.can_upgrade())
	assert_eq(skills.status_text(), "Rank 1 -> 2")


func _gear(instance_id: String, kind: String, locked: bool = false, owner: String = "") -> GameViews.InventoryEntry:
	var entry: GameViews.InventoryEntry = GameViews.InventoryEntry.new()
	entry.table = "inventory_weapons" if kind == "weapon" else "inventory_accessories"
	entry.instance_id = instance_id
	entry.name_en = instance_id.capitalize()
	entry.kind = kind
	entry.rarity = 4
	entry.level = 3 if kind == "weapon" else -1
	entry.slot = "weapon" if kind == "weapon" else "necklace"
	entry.locked = locked
	entry.equipped_character_id = owner
	entry.equipped_character_name = owner.capitalize()
	entry.stats_text = "atk 2, hp 1.5"
	entry.can_dismantle = kind == "weapon" and not locked and owner.is_empty()
	entry.can_reroll = kind == "accessory" and not locked
	entry.can_level_up = kind == "weapon"
	return entry


func _targets() -> Array[Dictionary]:
	return [{"id": "mahmut", "name": "Mahmut"}, {"id": "fadyme", "name": "Fadyme"}] as Array[Dictionary]


func test_the_inventory_enables_the_actions_the_selected_item_allows() -> void:
	var inventory: InventoryScreen = add_child_autofree(InventoryScreen.new())
	var entries: Array[GameViews.InventoryEntry] = [_gear("blade", "weapon"), _gear("charm", "accessory"), _gear("spear", "weapon", true, "mahmut")]
	inventory.load_inventory(entries, _targets())
	assert_eq(inventory.status_text(), "Select an item.")
	for action: String in InventoryScreen.ACTIONS:
		assert_false(inventory.action_enabled(action), "%s needs a selection" % action)
	inventory.choose("blade")
	assert_true(inventory.action_enabled("equip"))
	assert_false(inventory.action_enabled("unequip"), "nobody wears it")
	assert_true(inventory.action_enabled("toggle_lock"))
	assert_true(inventory.action_enabled("dismantle"))
	assert_false(inventory.action_enabled("reroll"))
	assert_true(inventory.action_enabled("level_up"))
	inventory.choose("charm")
	assert_true(inventory.action_enabled("reroll"))
	assert_false(inventory.action_enabled("level_up"), "accessories have no levels")
	inventory.choose("spear")
	assert_true(inventory.action_enabled("unequip"))
	assert_false(inventory.action_enabled("dismantle"), "it is worn and locked")
	assert_eq(inventory.action_label("toggle_lock"), "Unlock")
	inventory.choose("blade")
	assert_eq(inventory.action_label("toggle_lock"), "Lock")


func test_the_inventory_reports_the_action_with_the_entry_and_the_equip_target() -> void:
	var inventory: InventoryScreen = add_child_autofree(InventoryScreen.new())
	watch_signals(inventory)
	inventory.load_inventory([_gear("blade", "weapon")] as Array[GameViews.InventoryEntry], _targets())
	inventory.choose("blade")
	assert_eq(inventory.target_text(), "Equip to: Mahmut")
	inventory.cycle_target()
	assert_eq(inventory.target_text(), "Equip to: Fadyme")
	inventory.press("equip")
	var params: Array = get_signal_parameters(inventory, "action_requested")
	assert_eq(params[0], "equip")
	assert_eq((params[1] as GameViews.InventoryEntry).instance_id, "blade")
	assert_eq(params[2], "fadyme", "Equip carries the chosen hero")
	inventory.press("toggle_lock")
	assert_eq(get_signal_parameters(inventory, "action_requested")[2], "", "other actions carry no target")
	inventory.cycle_target()
	assert_eq(inventory.target_text(), "Equip to: Mahmut", "the target list wraps")


func test_the_inventory_lines_and_the_empty_state() -> void:
	var inventory: InventoryScreen = add_child_autofree(InventoryScreen.new())
	inventory.load_inventory([] as Array[GameViews.InventoryEntry], [] as Array[Dictionary])
	assert_eq(inventory.status_text(), "No gear yet.")
	assert_eq(inventory.target_text(), "Equip to: -")
	assert_eq(InventoryScreen.entry_text(_gear("blade", "weapon", true, "mahmut")), "Blade 4★ Lv 3 [weapon] | on Mahmut | locked\natk 2, hp 1.5")
	assert_eq(InventoryScreen.entry_text(_gear("charm", "accessory")), "Charm 4★ [necklace]\natk 2, hp 1.5")
	inventory.load_inventory([_gear("blade", "weapon")] as Array[GameViews.InventoryEntry], _targets(), "blade", "Locked Blade.")
	assert_eq(inventory.selected, "blade", "a reload keeps the selection")
	assert_eq(inventory.status_text(), "Locked Blade.")
	inventory.press("equip")
	assert_true(inventory.action_enabled("equip"))


func test_the_settings_screen_shows_the_build_line_and_any_extra_actions() -> void:
	var settings: SettingsScreen = add_child_autofree(SettingsScreen.new())
	watch_signals(settings)
	settings.load_settings("Unaware of My Demise\nOffline build", "Saved", [{"id": "sign_out", "label": "Sign out"}] as Array[Dictionary])
	assert_eq(settings.info_text(), "Unaware of My Demise\nOffline build")
	assert_eq(settings.status_text(), "Saved")
	settings._actions.get_child(0).pressed.emit()
	assert_signal_emitted_with_parameters(settings, "action_requested", ["sign_out"])
	settings.load_settings("x")
	assert_eq(settings._actions.get_child_count(), 0, "a reload without actions clears them")
