extends SceneTree

func _initialize() -> void:
    call_deferred("_verify")

func _verify() -> void:
    var scene: Node = (load("res://level.tscn") as PackedScene).instantiate()
    root.add_child(scene)
    await process_frame
    var players: Array[Node] = scene.find_children("*", "AnimationPlayer", true, false)
    var bones: Array[Node] = scene.find_children("*", "Bone2D", true, false)
    if players.is_empty() or bones.is_empty():
        push_error("Missing native rig/animation")
        quit(1)
        return
    var animation: AnimationPlayer = players[0] as AnimationPlayer
    var character: Node = animation.get_parent()
    character.set_physics_process(false)
    character.set_process(false)
    var moving_clips: Array[String] = []
    for clip: StringName in animation.get_animation_list():
        var resource: Animation = animation.get_animation(clip)
        if resource.length < 0.2:
            continue
        animation.play(clip)
        animation.seek(resource.length * 0.1, true)
        var before: Array[Transform2D] = []
        for bone: Node in bones:
            before.append((bone as Bone2D).transform)
        animation.seek(resource.length * 0.6, true)
        var moved: bool = false
        for index: int in range(bones.size()):
            if not before[index].is_equal_approx((bones[index] as Bone2D).transform):
                moved = true
        if moved:
            moving_clips.append(String(clip))
    if moving_clips.size() < 2:
        push_error("Insufficient real moving rig clips")
        quit(1)
        return
    animation.pause()
    await process_frame
    await RenderingServer.frame_post_draw
    var destination: String = OS.get_environment("UOMD_STUDY_EVIDENCE")
    if not destination.is_empty():
        root.get_texture().get_image().save_png(destination.path_join("skeleton2d_native.png"))
    print(JSON.stringify({"status": "PASS", "engine": Engine.get_version_info()["string"], "renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"), "bones": bones.size(), "moving_clips": moving_clips, "character": "MIT GBot technical example, not Fadyme"}))
    scene.queue_free()
    await process_frame
    quit()
