# Current opening AAB workflow

The generated `release/current/` folder is the latest verified local review version. Its `game/` project is extracted from the real opening PCK, retaining authored scripts/scenes/resources, raw selected art, import settings, UIDs, the single opening Android export preset and required native build inputs. `artifacts/game.aab` is the file to test. `FILE_INDEX.json` maps each file to its purpose and upstream source hash. `release.json` seals that index and identifies the tested artifacts.

The base contains Prologue, explicit Continue, six before/after light-novel cutscenes, three Fadyme/Mahmut tutorial fights and patch completion/confirmation/restart presentation. After restart the shared client handles the installed content and menu. Main-story chapter payloads are excluded from the base. Shared client executable code and registry/rules remain required: subsequent content patches deliver data/assets, not executable scripts.

Music, Japanese voice, balance and final visual polish are still unfinished. The current AAB uses the external local Android debug key, not a production upload key. Store publication and Android device acceptance remain separate owner-directed work.

## Refresh from the full development project

Use the installed Godot 4.7.2 console and Python executables, plus the pinned bundletool 1.18.2 JAR. Existing matching export templates, JDK 17, Android SDK/platform 36/build-tools 36.1.0, Gradle 8.11.1 and the native plugin AARs must be available locally.

```powershell
./tools/Update-CurrentAAB.ps1 -Godot '<Godot console executable>' -Python '<Python executable>' -BundletoolJar '<bundletool-all-1.18.2.jar>'
```

That command builds fresh opening and story-content packs, checks the content-only patch policy, exercises the exported tutorial battles, builds/signs/validates the AAB, checks native bridge/dependency class descriptors and manifest registration, checks every AAB runtime entry against the tested PCK, and stages the required source files. It rebuilds and runs the staged project from a clean copy, then promotes only if its runtime content agrees. Imported scene IDs are regenerated: 17 scene graphs are compared through their loaded properties/connections, while scripts and imported art must match exactly. An exclusive update lock prevents competing updates. Installation uses directory renames with rollback; failed validation preserves the previous current. Successful replacement removes the previous marked generated version. Original sources and older build evidence are preserved outside current.

For an already verified build, `-BuildDirectory '<build-relative-directory>'` can reuse it; hashes, timestamps, clean source rebuild and runtime acceptance still apply. This is an explicit reuse option, not the default. A sealed folder cannot be manually edited without failing verification.

```powershell
python tools/materialize_aab.py verify release/current --project-root .
python tools/project_catalog.py find mahmut --scope aab
```

Refresh current after each accepted game change before handing it to the owner to test. The update command performs the refresh; editing an upstream file alone does not silently rebuild Android. Verification reports stale source inputs until that refresh succeeds.

## Standalone source check or rebuild

Work in a separate copy of the generated folder, so editor caches do not contaminate sealed current. The copied `tools/Build-CurrentAAB.ps1` works without the development repository or main-story payloads:

```powershell
./tools/Build-CurrentAAB.ps1 -Godot '<Godot console executable>' -Python '<Python executable>' -PacksOnly
./tools/Build-CurrentAAB.ps1 -Godot '<Godot console executable>' -Python '<Python executable>' -BundletoolJar '<bundletool-all-1.18.2.jar>'
```

Full standalone export installs the matching Android build template if absent. Cached native AARs are present in the local snapshot for review. Source publishing ignores them; rebuild through `game/tools/build_uomd_native.sh` using the documented native prerequisites. Private keystores, environment files, personal client config, editor/test addons, preview scenes, unused reference libraries and generation logs do not enter the snapshot. The public content verification PEM, public native application IDs and required licenses do.

Android export uses `--export-debug` without an extra `--quit`, allowing the native EditorExportPlugin to initialize. `--install-android-build-template` is supplied together with that export when needed. A clean build with an early quit was observed to omit the bridge silently; `verify_aab_native.py` now rejects that bundle. Godot's [command-line export guide](https://docs.godotengine.org/en/latest/tutorials/editor/command_line_tutorial.html) and [Android plugin packaging guide](https://docs.godotengine.org/en/stable/tutorials/platform/android/android_plugin.html) describe the required export and plugin registration boundaries.

Source manifests containing personal paths remain in the development source. `docs/ASSET_PROVENANCE.json` inside the snapshot is their portable review record. Runtime art files are copied without alteration; upstream originals are preserved.

## Future publication

This preparation does not push or publish anything. The snapshot's Git policy excludes binaries and generated caches, including AAB/PCK artifacts and native AARs. Large test/build binaries belong in an owner-authorized artifact/Release upload, while source and notices belong in Git. GitHub's ordinary repository upload limits are documented in [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). Final signing and a tested Android installation remain required before calling this a production release.
