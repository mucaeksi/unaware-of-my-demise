#!/usr/bin/env python3
"""Read-only validation of Narrative transfer provenance and protected content.

No network access, source-code execution, generation, or Git mutation occurs.
By default compare target bytes with Git's index; --git-ref HEAD checks a commit.
The historical source copy is optional, because its stored hash/size remain in
the committed transfer manifest after the ephemeral download directory is gone.
"""

import argparse
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys


SHA256 = re.compile(r"^[0-9a-f]{64}$")
SHA1 = re.compile(r"^[0-9a-f]{40}$")
ACTIONS = {
    "MIGRATE", "ALREADY_MIGRATED", "LEAVE_IN_DRIVE",
    "EXCLUDE_SUBTREE", "INVENTORY_FOLDER",
}
EXCLUDED_NAMES = {".secrets", "__pycache__"}
LOCK_PATH = "narrative/references/REFERENCE_SET.lock.json"
CONTENT_MANIFEST = "game/data/content/MANIFEST.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def walk_values(value, key):
    if isinstance(value, dict):
        for name, item in value.items():
            if name == key:
                yield item
            yield from walk_values(item, key)
    elif isinstance(value, list):
        for item in value:
            yield from walk_values(item, key)


class Validator:
    def __init__(self, args):
        self.args = args
        self.repo = args.repo.resolve()
        self.errors = []
        self.warnings = []
        self.summary = {}

    def require(self, condition, message):
        if not condition:
            self.errors.append(message)
        return condition

    def safe_relative(self, value, label, allow_excluded=False):
        if not self.require(isinstance(value, str) and bool(value), f"{label}: missing path"):
            return None
        path = PurePosixPath(value)
        if not self.require(not path.is_absolute() and ".." not in path.parts and
                            "\\" not in value and str(path) == value,
                            f"{label}: path must be a normalized relative POSIX path"):
            return None
        if not allow_excluded and not self.require(not EXCLUDED_NAMES.intersection(path.parts),
                                                    f"{label}: excluded subtree cannot be read"):
            return None
        return path

    def local_bytes(self, root, relative, label):
        path = root.joinpath(*relative.parts)
        try:
            if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
                self.errors.append(f"{label}: symlink or path outside permitted root")
                return None
            return path.read_bytes()
        except OSError as error:
            self.errors.append(f"{label}: {error}")
            return None

    def git_bytes(self, relative, git_ref=None, report=True):
        git_ref = self.args.git_ref if git_ref is None else git_ref
        spec = f":{relative}" if git_ref == "INDEX" else f"{git_ref}:{relative}"
        result = subprocess.run(["git", "show", spec], cwd=self.repo,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        if result.returncode:
            if report:
                self.errors.append(f"{relative}: missing Git blob in {git_ref}")
            return None
        return result.stdout

    def check_bytes(self, data, expected_size, expected_hash, label):
        if data is None:
            return
        self.require(isinstance(expected_size, int) and not isinstance(expected_size, bool)
                     and expected_size >= 0, f"{label}: invalid size")
        self.require(isinstance(expected_hash, str) and SHA256.fullmatch(expected_hash),
                     f"{label}: invalid SHA-256")
        self.require(len(data) == expected_size, f"{label}: size mismatch")
        self.require(digest(data) == expected_hash, f"{label}: SHA-256 mismatch")

    def baseline(self, commit):
        if self.args.baseline:
            data = json.loads(self.args.baseline.read_bytes())
            self.require(data.get("baseline_commit") == commit,
                         "protected baseline commit differs from migration manifest")
            return data["protected_files"]
        lock_raw = self.git_bytes(LOCK_PATH, commit)
        content_raw = self.git_bytes(CONTENT_MANIFEST, commit)
        if lock_raw is None or content_raw is None:
            return []
        lock = json.loads(lock_raw)
        content = json.loads(content_raw)["files"]
        paths = sorted({item["path"] for item in lock["items"]} |
                       {LOCK_PATH, CONTENT_MANIFEST} |
                       {"game/data/content/" + name for name in content})
        entries = []
        for path in paths:
            raw = self.git_bytes(path, commit)
            if raw is not None:
                entries.append({"path": path, "size": len(raw), "sha256": digest(raw),
                                "baseline_git_blob_sha1": git_blob_sha1(raw)})
        return entries

    def validate_protected(self, commit):
        protected = self.baseline(commit)
        self.require(len(protected) == 55, f"protected baseline must contain 55 files, found {len(protected)}")
        for entry in protected:
            path = self.safe_relative(entry["path"], "protected baseline")
            if path is None:
                continue
            raw = self.local_bytes(self.repo, path, str(path))
            self.check_bytes(raw, entry["size"], entry["sha256"], f"{path} protected worktree")
            blob = self.git_bytes(str(path))
            self.check_bytes(blob, entry["size"], entry["sha256"], f"{path} protected Git")
            if blob is not None:
                self.require(git_blob_sha1(blob) == entry["baseline_git_blob_sha1"],
                             f"{path}: protected Git object changed")
        self.summary["protected_files"] = len(protected)
        lock = json.loads((self.repo / LOCK_PATH).read_bytes())
        self.require(lock.get("status") == "APPROVED_LOCKED", "reference lock status changed")
        self.require(len(lock["items"]) == 26, "reference lock must contain 26 items")
        lock_by_id = {}
        for entry in lock["items"]:
            path = self.safe_relative(entry["path"], "lock item")
            if path is not None:
                self.check_bytes(self.local_bytes(self.repo, path, str(path)),
                                 entry["size"], entry["sha256"], f"{path} reference lock")
            lock_by_id[entry["drive_id"]] = entry
        self.summary["locked_files"] = len(lock_by_id)
        return lock_by_id

    def validate_runtime(self):
        root = self.repo / "game/data/content"
        content = json.loads((root / "MANIFEST.json").read_bytes())["files"]
        self.require(len(content) == 27, "runtime manifest must contain 27 files")
        found = {path.name for path in root.glob("*.json") if path.name != "MANIFEST.json"}
        self.require(found == set(content), "runtime content set differs from manifest")
        parsed = {}
        for name, entry in content.items():
            path = self.safe_relative(name, "runtime filename")
            if path is None:
                continue
            raw = self.local_bytes(root, path, name)
            self.check_bytes(raw, entry["bytes"], entry["sha256"], f"{name} runtime")
            if raw is not None:
                parsed[name] = json.loads(raw)
                self.require(isinstance(parsed[name], dict), f"{name}: runtime JSON must be an object")
        main = parsed["story_script_part1_manifest.json"]
        scripts = [parsed[name] for name in main["chapter_files"]]
        lines = [line for script in scripts for line in walk_values(script, "line_id")]
        counts = {
            "chapters": len(scripts), "story_order": len(main["story_order"]),
            "stages": len(parsed["stages_part1.json"]["stages"]),
            "non_stage_scenes": len(main["non_stage_scene_ids"]),
            "main_lines": len(lines), "unique_main_lines": len(set(lines)),
            "characters": len(parsed["characters_part1.json"]["characters"]),
            "visual_briefs": len(parsed["character_visuals_part1.json"]["characters"]),
            "character_story_parts": len(list(walk_values(parsed["character_stories_part1.json"], "story_id"))),
            "character_voice_lines": len(list(walk_values(parsed["character_voice_lines_part1.json"], "line_id"))),
        }
        expected = {"chapters": 7, "story_order": 51, "stages": 35, "non_stage_scenes": 16,
                    "main_lines": 409, "unique_main_lines": 409, "characters": 20,
                    "visual_briefs": 20, "character_story_parts": 76, "character_voice_lines": 220}
        self.require(counts == expected, f"runtime content counts changed: {counts}")
        self.summary["runtime_json_files"] = len(content)
        self.summary["runtime_counts"] = counts

    def validate_syntax(self, record, raw):
        path = record["target_path"]
        validation = record.get("validation", {})
        suffix = PurePosixPath(path).suffix.lower()
        expected = validation.get("json_parse")
        if suffix == ".json":
            self.require(expected in {"valid", "historical_invalid"},
                         f"{path}: JSON parse outcome must be declared")
            try:
                json.loads(raw)
            except (ValueError, UnicodeError) as error:
                self.require(expected == "historical_invalid", f"{path}: invalid JSON without historical exception")
                self.require(validation.get("json_error") == str(error),
                             f"{path}: historical JSON error differs from recorded error")
                self.summary.setdefault("historical_json_exceptions", []).append(path)
            else:
                self.require(expected == "valid", f"{path}: declared invalid JSON actually parses")
        else:
            self.require(expected in {None, "not_applicable"}, f"{path}: irrelevant JSON parse declaration")
        if suffix == ".py":
            try:
                ast.parse(raw, filename=path)
            except (SyntaxError, UnicodeError) as error:
                message = error.msg if isinstance(error, SyntaxError) else str(error)
                self.errors.append(f"{path}: Python syntax error: {message}")

    def validate_inventory(self, manifest, records):
        narrative = [entry for entry in records if entry.get("source_path", "").startswith("LEGACY/narrative/")]
        self.require(manifest.get("inventory", {}).get("entries") == len(narrative),
                     "Narrative inventory entry count differs from manifest records")
        if self.args.inventory:
            inventory = json.loads(self.args.inventory.read_bytes())
            source = {entry["id"]: entry for entry in inventory}
            targets = {entry["drive_id"]: entry for entry in narrative}
            self.require(len(source) == len(inventory), "duplicate Drive IDs in inventory")
            self.require(set(source) == set(targets), "manifest does not cover exact live inventory Drive ID set")
            for drive_id in source.keys() & targets.keys():
                entry, record = source[drive_id], targets[drive_id]
                for source_key, manifest_key in [("source_path", "source_path"), ("parent_id", "parent_id"),
                                                 ("file_or_folder", "file_or_folder"), ("mime_type", "mime_type")]:
                    self.require(entry.get(source_key) == record.get(manifest_key),
                                 f"{drive_id}: inventory {manifest_key} differs")
                if entry["file_or_folder"] == "file":
                    size = int(entry["size"]) if entry.get("size") not in {None, ""} else None
                    self.require(size == record.get("source_size"), f"{drive_id}: inventory source size differs")
        excluded = {entry["drive_id"] for entry in records if entry.get("action") == "EXCLUDE_SUBTREE"}
        self.require(set(manifest.get("inventory", {}).get("excluded_subtree_ids", [])) == excluded,
                     "excluded subtree ID list differs from EXCLUDE_SUBTREE records")
        self.summary["narrative_inventory_entries"] = len(narrative)

    def run(self):
        manifest = json.loads(self.args.manifest.read_bytes())
        self.require(manifest.get("schema") == 1, "unsupported migration manifest schema")
        self.require(manifest.get("batch") == "BATCH-0005", "unexpected migration batch")
        commit = manifest.get("baseline_commit")
        if not self.require(isinstance(commit, str) and SHA1.fullmatch(commit), "baseline_commit must be full SHA-1"):
            return
        locked = self.validate_protected(commit)
        self.validate_runtime()
        records = manifest.get("files", [])
        self.require(isinstance(records, list), "manifest files must be an array")
        ids = [entry.get("drive_id") for entry in records]
        self.require(all(isinstance(value, str) and value for value in ids), "missing record Drive ID")
        self.require(len(ids) == len(set(ids)), "duplicate record Drive IDs")
        self.validate_inventory(manifest, records)
        targets = {}
        for entry in records:
            drive_id = entry.get("drive_id")
            action = entry.get("action")
            source_path = entry.get("source_path")
            self.require(action in ACTIONS, f"{drive_id}: unsupported action {action}")
            self.require(isinstance(entry.get("parent_id"), str) and entry["parent_id"], f"{drive_id}: missing parent ID")
            self.require(entry.get("file_or_folder") in {"file", "folder"}, f"{drive_id}: invalid file/folder type")
            self.require(isinstance(entry.get("mime_type"), str), f"{drive_id}: missing MIME")
            self.require(isinstance(entry.get("status"), str) and entry["status"], f"{drive_id}: missing status")
            self.require("provider_checksum" in entry and "provider_version" in entry,
                         f"{drive_id}: provider checksum/version availability must be explicit")
            source = self.safe_relative(source_path, f"{drive_id} source", allow_excluded=True)
            if source is None:
                continue
            excluded_components = EXCLUDED_NAMES.intersection(source.parts)
            if excluded_components:
                self.require(action == "EXCLUDE_SUBTREE" and entry.get("file_or_folder") == "folder"
                             and source.name in EXCLUDED_NAMES,
                             f"{source}: excluded subtree must only have a folder-level record")
                continue
            if action not in {"MIGRATE", "ALREADY_MIGRATED"}:
                self.require(bool(entry.get("reason")), f"{source}: non-transfer record needs a reason")
                continue
            self.require(entry.get("file_or_folder") == "file", f"{source}: cannot migrate a folder as file bytes")
            self.require(entry.get("transformation") == "none", f"{source}: migration must preserve raw bytes")
            path = self.safe_relative(entry.get("target_path"), f"{drive_id} target")
            if path is None:
                continue
            self.require(path.parts[0] == "narrative", f"{path}: target outside narrative")
            self.require(str(path) not in targets, f"{path}: duplicate migration target")
            targets[str(path)] = drive_id
            self.require(entry.get("source_sha256") == entry.get("target_sha256"), f"{path}: source/target hashes differ")
            raw = self.local_bytes(self.repo, path, str(path))
            self.check_bytes(raw, entry.get("source_size"), entry.get("source_sha256"), f"{path} source-preserving worktree")
            blob = self.git_bytes(str(path), report=False)
            if blob is None and action == "ALREADY_MIGRATED" and self.args.git_ref == "INDEX":
                blob = self.git_bytes(str(path), "HEAD")
            elif blob is None:
                self.errors.append(f"{path}: missing Git blob in {self.args.git_ref}")
            self.check_bytes(blob, entry.get("source_size"), entry.get("target_sha256"), f"{path} Git")
            self.require(isinstance(entry.get("git_blob_sha1"), str) and SHA1.fullmatch(entry["git_blob_sha1"]),
                         f"{path}: missing source Git blob SHA-1")
            if blob is not None:
                self.require(git_blob_sha1(blob) == entry.get("git_blob_sha1"), f"{path}: Git normalization or byte mutation")
            if drive_id in locked:
                expected = locked[drive_id]
                self.require(action == "ALREADY_MIGRATED", f"{path}: locked ID must map to existing reference")
                self.require(str(path) == expected["path"] and entry.get("source_sha256") == expected["sha256"]
                             and entry.get("source_size") == expected["size"], f"{path}: lock provenance mismatch")
            if self.args.source_root and source_path.startswith("LEGACY/narrative/"):
                relative = self.safe_relative(source_path.removeprefix("LEGACY/narrative/"), "retrieved source")
                if relative is not None:
                    source_file = self.args.source_root.joinpath(*relative.parts)
                    if action == "MIGRATE" or source_file.exists():
                        downloaded = self.local_bytes(self.args.source_root, relative, source_path)
                        self.check_bytes(downloaded, entry.get("source_size"), entry.get("source_sha256"),
                                         f"{source_path} retrieved source")
            if raw is not None and action == "MIGRATE":
                self.validate_syntax(entry, raw)
        self.summary["actions"] = dict(sorted(Counter(entry.get("action") for entry in records).items()))
        self.summary["verified_transfer_targets"] = len(targets)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--manifest", type=Path, default=Path("docs/migration/BATCH-0005.manifest.json"))
    parser.add_argument("--baseline", type=Path, help="optional external 55-file baseline; otherwise derived from baseline_commit")
    parser.add_argument("--inventory", type=Path, help="optional original Drive inventory JSON for exact coverage checks")
    parser.add_argument("--source-root", type=Path, help="optional ephemeral raw Narrative download root")
    parser.add_argument("--git-ref", default="INDEX", help="INDEX (default) or commit/tree reference, such as HEAD")
    args = parser.parse_args()
    if not args.manifest.is_absolute():
        args.manifest = args.repo / args.manifest
    if args.source_root:
        args.source_root = args.source_root.resolve()
    validator = Validator(args)
    try:
        validator.run()
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        validator.errors.append(f"validation could not complete: {type(error).__name__}: {error}")
    print(json.dumps({"ok": not validator.errors, "git_ref": args.git_ref,
                      "summary": validator.summary, "errors": validator.errors,
                      "warnings": validator.warnings}, ensure_ascii=False, indent=2))
    return 1 if validator.errors else 0


if __name__ == "__main__":
    sys.exit(main())
