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


## One open banner as the gacha screen shows it (port of `BannerView`): every figure comes from the server's `GET /v1/gacha/banners`.
class BannerView extends RefCounted:
	var banner_id: String = ""
	var title: String = ""
	## "character" | "weapon" | "standard_character".
	var banner_type: String = ""
	var pull_cost: int = 1
	## Chance of a 5★ on the very next pull, in percent (two decimals).
	var five_star_percent: float = 0.0
	## Pulls since the last 5★.
	var pity: int = 0
	var hard_pity: int = 0
	## "" or the server's guarantee line ("Next 5★ is guaranteed ...", "Fate Knots: 1/2").
	var guarantee: String = ""
	## "" for the permanent halls.
	var featured_name: String = ""
	## ISO-8601 UTC; "" for a permanent banner.
	var closes_at: String = ""
	## Hall of Armaments only: [{"id": weapon_id, "name": name_en}] the Fate Knot guarantee can aim at.
	var targets: Array[Dictionary] = []
	## The server's remembered target ("" = none).
	var selected_target: String = ""


## One pull result, display-ready (port of `PullEntry`).
class PullEntry extends RefCounted:
	var rarity: int = 3
	var name_en: String = ""
	var is_new: bool = false
	var duplicate: bool = false
	var memory_shards: int = 0
	## Weapon instances and characters are both granted; true when the pull hit the banner's featured unit.
	var featured: bool = false


## One claimable quest line (port of `QuestRow`).
class QuestRow extends RefCounted:
	## "daily" | "weekly".
	var kind: String = ""
	## The daily task id, "window_completion", or the weekly segment id.
	var task_id: String = ""
	var title: String = ""
	var progress: int = 0
	var target: int = 0
	## "locked" | "claimable" | "claimed".
	var state: String = "locked"
	var reward_text: String = ""
	## Weekly mail rows: the week's Monday (YYYY-MM-DD); "" otherwise.
	var period: String = ""

	func key() -> String:
		return "%s/%s/%s" % [kind, task_id, period]


## One player on the friends screen (INF-037): a friend, a request either way. Only public fields (no friend code).
class FriendRow extends RefCounted:
	var account_id: String = ""
	var nickname: String = ""
	var player_level: int = 1
	## "online" | "offline" (offline also when the player hides their presence).
	var presence: String = "offline"
	## "accepted" | "pending_in" (they asked) | "pending_out" (the player asked).
	var relationship: String = ""
	var request_id: String = ""


## The friends screen: the own profile line and the rows.
class FriendsView extends RefCounted:
	var friend_code: String = ""
	var nickname: String = ""
	var presence_opt_in: bool = true
	## When the nickname may change again ("" = now).
	var nickname_change_available_at: String = ""
	var rows: Array[FriendRow] = []
	var friend_count: int = 0
	var friend_limit: int = 0


## One mail in the mailbox (INF-035): from the operators, to every player or to this one.
class MailRow extends RefCounted:
	var mail_id: String = ""
	var title: String = ""
	var body: String = ""
	## "1,000 Silver Crowns, 3× Ember Shard"; "" for a mail without rewards (a letter only).
	var reward_text: String = ""
	## "YYYY-MM-DD HH:MM" (UTC).
	var expires_at: String = ""
	var claimed: bool = false


## `2` for 2.0, `0.08` for 0.08: the way the content authors write a stat (JSON numbers all arrive as floats).
static func number_text(value: Variant) -> String:
	if value is float:
		var number: float = value
		if is_equal_approx(number, roundf(number)) and absf(number) < 1.0e9:
			return str(int(number))
		return String.num(number)
	return str(value)
