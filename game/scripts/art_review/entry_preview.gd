extends "res://scripts/art_review/production_ui_preview.gd"
## Dedicated Entry scene for editor/MCP playtests; all outcomes stay local demo data.
func _ready() -> void:
	_page = "entry"
	_entry_only = true
	super._ready()
