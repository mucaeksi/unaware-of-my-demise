# Current opening AAB — local review

Test `artifacts/game.aab`. This is the latest verified local opening build, through patch completion, confirmation and restart. It has a debug signature; production signing, Android device acceptance and final voice/music remain pending. It is not a published production release.

Edit the upstream project only. This generated folder is replaced after a successful rebuild and validation. `game/` contains the exact editable inputs mapped from the base PCK, plus explicitly listed native/export support. `FILE_INDEX.json` maps every file to its upstream source and purpose; `release.json` ties those inputs to the tested artifacts. No exact byte-for-byte reproducibility is promised.

Use Godot 4.7.2 and its matching Android templates; install the Android build template into `game/` before exporting. The sole `Android AAB` preset retains Compatibility rendering and strict typing. The native AARs can be rebuilt with `game/tools/build_uomd_native.sh`; JDK, Android SDK, Gradle and signing identities are local prerequisites. No private keystore is included.

Owner-selected Git tracking includes source, notices and artifacts. AAB and base PCK use the repository's Git LFS attributes; install Git LFS and fetch their objects before verification. Keep credentials and generated caches outside deliverables. No push or publication is performed by this tool.
