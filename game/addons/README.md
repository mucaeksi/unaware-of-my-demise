# Vendored addons

Nothing here is edited by hand. To update an addon, replace its folder from the pinned source and change the version below.

| Addon | Version / source | What is kept | License |
|---|---|---|---|
| `gut/` | GUT 9.7.1, tag `v9.7.1` of `bitwes/Gut` (the release for Godot 4.7) | the whole `addons/gut` folder | MIT (`gut/LICENSE.md`) |

Notes

* The LEGACY build also vendored `godot-sqlite` and the `uomd_native` Android plugin. Neither is migrated: the player state lives on the
  server (DEC-0012), so there is no on-device database and no save key to protect. `Native` (`scripts/app/native.gd`) stays as a no-op
  facade until a native plugin is needed again.
