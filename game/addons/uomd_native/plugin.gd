@tool
extends EditorPlugin
## Registers the export plugin that adds the UomdNative AAR to Android exports (editor tooling only).

var _export_plugin: EditorExportPlugin


func _enter_tree() -> void:
	_export_plugin = preload("res://addons/uomd_native/export_plugin.gd").new()
	add_export_plugin(_export_plugin)


func _exit_tree() -> void:
	remove_export_plugin(_export_plugin)
	_export_plugin = null
