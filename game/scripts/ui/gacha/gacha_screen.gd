class_name GachaScreen
extends UiScreen
## Summon: the open banners with rate, pity and guarantee, pull x1 / x10, and the last results (port of client/screens/gacha_screen.py). Every
## number comes from the server through `GameFlow.gacha_banners()`; the screen renders and reports which banner, how many pulls and which
## Hall of Armaments target the player chose. The GDD rule holds: pool, rate, remaining pity and guarantee are shown before every pull.

signal pull_requested(banner_id: String, count: int, target_id: String)
signal history_requested
## Eclipse Tokens -> `count` Fate's Threads at the authored rate.
signal exchange_requested(count: int)
signal back_requested

var selected: String = ""

var _wallet_label: Label = null
var _list: VBoxContainer = null
var _info_label: Label = null
var _target_button: Button = null
var _pull_one: Button = null
var _pull_ten: Button = null
var _exchange: Button = null
var _results_label: Label = null
var _status_label: Label = null
var _group: ButtonGroup = null
var _banners: Dictionary = {}
var _banner_buttons: Dictionary = {}
var _fate_threads: int = 0
var _target_index: int = 0
var _busy: bool = false
var _eclipse_tokens: int = 0
## Eclipse Tokens per Fate's Thread; 0 = no exchange offered.
var _token_cost: int = 0


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Summon", UiTheme.TITLE))
	_wallet_label = UiKit.label("")
	column.add_child(_wallet_label)
	_list = UiKit.scroll_column(column, 12)
	_info_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_info_label)
	_target_button = UiKit.button("Target: -")
	_target_button.pressed.connect(cycle_target)
	column.add_child(_target_button)
	var pulls: HBoxContainer = UiKit.row(16)
	_pull_one = UiKit.button("Pull x1")
	_pull_one.pressed.connect(_on_pull.bind(1))
	pulls.add_child(_pull_one)
	_pull_ten = UiKit.button("Pull x10")
	_pull_ten.pressed.connect(_on_pull.bind(10))
	pulls.add_child(_pull_ten)
	column.add_child(pulls)
	_exchange = UiKit.button("")
	_exchange.visible = false
	_exchange.pressed.connect(func() -> void:
		if not _busy:
			exchange_requested.emit(1))
	column.add_child(_exchange)
	var results: VBoxContainer = UiKit.scroll_column(column, 8)
	_results_label = UiKit.label("")
	results.add_child(_results_label)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	var footer: HBoxContainer = UiKit.row(16)
	var history: Button = UiKit.button("Pull history")
	history.pressed.connect(func() -> void:
		if not _busy:
			history_requested.emit())
	footer.add_child(history)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void:
		if not _busy:
			back_requested.emit())
	footer.add_child(back)
	column.add_child(footer)


func load_gacha(banners: Array[GameViews.BannerView], fate_threads: int, selected_id: String = "", results_text: String = "", status: String = "") -> void:
	ensure_built()
	UiKit.clear(_list)
	_banners.clear()
	_banner_buttons.clear()
	_group = ButtonGroup.new()
	selected = ""
	_busy = false
	_fate_threads = fate_threads
	_token_cost = 0
	_wallet_label.text = "Fate's Threads: %d" % fate_threads
	for banner: GameViews.BannerView in banners:
		var button: Button = UiKit.button(banner_label(banner), true)
		button.button_group = _group
		button.toggled.connect(_on_toggled.bind(banner.banner_id))
		_list.add_child(button)
		_banners[banner.banner_id] = banner
		_banner_buttons[banner.banner_id] = button
	_results_label.text = results_text
	_status_label.text = status if not status.is_empty() else ("No banner is open." if banners.is_empty() else "")
	if _banner_buttons.has(selected_id):
		(_banner_buttons[selected_id] as Button).button_pressed = true
	_refresh()


## "Oath: Sister Aveline   5★ 0.6%   pity 12/90".
static func banner_label(banner: GameViews.BannerView) -> String:
	return "%s   5★ %s%%   pity %d/%d" % [banner.title, GameViews.number_text(banner.five_star_percent), banner.pity, banner.hard_pity]


