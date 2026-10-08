@tool
extends EditorExportPlugin
## Adds the UomdNative AAR (built from res://android/plugins/uomd_native by tools/build_uomd_native.sh) to Android
## exports. Godot Android plugin v2: the AAR's manifest registers the plugin class.


## Maven dependencies of the AAR (an AAR does not carry them into the export). Equal to the `implementation` lines of
## res://android/plugins/uomd_native/build.gradle (checked by tests/unit/test_sign_in_flow.gd).
const ANDROID_DEPENDENCIES: Array[String] = [
	"androidx.credentials:credentials:1.6.0",
	"androidx.credentials:credentials-play-services-auth:1.6.0",
	"com.google.android.libraries.identity.googleid:googleid:1.2.1",
	"com.android.billingclient:billing:9.1.0",
	"com.google.android.gms:play-services-ads:25.5.0",
	"com.google.android.ump:user-messaging-platform:4.0.0",
]


func _get_name() -> String:
	return "UomdNative"


func _supports_platform(platform: EditorExportPlatform) -> bool:
	return platform is EditorExportPlatformAndroid


func _get_android_libraries(_platform: EditorExportPlatform, debug: bool) -> PackedStringArray:
	if debug:
		return PackedStringArray(["res://addons/uomd_native/bin/debug/uomd_native-debug.aar"])
	return PackedStringArray(["res://addons/uomd_native/bin/release/uomd_native-release.aar"])


func _get_android_dependencies(_platform: EditorExportPlatform, _debug: bool) -> PackedStringArray:
	return PackedStringArray(ANDROID_DEPENDENCIES)
