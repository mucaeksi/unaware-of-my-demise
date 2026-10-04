class_name GaugeRules
extends RefCounted
## `battle_rules_part1.json` `turn_queue` block (port of core/battle/gauge.py GaugeRules), exact rational maths.

const GAUGE_MAX: int = 10000

var gauge_max: int = GAUGE_MAX
var effective_speed_floor: int = 1
var maximum_pending_delay_fraction: Frac = Frac.of(1, 2)


static func from_mapping(rules: Dictionary) -> GaugeRules:
	var result: GaugeRules = GaugeRules.new()
	result.gauge_max = int(rules["gauge_max"])
	result.effective_speed_floor = int(rules["effective_speed_floor"])
	result.maximum_pending_delay_fraction = Frac.from_number(rules["maximum_pending_delay_fraction"])
	return result


## Half a gauge by default: the most a unit's next action can be delayed.
func maximum_pending_delay_gauge() -> Frac:
	return maximum_pending_delay_fraction.mul_int(gauge_max)