## The rules of the selected banner, shown before every pull.
static func info_text(banner: GameViews.BannerView) -> String:
	if banner == null:
		return "Select a banner."
	var lines: PackedStringArray = PackedStringArray([
		banner.title,
		"Next pull: %s%% for a 5★. Guaranteed 5★ at %d pulls without one (now %d)." % [GameViews.number_text(banner.five_star_percent), banner.hard_pity, banner.pity],
		"Cost: %d Fate's Thread per pull. %s" % [banner.pull_cost, "Every pull adds a weapon to your inventory." if banner.banner_type == "weapon" else "Duplicates become Memory Shards."],
	])
	if not banner.closes_at.is_empty():
		lines.append("Closes %s UTC" % banner.closes_at.replace("T", " ").trim_suffix("Z").trim_suffix("+00:00"))
	if not banner.guarantee.is_empty():
		lines.append(banner.guarantee)
	return "\n".join(lines)


## Offers one Fate's Thread for `token_cost` Eclipse Tokens (call after `load_gacha`).
func set_exchange(eclipse_tokens: int, token_cost: int) -> void:
	_eclipse_tokens = eclipse_tokens
	_token_cost = token_cost
	_wallet_label.text = "Fate's Threads: %d   Eclipse Tokens: %d" % [_fate_threads, eclipse_tokens]
	_refresh()


func exchange_enabled() -> bool:
	return _exchange.visible and not _exchange.disabled


func exchange_text() -> String:
	return _exchange.text


func press_exchange() -> void:
	if exchange_enabled():
		_exchange.pressed.emit()


## Shows the call in flight: pulls and navigation are disabled until the director reloads the screen.
func set_busy(busy: bool) -> void:
	_busy = busy
	_refresh()


func banner_ids() -> Array[String]:
	var ids: Array[String] = []
	for banner_id: String in _banner_buttons:
		ids.append(banner_id)
	return ids


func choose(banner_id: String) -> void:
	if _banner_buttons.has(banner_id):
		(_banner_buttons[banner_id] as Button).button_pressed = true


## The next selectable Hall of Armaments weapon as the target.
func cycle_target() -> void:
	var banner: GameViews.BannerView = _banners.get(selected)
	if banner != null and not banner.targets.is_empty():
		_target_index = (_target_index + 1) % banner.targets.size()
		_refresh()


func selected_target() -> String:
	var banner: GameViews.BannerView = _banners.get(selected)
	if banner == null or banner.targets.is_empty():
		return ""
	return str(banner.targets[_target_index % banner.targets.size()]["id"])


func pull_enabled(count: int) -> bool:
	return not (_pull_one if count == 1 else _pull_ten).disabled


func press_pull(count: int) -> void:
	if pull_enabled(count):
		(_pull_one if count == 1 else _pull_ten).pressed.emit()


func info_label_text() -> String:
	return _info_label.text


func wallet_text() -> String:
	return _wallet_label.text


func results_text() -> String:
	return _results_label.text


func status_text() -> String:
	return _status_label.text


func target_text() -> String:
	return _target_button.text


func target_visible() -> bool:
	return _target_button.visible


func _on_toggled(pressed: bool, banner_id: String) -> void:
	if not pressed:
		return
	selected = banner_id
	var banner: GameViews.BannerView = _banners[banner_id]
	_target_index = 0
	for index: int in banner.targets.size():
		if str(banner.targets[index]["id"]) == banner.selected_target:
			_target_index = index
	_refresh()


func _on_pull(count: int) -> void:
	if not _busy and not selected.is_empty():
		pull_requested.emit(selected, count, selected_target())


func _refresh() -> void:
	var banner: GameViews.BannerView = _banners.get(selected)
	_info_label.text = info_text(banner)
	_target_button.visible = banner != null and not banner.targets.is_empty()
	if _target_button.visible:
		_target_button.text = "Target: %s" % str(banner.targets[_target_index % banner.targets.size()]["name"])
	for pair: Array in [[_pull_one, 1], [_pull_ten, 10]]:
		var cost: int = banner.pull_cost * int(pair[1]) if banner != null else 0
		(pair[0] as Button).disabled = banner == null or _busy or _fate_threads < cost
	_pull_one.text = "Summoning..." if _busy else "Pull x1"
	_exchange.visible = _token_cost > 0
	_exchange.text = "Exchange %d Eclipse Tokens for 1 Fate's Thread" % _token_cost
	_exchange.disabled = _busy or _eclipse_tokens < _token_cost
