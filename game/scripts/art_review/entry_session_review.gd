extends Node
## Editor-runtime evidence. Uses one temporary GPU viewport; never opens or closes a native window.
func run_capture(directory: String, physical: Vector2i, logical: Vector2i, scale: float) -> void:
	set_meta("status", "capturing")
	var result: Dictionary = await capture_matrix(get_tree(), directory, physical, logical, scale)
	var file: FileAccess = FileAccess.open(directory.path_join("matrix.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t"))
	file.close()
	set_meta("status", "complete")

static func capture_matrix(tree: SceneTree, directory: String, physical: Vector2i, logical: Vector2i, scale: float) -> Dictionary:
	var viewport: SubViewport = SubViewport.new()
	viewport.name = "EntryEvidenceViewport"
	viewport.size = physical
	viewport.size_2d_override = logical
	viewport.size_2d_override_stretch = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	tree.root.add_child(viewport)
	var holder: Control = Control.new()
	holder.theme = UiTheme.create(scale)
	holder.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	viewport.add_child(holder)
	var result: Dictionary = {"physical": physical, "logical": logical, "text_scale": scale, "pages": {}}
	var expected_logo: Rect2
	for page_id: String in ["title", "sign_in", "ready", "checking", "downloading", "consent", "settings", "help", "contact", "licenses"]:
		var page: Control
		var logo: TextureRect
		if page_id == "title":
			var title: TitleScreen = TitleScreen.new()
			title.load_title("build 1 · local review")
			title.set_ready(true)
			holder.add_child(title)
			title._pulse_time = 0.0
			title._process(0.0)
			page = title
			logo = title._logo
		else:
			var entry: EntryScreen = EntryScreen.new()
			entry.present("sign_in" if page_id in ["settings", "help", "contact", "licenses"] else ("update_available" if page_id == "consent" else page_id), page_id != "sign_in")
			holder.add_child(entry)
			page = entry
			logo = entry._logo
			if page_id == "downloading": entry.set_download_progress(5242880, 20971520)
			if page_id == "consent": entry.confirm_content_update({"total_bytes": 20971520, "remaining_bytes": 20971520})
			if page_id in ["settings", "help", "contact", "licenses"]:
				var utility: EntryUtility = EntryUtility.new()
				utility.page = page_id
				utility.text_scale = scale
				utility.volumes = {"Music": 1.0, "Voice": 1.0, "SFX": 1.0}
				entry.open_utility(utility)
				logo = utility._logo
		UiPageTransition.finish_under(page)
		for frame: int in 4: await tree.process_frame
		await RenderingServer.frame_post_draw
		if page_id == "title": expected_logo = logo.get_global_rect()
		var record: Dictionary = {"logo": logo.get_global_rect(), "logo_matches_title": logo.get_global_rect() == expected_logo}
		if page is EntryScreen:
			var entry: EntryScreen = page as EntryScreen
			record["quote_visible"] = entry._opening_quote.is_visible_in_tree() and not is_instance_valid(entry._overlay)
			record["footer_visible"] = entry._footer.is_visible_in_tree() and not is_instance_valid(entry._overlay)
			record["primary_bounds"] = entry.primary.get_global_rect()
			record["primary_visible"] = entry.primary.is_visible_in_tree()
		viewport.get_texture().get_image().save_png(directory.path_join(page_id + ".png"))
		(result["pages"] as Dictionary)[page_id] = record
		page.queue_free()
		await tree.process_frame
	viewport.queue_free()
	await tree.process_frame
	return result
