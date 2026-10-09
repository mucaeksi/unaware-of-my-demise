extends SceneTree

func _initialize() -> void:
    call_deferred("_verify")

func _verify() -> void:
    var background: ColorRect = ColorRect.new()
    background.color = Color(0.05, 0.1, 0.3, 1.0)
    background.size = Vector2(540, 960)
    root.add_child(background)
    var effect: ColorRect = ColorRect.new()
    effect.color = Color(0.9, 0.2, 0.1, 1.0)
    effect.size = Vector2(540, 960)
    var material: ShaderMaterial = ShaderMaterial.new()
    material.shader = load("res://transition.gdshader") as Shader
    material.set_shader_parameter("grid_size", Vector2(1, 0))
    material.set_shader_parameter("use_sprite_alpha", false)
    effect.material = material
    root.add_child(effect)
    var samples: Array[Dictionary] = []
    for progress: float in [0.0, 1.0, 2.0]:
        material.set_shader_parameter("progress", progress)
        await process_frame
        await RenderingServer.frame_post_draw
        var frame: Image = root.get_texture().get_image()
        var left: Color = frame.get_pixel(135, 480)
        var right: Color = frame.get_pixel(405, 480)
        samples.append({"progress": progress, "left": left.to_html(), "right": right.to_html()})
        if progress == 0.0 and not (left.r > 0.7 and right.r > 0.7):
            push_error("Visible endpoint failed")
            quit(1)
            return
        if progress == 1.0 and not (left.b > left.r and right.r > 0.7):
            push_error("Portrait half wipe failed")
            quit(1)
            return
        if progress == 2.0 and not (left.b > left.r and right.b > right.r):
            push_error("Hidden endpoint failed")
            quit(1)
            return
        var destination: String = OS.get_environment("UOMD_STUDY_EVIDENCE")
        if not destination.is_empty():
            frame.save_png(destination.path_join("transition_%d.png" % int(progress)))
    print(JSON.stringify({"status": "PASS", "engine": Engine.get_version_info()["string"], "renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"), "portrait": [540, 960], "samples": samples, "recipe_range": [0.0, 2.0]}))
    quit()
