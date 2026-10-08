extends SceneTree
## Compare authored scene behavior, excluding engine-generated node/resource IDs.

func encode(value: Variant) -> Variant:
	if value is Resource:
		var resource: Resource = value as Resource
		if not resource.resource_path.is_empty() and not resource.resource_path.contains("::"):
			return {"class":resource.get_class(), "path":resource.resource_path}
		var properties: Dictionary = {}
		for property: Dictionary in resource.get_property_list():
			var key: String = str(property["name"])
			if int(property["usage"]) & PROPERTY_USAGE_STORAGE and key not in ["resource_scene_unique_id", "resource_path", "resource_local_to_scene"]:
				properties[key] = encode(resource.get(key))
		return {"class":resource.get_class(), "properties":properties, "local_to_scene":resource.resource_local_to_scene}
	if value is Dictionary:
		var result: Dictionary = {}
		for key: Variant in value:
			result[str(key)] = encode(value[key])
		return result
	if value is Array or value is PackedStringArray:
		var result: Array = []
		for item: Variant in value:
			result.append(encode(item))
		return result
	if value == null or value is bool or value is int or value is float or value is String:
		return value
	return {"type":type_string(typeof(value)), "value":var_to_str(value)}

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	if arguments.size() != 2:
		quit(2)
		return
	var paths: Variant = JSON.parse_string(FileAccess.get_file_as_string(arguments[0]))
	var result: Dictionary = {}
	for path: String in paths:
		var scene: PackedScene = load("res://" + path) as PackedScene
		if scene == null:
			push_error("Cannot inspect " + path)
			quit(1)
			return
		var state: SceneState = scene.get_state()
		var nodes: Array[Dictionary] = []
		for index: int in state.get_node_count():
			var properties: Dictionary = {}
			for property: int in state.get_node_property_count(index):
				properties[str(state.get_node_property_name(index, property))] = encode(state.get_node_property_value(index, property))
			nodes.append({"name":str(state.get_node_name(index)), "type":str(state.get_node_type(index)), "path":str(state.get_node_path(index)), "owner":str(state.get_node_owner_path(index)), "index":state.get_node_index(index), "instance":encode(state.get_node_instance(index)), "groups":encode(state.get_node_groups(index)), "properties":properties})
		var connections: Array[Dictionary] = []
		for index: int in state.get_connection_count():
			connections.append({"source":str(state.get_connection_source(index)), "signal":str(state.get_connection_signal(index)), "target":str(state.get_connection_target(index)), "method":str(state.get_connection_method(index)), "flags":state.get_connection_flags(index), "binds":encode(state.get_connection_binds(index)), "unbinds":state.get_connection_unbinds(index)})
		result[path] = {"nodes":nodes, "connections":connections}
	var output: FileAccess = FileAccess.open(arguments[1], FileAccess.WRITE)
	if output == null:
		quit(2)
		return
	output.store_string(JSON.stringify(result, "\t", true, true))
	print("Inspected " + str(result.size()) + " packed scenes")
	quit(0)
