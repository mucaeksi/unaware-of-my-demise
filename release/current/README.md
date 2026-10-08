# Current opening AAB — local review

Test `artifacts/game.aab`. This is the latest verified local opening build, through patch completion, confirmation and restart. It has a debug signature; production signing, Android device acceptance and final voice/music remain pending. It is not a published production release.

Edit the upstream project only. This generated folder is replaced after a successful rebuild and validation. `game/` contains the exact editable inputs mapped from the base PCK, plus explicitly listed native/export support. `FILE_INDEX.json` maps every file to its upstream source and purpose; `release.json` ties those inputs to the tested artifacts. No exact byte-for-byte reproducibility is promised.

Use Godot 4.7.2 and its matching Android templates; install the Android build template into `game/` before exporting. The sole `Android AAB` preset retains Compatibility rendering and strict typing. The native AARs can be rebuilt with `game/tools/build_uomd_native.sh`; JDK, Android SDK, Gradle and signing identities are local prerequisites. No private keystore is included.

Future owner-authorized Git publishing should include source and notices. `artifacts/` is excluded from Git because the review AAB exceeds GitHub's ordinary file size limit; distribute such binaries through an authorized Release/upload step. No push or publication is performed by this tool.
