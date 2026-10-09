#!/usr/bin/env python3
"""Materialize the verified opening export as an editable, current-only local snapshot.

The upstream project remains authoritative. This tool never moves upstream files,
publishes, or copies private signing/client state. A candidate is sealed and checked
before replacing release/current. Pack-defined files and build-only support are
recorded separately, so an exported asset cannot silently grow into a whole folder.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from pck_inventory import integrity_problems, read_pack
from verify_aab_native import verify as verify_native

OWNER = "uomd-current-aab-v1"
MARKER = ".uomd-snapshot-owner.json"
PUBLIC_KEY = "game/data/keys/uomd-content-1.pem"
GENERATED = {"project.binary", ".godot/uid_cache.bin", ".godot/global_script_class_cache.cfg"}
PRIVATE_EXTENSIONS = {".keystore", ".jks", ".p12", ".pfx", ".key"}
EXCLUDED_PREFIXES = (
    "tests/", "e2e/", "scripts/art_review/", "scenes/art_review/", "assets/art_review/",
    "assets/third_party/reference/", "assets/vfx/gdquest_reference/", "addons/godot_ai/",
    "addons/gut/", "narrative/", "references/", "server/", "backend/", "admin/",
)
BUILD_SUPPORT = (
    "game/GODOT_VERSION", "game/tools/build_uomd_native.sh",
    "game/addons/uomd_native/plugin.cfg", "game/addons/uomd_native/plugin.gd",
    "game/addons/uomd_native/export_plugin.gd",
    "game/addons/uomd_native/bin/debug/uomd_native-debug.aar",
    "game/addons/uomd_native/bin/release/uomd_native-release.aar",
    "game/android/plugins/uomd_native/build.gradle",
    "game/android/plugins/uomd_native/settings.gradle",
    "game/android/plugins/uomd_native/gradle.properties",
    "game/android/plugins/uomd_native/src/main/AndroidManifest.xml",
    "game/android/plugins/uomd_native/src/main/res/values/uomd_admob.xml",
    "game/data/legal/android_libraries.json", "game/data/legal/apache-2.0.txt",
)


class SnapshotError(ValueError):
    """A candidate cannot be proven safe, complete or current."""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_digest(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def relative_path(value: str) -> str:
    """Reject traversal, Windows alternate streams and ambiguous portable paths."""
    if not isinstance(value, str) or not value or "\\" in value or ":" in value or "\x00" in value:
        raise SnapshotError(f"Unsafe relative path: {value!r}")
    path = PurePosixPath(value)
    if path.is_absolute() or str(path) != value or any(p in (".", "..") for p in path.parts):
        raise SnapshotError(f"Unsafe relative path: {value!r}")
    if any(p.rstrip(" .") != p for p in path.parts):
        raise SnapshotError(f"Non-portable path: {value}")
    return value


def assert_not_linked(path: Path) -> None:
    """Check existing ancestors too; a junction must not redirect a scoped write."""
    for part in (path, *path.parents):
        if part.exists() or part.is_symlink():
            info = part.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise SnapshotError(f"Symlink/reparse path refused: {part}")


def checked_file(root: Path, relative: str) -> Path:
    relative_path(relative)
    path = root / relative
    assert_not_linked(path)
    if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
        raise SnapshotError(f"Required source missing or outside scope: {relative}")
    return path


def check_private(relative: str, blob: bytes | None = None) -> None:
    relative_path(relative)
    local = relative.removeprefix("game/")
    parts = PurePosixPath(relative).parts
    if any(p in (".git", ".godot", ".gradle", ".wrangler", "__pycache__", "archives", "archive") for p in parts):
        raise SnapshotError(f"Private/generated folder refused: {relative}")
    if any(p.startswith(".env") or p in (".mcp.json", "local.properties", "export_credentials.cfg", ".codex", ".agents", ".claude") for p in parts):
        raise SnapshotError(f"Private configuration refused: {relative}")
    if any(local.startswith(prefix) for prefix in EXCLUDED_PREFIXES) or re.match(r"data/content/story_script_ch.*\.json$", local):
        raise SnapshotError(f"Deferred/development source refused: {relative}")
    if PurePosixPath(relative).suffix.lower() in PRIVATE_EXTENSIONS:
        raise SnapshotError(f"Signing/private key file refused: {relative}")
    if relative.lower().endswith(".pem") and relative != PUBLIC_KEY:
        raise SnapshotError(f"Unrecognized PEM file refused: {relative}")
    if blob is not None:
        if re.search(rb"-----BEGIN [^-\r\n]*PRIVATE KEY-----", blob):
            raise SnapshotError(f"Private key material refused: {relative}")
        if relative == PUBLIC_KEY:
            if not re.fullmatch(rb"\s*-----BEGIN PUBLIC KEY-----\s+[A-Za-z0-9+/=\s]+-----END PUBLIC KEY-----\s*", blob):
                raise SnapshotError("Content verification PEM must contain only a PUBLIC KEY")
        if PurePosixPath(relative).suffix.lower() in (".json", ".md", ".cfg", ".godot", ".import", ".gradle", ".properties", ".ps1", ".sh"):
            if re.search(rb"(?i)[A-Z]:[/\\]+Users[/\\]+", blob):
                raise SnapshotError(f"Personal machine path refused: {relative}")


def sections(text: str) -> list[tuple[str, list[str]]]:
    result: list[tuple[str, list[str]]] = [("", [])]
    for line in text.splitlines():
        match = re.fullmatch(r"\s*\[([^]]+)\]\s*", line)
        if match:
            result.append((match.group(1), []))
        else:
            result[-1][1].append(line)
    return result


def render_sections(parts: list[tuple[str, list[str]]]) -> bytes:
    lines = []
    for section, body in parts:
        if section:
            lines.append(f"[{section}]")
        lines.extend(body)
    return ("\n".join(lines).rstrip() + "\n").encode()


def sanitize_project(blob: bytes) -> bytes:
    parts = sections(blob.decode("utf-8-sig"))
    for section, lines in parts:
        if section == "autoload":
            lines[:] = [line for line in lines if not re.match(r"\s*_mcp_game_helper\s*=", line)]
        if section == "editor_plugins":
            for index, line in enumerate(lines):
                if re.match(r"\s*enabled\s*=", line):
                    paths = re.findall(r'"([^"\r\n]*)"', line)
                    kept = [p for p in paths if not p.startswith(("res://addons/godot_ai/", "res://addons/gut/"))]
                    lines[index] = "enabled=PackedStringArray(" + ", ".join(json.dumps(p) for p in kept) + ")"
    output = render_sections(parts)
    if b"gl_compatibility" not in output or b"gdscript/warnings/untyped_declaration=2" not in output:
        raise SnapshotError("Project must retain Compatibility renderer and strict typing")
    return output


def sanitize_presets(blob: bytes) -> tuple[bytes, dict[str, object]]:
    parts = sections(blob.decode("utf-8-sig"))
    selected = [name for name, lines in parts if re.fullmatch(r"preset\.\d+", name) and 'name="Android AAB"' in lines]
    if len(selected) != 1:
        raise SnapshotError("Expected exactly one Android AAB export preset")
    identifier = selected[0]
    kept = [(name.replace(identifier, "preset.0", 1), lines[:]) for name, lines in parts if name in (identifier, identifier + ".options")]
    if len(kept) != 2:
        raise SnapshotError("AAB preset options missing")
    metadata: dict[str, object] = {}
    for section, lines in kept:
        for index, line in enumerate(lines):
            if "=" not in line:
                continue
            key, value = (item.strip() for item in line.split("=", 1))
            if key.startswith("keystore/") or "password" in key or key in ("encryption_key", "script_encryption_key"):
                if value not in ('""', ""):
                    raise SnapshotError(f"Nonempty signing/encryption credentials refused: {key}")
                lines[index] = None
            elif key in ("export_path", "custom_template/debug", "custom_template/release", "gradle_build/gradle_build_directory", "gradle_build/android_source_template"):
                lines[index] = key + '=\"\"'
            elif key == "patches":
                lines[index] = "patches=PackedStringArray()"
            elif key == "exclude_filter":
                existing = json.loads(value)
                lines[index] = key + "=" + json.dumps(existing + (", " if existing else "") + ".mcp.json, .env, .env.*, export_credentials.cfg")
            elif key in ("package/unique_name", "version/name", "version/code", "custom_features", "gradle_build/export_format"):
                metadata[key] = json.loads(value)
        lines[:] = [line for line in lines if line is not None]
    if metadata.get("custom_features") != "opening_bootstrap" or metadata.get("gradle_build/export_format") != 1:
        raise SnapshotError("AAB preset must be opening_bootstrap and AAB format")
    return render_sections(kept), metadata


def pack_sources(pack) -> tuple[dict[str, list[str]], dict[str, str]]:
    """Map every non-generated exported entry to its exact authored source."""
    entries = {relative_path(entry.path): entry for entry in pack.entries}
    if len(entries) != len(pack.entries):
        raise SnapshotError("Duplicate pack paths")
    sources: dict[str, list[str]] = {}
    generated: dict[str, str] = {}

    def add(source: str, exported: str) -> None:
        check_private("game/" + source)
        sources.setdefault("game/" + source, []).append(exported)

    for path, entry in entries.items():
        if entry.flags:
            raise SnapshotError(f"Unsupported encrypted/delta/removal pack entry: {path}")
        if path in GENERATED:
            generated[path] = "engine-generated export state"
        elif path.endswith(".remap"):
            original = path[:-6]
            if not original.endswith((".gd", ".tscn", ".tres")):
                raise SnapshotError(f"Unknown resource remap: {path}")
            match = re.search(rb'(?m)^path="res://([^"\r\n]+)"', pack.content(entry))
            if not match or match.group(1).decode() not in entries:
                raise SnapshotError(f"Missing remapped export resource: {path}")
            target = relative_path(match.group(1).decode())
            generated[target] = "compiled/converted resource mapped by " + path
            add(original, path)
        elif path.endswith(".import"):
            original = path[:-7]
            add(original, path)
            add(path, path)
            matches = re.findall(rb'(?m)^path(?:\.[^=]+)?="res://([^"\r\n]+)"', pack.content(entry))
            if not matches:
                raise SnapshotError(f"Import sidecar lacks generated target: {path}")
            for match in matches:
                target = relative_path(match.decode())
                if not target.startswith(".godot/imported/") or target not in entries:
                    raise SnapshotError(f"Missing or unsafe imported export resource: {path}")
                generated[target] = "imported resource mapped by " + path
        elif path.startswith(".godot/") or path.endswith((".gdc", ".scn", ".res")):
            # Reviewed after the complete traversal, independent of entry order.
            continue
        else:
            add(path, path)
    unmapped = set(entries) - set(generated) - {e for group in sources.values() for e in group}
    if unmapped:
        raise SnapshotError("Unmapped exported entries: " + ", ".join(sorted(unmapped)))
    return sources, generated


def validated_build(build_dir: Path):
    assert_not_linked(build_dir)
    report = json.loads(checked_file(build_dir, "build-report.json").read_text(encoding="utf-8-sig"))
    acceptance = json.loads(checked_file(build_dir, "pack-acceptance.json").read_text(encoding="utf-8-sig"))
    if acceptance.get("failures") != [] or acceptance.get("base_opening_only") is not True or acceptance.get("base_ready") is not True:
        raise SnapshotError("Opening pack acceptance failed or is incomplete")
    if report.get("bundletool_validation") != "passed" or report.get("distribution") != "local_review":
        raise SnapshotError("Only bundletool-validated local_review AAB builds are accepted")
    if "debug key" not in report.get("signing", "").lower():
        raise SnapshotError("Expected explicit local debug signing identity")
    if "jar verified" not in checked_file(build_dir, "jar-signature.log").read_text(encoding="utf-8-sig").lower():
        raise SnapshotError("Debug JAR signature verification evidence missing")
    artifacts = {}
    for field, filename in (("base", "opening-base.pck"), ("bundle", "opening-review.aab")):
        path = checked_file(build_dir, filename)
        item = report.get(field, {})
        if item.get("sha256") != file_digest(path) or item.get("bytes") != path.stat().st_size:
            raise SnapshotError(f"Build report artifact hash/size mismatch: {filename}")
        artifacts[field] = path
    pack = read_pack(artifacts["base"])
    problems = integrity_problems(pack)
    if problems:
        raise SnapshotError("PCK integrity failed: " + "; ".join(problems))
    with zipfile.ZipFile(artifacts["bundle"]) as bundle:
        names = bundle.namelist()
        if len(set(names)) != len(names) or not any(n.startswith("META-INF/") and n.endswith(".SF") for n in names):
            raise SnapshotError("Bundle lacks signing metadata or has duplicate ZIP entries")
        prefix = "assetPackInstallTime/assets/"
        packed_paths = {e.path for e in pack.entries}
        bundle_paths = {n[len(prefix):] for n in names if n.startswith(prefix) and not n.endswith("/")}
        if bundle_paths - packed_paths - {"assets.sparsepck", "_cl_"} or packed_paths - bundle_paths:
            raise SnapshotError("AAB runtime asset inventory differs from the verified base PCK")
        for entry in pack.entries:
            if digest(bundle.read(prefix + entry.path)) != digest(pack.content(entry)):
                raise SnapshotError(f"AAB/base PCK content differs: {entry.path}")
    try:
        verify_native(artifacts["bundle"])
    except ValueError as error:
        raise SnapshotError(str(error)) from error
    return report, acceptance, artifacts, pack


def scope_output(project_root: Path, output: Path | None) -> tuple[Path, Path]:
    assert_not_linked(project_root)
    root = project_root.resolve()
    if root == Path(root.anchor):
        raise SnapshotError("A filesystem root is not a project")
    expected = root / "release" / "current"
    supplied = output if output is not None else expected
    if not supplied.is_absolute():
        supplied = root / supplied
    assert_not_linked(supplied)
    if supplied.absolute() != expected:
        raise SnapshotError("Output must be <project-root>/release/current")
    return root, expected


def owned_folder(path: Path, release_root: Path) -> None:
    if path.parent != release_root or not (path.name == "current" or path.name.startswith((".current-stage-", ".current-previous-"))):
        raise SnapshotError("Folder is outside the materializer's deletion scope")
    assert_not_linked(path)
    marker = path / MARKER
    if not marker.is_file() or json.loads(marker.read_text()).get("owner") != OWNER:
        raise SnapshotError("Existing folder is not marked as tool-owned: " + str(path))
    for item in path.rglob("*"):
        assert_not_linked(item)


def remove_owned(path: Path, release_root: Path) -> None:
    owned_folder(path, release_root)
    shutil.rmtree(path)


def promote(stage: Path, output: Path) -> None:
    """Directory rename with rollback; previous current survives any install failure."""
    parent = output.parent
    owned_folder(stage, parent)
    previous = parent / (".current-previous-" + uuid.uuid4().hex)
    if output.exists():
        owned_folder(output, parent)
        os.replace(output, previous)
    try:
        os.replace(stage, output)
    except BaseException:
        if previous.exists():
            os.replace(previous, output)
        raise
    if previous.exists():
        try:
            remove_owned(previous, parent)
        except OSError as error:
            # Commit has succeeded. Keep the marked recovery copy if cleanup fails.
            print(f"Snapshot installed; marked recovery folder retained: {error}", file=sys.stderr)


class Writer:
    def __init__(self, root: Path, stage: Path):
        self.root, self.stage = root, stage
        self.rows: dict[str, dict[str, object]] = {}

    def put(self, target: str, data: bytes, category: str, source: str | None = None, source_hash: str | None = None, exported: list[str] | None = None) -> None:
        check_private(target, data)
        if target in self.rows:
            if (self.stage / target).read_bytes() != data:
                raise SnapshotError("Conflicting snapshot source: " + target)
            return
        path = self.stage / target
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        self.rows[target] = {"path": target, "bytes": len(data), "sha256": digest(data), "category": category,
                             "source": source, "source_sha256": source_hash, "exported_entries": sorted(exported or [])}

    def copy(self, source: str, target: str | None = None, category: str = "build_support", exported: list[str] | None = None, transform=None) -> None:
        path = checked_file(self.root, source)
        blob = path.read_bytes()
        check_private(source, blob)
        self.put(target or source, transform(blob) if transform else blob, category, source, digest(blob), exported)
        if path.stat().st_mode & 0o111:
            destination = self.stage / (target or source)
            destination.chmod(destination.stat().st_mode | 0o111)
            self.rows[target or source]["executable"] = True


def verify_snapshot(output: Path, project_root: Path | None = None) -> dict[str, object]:
    assert_not_linked(output)
    output = output.resolve()
    if not (output / MARKER).is_file() or json.loads((output / MARKER).read_text()).get("owner") != OWNER:
        raise SnapshotError("Snapshot ownership marker missing or invalid")
    index = json.loads(checked_file(output, "FILE_INDEX.json").read_text())
    release = json.loads(checked_file(output, "release.json").read_text())
    if release.get("file_index_sha256") != file_digest(output / "FILE_INDEX.json"):
        raise SnapshotError("File index seal mismatch")
    expected = {"FILE_INDEX.json", "release.json"}
    for row in index.get("files", []):
        name = relative_path(row["path"])
        if name in expected:
            raise SnapshotError("Duplicate file index path: " + name)
        expected.add(name)
        path = checked_file(output, name)
        check_private(name, path.read_bytes() if path.stat().st_size < 10_000_000 else None)
        if row["sha256"] != file_digest(path) or row["bytes"] != path.stat().st_size:
            raise SnapshotError("Snapshot file was modified: " + name)
        if os.name != "nt" and row.get("executable") and not path.stat().st_mode & 0o111:
            raise SnapshotError("Snapshot executable permission missing: " + name)
    actual = set()
    for item in output.rglob("*"):
        assert_not_linked(item)
        if item.is_file():
            actual.add(item.relative_to(output).as_posix())
    if actual != expected:
        raise SnapshotError("Unexpected/missing snapshot files: " + ", ".join(sorted(actual ^ expected)))
    if project_root is None and output.name == "current" and output.parent.name == "release" and (output.parent.parent / "game/project.godot").is_file():
        project_root = output.parent.parent
    if project_root is not None:
        assert_not_linked(project_root)
        for row in index["files"]:
            if row.get("source") and row.get("source_sha256"):
                path = checked_file(project_root.resolve(), row["source"])
                if file_digest(path) != row["source_sha256"]:
                    raise SnapshotError("Upstream source changed; refresh current: " + row["source"])
    return {"status": "verified", "files": len(index["files"]), "source_staleness_checked": project_root is not None,
            "base_sha256": release["artifacts"]["base"]["sha256"], "bundle_sha256": release["artifacts"]["bundle"]["sha256"]}


def materialize(project_root: Path, build_dir: Path, output: Path | None = None, no_promote: bool = False, support_files: list[str] | None = None) -> Path:
    if not no_promote:
        raise SnapshotError("Stage with --no-promote; use Update-CurrentAAB.ps1 for clean-source validation and promotion")
    root, output = scope_output(project_root, output)
    build_dir = build_dir if build_dir.is_absolute() else root / build_dir
    report, acceptance, artifacts, pack = validated_build(build_dir)
    sources, generated = pack_sources(pack)
    if output.exists():
        owned_folder(output, output.parent)
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = output.parent / (".current-stage-" + uuid.uuid4().hex)
    stage.mkdir()
    writer = Writer(root, stage)
    writer.put(MARKER, json_bytes({"owner": OWNER}), "generated_metadata")
    try:
        build_created = datetime.fromisoformat(report["created_at"].replace("Z", "+00:00")).timestamp()
        for source, exported in sorted(sources.items()):
            source_file = checked_file(root, source)
            if source_file.stat().st_mtime > build_created + 2:
                raise SnapshotError("Source is newer than verified export; rebuild first: " + source)
            # Raw exported authored bytes must agree with the inputs, independently
            # of timestamps. Compiled/imported resources are traced by remap records.
            if not source.endswith(".import") and any(e == source.removeprefix("game/") for e in exported):
                entry = next(e for e in pack.entries if e.path == source.removeprefix("game/"))
                if file_digest(source_file) != digest(pack.content(entry)):
                    raise SnapshotError("Exported authored file differs from current source: " + source)
            writer.copy(source, category="base_runtime", exported=exported)
            if source.endswith((".gd", ".gdshader")) and (root / (source + ".uid")).is_file():
                writer.copy(source + ".uid", category="base_source_uid", exported=exported)
        writer.copy("game/project.godot", category="transformed_project_config", transform=sanitize_project)
        preset_blob, preset_metadata = sanitize_presets(checked_file(root, "game/export_presets.cfg").read_bytes())
        writer.copy("game/export_presets.cfg", category="transformed_export_config", transform=lambda _: preset_blob)
        native_java = sorted((root / "game/android/plugins/uomd_native/src/main/java").rglob("*.java"))
        if not native_java:
            raise SnapshotError("Required native Java inputs missing")
        for source in (*BUILD_SUPPORT, *(p.relative_to(root).as_posix() for p in native_java)):
            writer.copy(source)
        admob = (stage / "game/android/plugins/uomd_native/src/main/res/values/uomd_admob.xml").read_text()
        if not re.search(r"ca-app-pub-\d{16}~\d{10}", admob):
            raise SnapshotError("Native AdMob XML must contain a public application ID")
        writer.copy("LICENSE", category="license")
        # Preserve the upstream notice and the licenses it explicitly names.
        writer.copy("THIRD_PARTY_NOTICE.md", category="license")
        for relative in ("THIRD_PARTY_LICENSES/claude-code-game-studios-MIT.txt",):
            if (root / relative).is_file():
                writer.copy(relative, category="license")
        for spec in support_files or []:
            if ":" not in spec:
                raise SnapshotError("Support file requires upstream/relative:target/relative")
            source, target = spec.split(":", 1)
            relative_path(source)
            relative_path(target)
            if not target.startswith(("docs/", "tools/")):
                raise SnapshotError("Support destination must be docs/ or tools/")
            writer.copy(source, target, category="review_build_support")
        for field, target in (("base", "artifacts/opening-base.pck"), ("bundle", "artifacts/game.aab")):
            writer.put(target, artifacts[field].read_bytes(), "verified_export_artifact")
        safe_report = {"created_at": report["created_at"], "distribution": "local_review", "bundletool_validation": "passed",
                       "debug_signature": "verified_local_debug_only", "device_test": report.get("device_test", "pending"),
                       "base": {"path": "artifacts/opening-base.pck", "sha256": report["base"]["sha256"], "bytes": report["base"]["bytes"]},
                       "bundle": {"path": "artifacts/game.aab", "sha256": report["bundle"]["sha256"], "bytes": report["bundle"]["bytes"]}}
        writer.put("docs/build-report.json", json_bytes(safe_report), "review_evidence")
        writer.put("docs/pack-acceptance.json", json_bytes(acceptance), "review_evidence")
        writer.put("docs/native-packaging.json", json_bytes(verify_native(artifacts["bundle"])), "review_evidence")
        writer.put("README.md", (
            "# Current opening AAB — local review\n\n"
            "Test `artifacts/game.aab`. This is the latest verified local opening build, through patch completion, "
            "confirmation and restart. It has a debug signature; production signing, Android device acceptance and "
            "final voice/music remain pending. It is not a published production release.\n\n"
            "Edit the upstream project only. This generated folder is replaced after a successful rebuild and "
            "validation. `game/` contains the exact editable inputs mapped from the base PCK, plus explicitly listed "
            "native/export support. `FILE_INDEX.json` maps every file to its upstream source and purpose; "
            "`release.json` ties those inputs to the tested artifacts. No exact byte-for-byte reproducibility is promised.\n\n"
            "Use Godot 4.7.2 and its matching Android templates; install the Android build template into `game/` "
            "before exporting. The sole `Android AAB` preset retains Compatibility rendering and strict typing. "
            "The native AARs can be rebuilt with `game/tools/build_uomd_native.sh`; JDK, Android SDK, Gradle and "
            "signing identities are local prerequisites. No private keystore is included.\n\n"
            "Owner-selected Git tracking includes source, notices and artifacts. AAB and base PCK use the "
            "repository's Git LFS attributes; install Git LFS and fetch their objects before verification. "
            "Keep credentials and generated caches outside deliverables. No push or publication is performed by this tool.\n"
        ).encode(), "review_instructions")
        writer.put(".gitignore", b"# Ignore rules disabled at repository owner request.\n", "source_publish_policy")
        index_blob = json_bytes({"schema_version": 1, "files": sorted(writer.rows.values(), key=lambda row: row["path"])})
        (stage / "FILE_INDEX.json").write_bytes(index_blob)
        release = {"schema_version": 1, "owner": OWNER, "status": "local_review",
                   "created_at": datetime.now(timezone.utc).isoformat(), "engine": pack.engine,
                   "export_scope": "opening_bootstrap_through_patch_confirmation_and_restart", "preset": preset_metadata,
                   "file_index_sha256": digest(index_blob), "artifacts": {"base": safe_report["base"], "bundle": safe_report["bundle"]},
                   "acceptance": {"pack": "passed", "bundletool": "passed", "native_packaging": "passed", "signature": "local_debug_verified", "device": "pending", "audio": "pending", "production_signing": "pending"},
                   "exported_entries": len(pack.entries), "generated_entries": generated,
                   "source_edit_policy": "upstream_only; regenerated current replaces successful previous snapshot"}
        (stage / "release.json").write_bytes(json_bytes(release))
        verify_snapshot(stage, root)
        return stage
    except BaseException:
        if stage.exists():
            remove_owned(stage, output.parent)
        raise


def record_validation(stage: Path, root: Path, build_dir: Path) -> None:
    _, output = scope_output(root, None)
    owned_folder(stage, output.parent)
    if not stage.name.startswith(".current-stage-"):
        raise SnapshotError("Validation evidence requires a staged candidate")
    verify_snapshot(stage, root)
    release = json.loads((stage / "release.json").read_text())
    rebuild = json.loads(checked_file(build_dir, "source-rebuild-acceptance.json").read_text())
    privacy = json.loads(checked_file(build_dir, "base-privacy-acceptance.json").read_text())
    if rebuild.get("status") != "passed" or rebuild.get("entries") != release["exported_entries"] or rebuild.get("scenes_semantically_equal", 0) < 1:
        raise SnapshotError("Clean source rebuild acceptance incomplete")
    if privacy.get("failures") != [] or privacy.get("opening_only") is not True or privacy.get("registry_ready") is not True or len(privacy.get("tutorials", [])) != 3:
        raise SnapshotError("Base privacy/runtime acceptance incomplete")
    writer = Writer(root, stage)
    index = json.loads((stage / "FILE_INDEX.json").read_text())
    writer.rows = {row["path"]: row for row in index["files"]}
    for name in ("source-rebuild-acceptance.json", "base-privacy-acceptance.json"):
        source = (build_dir / name).relative_to(root).as_posix()
        writer.copy(source, "docs/" + name, category="review_evidence")
    index_blob = json_bytes({"schema_version": 1, "files": sorted(writer.rows.values(), key=lambda row: row["path"])})
    (stage / "FILE_INDEX.json").write_bytes(index_blob)
    release["file_index_sha256"] = digest(index_blob)
    release["acceptance"]["source_rebuild"] = "passed"
    release["acceptance"]["base_privacy"] = "passed"
    (stage / "release.json").write_bytes(json_bytes(release))
    verify_snapshot(stage, root)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="stage, validate and replace only release/current")
    build.add_argument("--project-root", type=Path, required=True)
    build.add_argument("--build-dir", type=Path, required=True)
    build.add_argument("--output", type=Path)
    build.add_argument("--no-promote", action="store_true", help="retain a validated marked candidate without replacing current")
    build.add_argument("--support-file", action="append", default=[], metavar="SOURCE:TARGET", help="portable upstream relative source into docs/ or tools/")
    check = sub.add_parser("verify", help="check all files, unexpected entries and upstream staleness")
    check.add_argument("output", type=Path)
    check.add_argument("--project-root", type=Path)
    install = sub.add_parser("promote", help="verify and install an already validated marked candidate")
    install.add_argument("stage", type=Path)
    install.add_argument("--project-root", type=Path, required=True)
    discard = sub.add_parser("discard", help="remove only a marked candidate in this project's release folder")
    discard.add_argument("stage", type=Path)
    discard.add_argument("--project-root", type=Path, required=True)
    evidence = sub.add_parser("record-validation", help="seal clean-source and runtime acceptance into a marked candidate")
    evidence.add_argument("stage", type=Path)
    evidence.add_argument("--project-root", type=Path, required=True)
    evidence.add_argument("--build-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            path = materialize(args.project_root, args.build_dir, args.output, args.no_promote, args.support_file)
            print(json.dumps({"status": "staged" if args.no_promote else "current_updated", "output": str(path)}))
        elif args.command == "promote":
            root, output = scope_output(args.project_root, None)
            stage = args.stage.absolute()
            if not stage.name.startswith(".current-stage-"):
                raise SnapshotError("Promotion requires a staged candidate")
            verify_snapshot(stage, root)
            acceptance = json.loads((stage / "release.json").read_text())["acceptance"]
            if acceptance.get("source_rebuild") != "passed" or acceptance.get("base_privacy") != "passed":
                raise SnapshotError("Clean-source/runtime acceptance must be recorded before promotion")
            promote(stage, output)
            print(json.dumps({"status": "current_updated", "output": str(output)}))
        elif args.command == "discard":
            root, output = scope_output(args.project_root, None)
            stage = args.stage.absolute()
            if not stage.name.startswith(".current-stage-"):
                raise SnapshotError("Discard requires a staged candidate")
            remove_owned(stage, output.parent)
            print(json.dumps({"status": "candidate_discarded"}))
        elif args.command == "record-validation":
            root, _ = scope_output(args.project_root, None)
            build_dir = args.build_dir if args.build_dir.is_absolute() else root / args.build_dir
            record_validation(args.stage.absolute(), root, build_dir.absolute())
            print(json.dumps({"status": "validation_recorded"}))
        else:
            print(json.dumps(verify_snapshot(args.output, args.project_root)))
        return 0
    except (OSError, SnapshotError, KeyError, TypeError, json.JSONDecodeError, zipfile.BadZipFile) as error:
        print(f"snapshot refused: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
