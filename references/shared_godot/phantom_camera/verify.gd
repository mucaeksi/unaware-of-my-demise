extends SceneTree

func _initialize() -> void:
    call_deferred("_verify")

func _verify() -> void:
    var stage: Node2D = Node2D.new()
    root.add_child(stage)
    var camera: Camera2D = Camera2D.new()
    stage.add_child(camera)
    var host: PhantomCameraHost = PhantomCameraHost.new()
    camera.add_child(host)
    var first: PhantomCamera2D = PhantomCamera2D.new()
    first.name = "Wide"
    first.priority = 10
    first.tween_on_load = false
    stage.add_child(first)
    var second: PhantomCamera2D = PhantomCamera2D.new()
    second.name = "Focus"
    second.position = Vector2(240, 80)
    second.tween_resource.duration = 0.15
    stage.add_child(second)
    for pcam: PhantomCamera2D in [first, second]:
        var shape: Polygon2D = Polygon2D.new()
        shape.polygon = PackedVector2Array([Vector2(-45, -70), Vector2(45, -70), Vector2(45, 70), Vector2(-45, 70)])
        shape.position = pcam.position
        shape.color = Color(0.2, 0.7, 0.95) if pcam == first else Color(0.95, 0.5, 0.15)
        stage.add_child(shape)
    await create_timer(0.3).timeout
    if host.get_active_pcam() != first:
        push_error("Initial priority owner failed")
        quit(1)
        return
    second.priority = 20
    await create_timer(0.4).timeout
    if host.get_active_pcam() != second or camera.global_position.distance_to(second.global_position) > 1.0:
        push_error("Priority/tween target failed")
        quit(1)
        return
    await RenderingServer.frame_post_draw
    var destination: String = OS.get_environment("UOMD_STUDY_EVIDENCE")
    if not destination.is_empty():
        root.get_texture().get_image().save_png(destination.path_join("phantom_focus.png"))
    second.priority = 0
    await create_timer(0.3).timeout
    if host.get_active_pcam() != first:
        push_error("Return priority owner failed")
        quit(1)
        return
    print(JSON.stringify({"status": "PASS", "engine": Engine.get_version_info()["string"], "renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"), "addon": "0.11.0.3", "priority_round_trip": true, "focus_target": [240, 80], "game_plugin_enabled": false}))
    stage.queue_free()
    await process_frame
    quit()
