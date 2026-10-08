"""Conservative, deterministic Godot text extraction for Graphify.

This is a lexical/structural adapter, not a full GDScript AST or runtime resolver.
It never evaluates project scripts and never reads Graphify's graph.json.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess


GODOT_EXTENSIONS = {".gd", ".tscn", ".tres", ".godot", ".gdshader", ".cfg"}
EXCLUDED_PARTS = {".git", ".godot", "build", "local-backups", ".local", "graphify-out", "node_modules", "__pycache__"}
SENSITIVE_PARTS = {".env", "export_credentials.cfg", "credentials.cfg", "secrets.cfg"}
SENSITIVE_EXTENSIONS = {".pem", ".key", ".keystore", ".jks", ".p12"}
ENGINE_BASE_TYPES = {"AcceptDialog", "Button", "ColorRect", "ConfirmationDialog", "Control", "EditorDebuggerPlugin", "EditorDock", "EditorExportPlugin", "EditorPlugin", "EditorScript", "FileDialog", "HBoxContainer", "MarginContainer", "Node", "Node2D", "Object", "PanelContainer", "RefCounted", "SceneTree", "Tree", "VBoxContainer", "Window"}
STRING = re.compile(r'(?P<quote>"""|\'\'\'|"|\')(?P<body>.*?)(?<!\\)(?P=quote)', re.S)
RESOURCE_LITERAL = re.compile(r"^\*?(?:res|uid)://")
ATTR = re.compile(r'(\w+)\s*=\s*("(?:\\.|[^"\\])*"|ExtResource\([^)]*\)|SubResource\([^)]*\)|[^\s]+)')
FUNCTION = re.compile(r"(?m)^([ \t]*)(?:static[ \t]+)?func[ \t]+([A-Za-z_]\w*)[ \t]*\(")
INNER_CLASS = re.compile(r"(?m)^([ \t]*)class[ \t]+([A-Za-z_]\w*)(?:[ \t]+extends[ \t]+([A-Za-z_]\w*(?:\.\w+)*))?[ \t]*:")
IDENTIFIER = r"[A-Za-z_]\w*"


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", value.lower()).strip("_")


def symbol_normalize(value: str) -> str:
    """Preserve meaningful identifier underscores (foo and _foo differ)."""
    return re.sub(r"[^a-z0-9_]+", "_", value.lower())


def safe_source(path: str) -> bool:
    p = PurePosixPath(path.replace("\\", "/"))
    return not any(part in EXCLUDED_PARTS or part in SENSITIVE_PARTS or part.startswith(".env.") for part in p.parts) and p.suffix.lower() not in SENSITIVE_EXTENSIONS


def git_inventory(root: Path) -> list[str]:
    raw = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root)
    return sorted(set(p.decode("utf-8", "surrogateescape").replace("\\", "/") for p in raw.split(b"\0") if p))


def file_id_map(inventory: list[str]) -> dict[str, str]:
    """Graphify's extension-dropped relative ID, salted only on collisions."""
    groups: dict[str, list[str]] = defaultdict(list)
    for path in inventory:
        groups[normalize(str(PurePosixPath(path).with_suffix("")))].append(path)
    result = {}
    for base, paths in groups.items():
        for path in paths:
            candidate = base if len(paths) == 1 else base + "_" + normalize(PurePosixPath(path).suffix.lstrip("."))
            # Different punctuation/case can still collide after the extension.
            if candidate in result.values():
                candidate += "_" + hashlib.sha256(path.encode()).hexdigest()[:8]
            result[path] = candidate
    return result


def lexical_view(text: str, *, semicolon_comments: bool = False, shader: bool = False) -> tuple[str, list[tuple[int, str]]]:
    """Mask comments/strings while preserving byte positions and line numbers."""
    chars = list(text)
    strings: list[tuple[int, str]] = []
    i, n = 0, len(text)
    while i < n:
        if (text[i] == "#" and not shader) or (shader and text.startswith("//", i)) or (semicolon_comments and text[i] == ";"):
            end = text.find("\n", i)
            end = n if end < 0 else end
            for j in range(i, end):
                chars[j] = " "
            i = end
        elif shader and text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = n if end < 0 else end + 2
            for j in range(i, end):
                if chars[j] != "\n":
                    chars[j] = " "
            i = end
        elif text[i] in "\"'":
            quote = text[i:i + 3] if text[i:i + 3] in ('"""', "'''") else text[i]
            start = i
            i += len(quote)
            body_start = i
            while i < n:
                if text[i] == "\\":
                    i += 2
                elif text.startswith(quote, i):
                    body = text[body_start:i]
                    strings.append((start, body))
                    i += len(quote)
                    break
                else:
                    i += 1
            for j in range(start, min(i, n)):
                if chars[j] != "\n":
                    chars[j] = " "
        else:
            i += 1
    return "".join(chars), strings


def line_at(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def indent_width(value: str) -> int:
    return len(value.expandtabs(4))


def attrs(header: str) -> dict[str, str]:
    result = {}
    for match in ATTR.finditer(header):
        value = match.group(2)
        result[match.group(1)] = value[1:-1] if value.startswith('"') else value
    return result


def extract_godot(root: Path | str, inventory: list[str]) -> dict:
    root = Path(root).resolve()
    existing = sorted({p.replace("\\", "/") for p in inventory if safe_source(p) and (root / p).is_file()})
    ids = file_id_map(existing)
    source_paths = [p for p in existing if PurePosixPath(p).suffix.lower() in GODOT_EXTENSIONS]
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    seen_edges: set[tuple] = set()
    diagnostics: dict[str, list] = defaultdict(list)
    text_by_file: dict[str, str] = {}
    uid_files: dict[str, list[str]] = defaultdict(list)
    global_classes: dict[str, list[tuple[str, str]]] = defaultdict(list)
    classes_by_file: dict[str, list[dict]] = defaultdict(list)
    functions_by_file: dict[str, list[dict]] = defaultdict(list)
    signals_by_file: dict[str, list[dict]] = defaultdict(list)
    properties_by_file: dict[str, list[dict]] = defaultdict(list)
    preload_aliases: dict[str, dict[str, str]] = defaultdict(dict)

    def node(nid: str, label: str, path: str | None, line: int = 1, kind: str = "file", **extra) -> str:
        new = {"id": nid, "label": label, "file_type": "concept" if path is None else "code", "source_file": path, "source_location": f"L{line}", "kind": kind, "extractor": "godot_lexical_structural", **extra}
        identity = (path, kind, label, f"L{line}")
        old_identity = tuple(nodes[nid].get(k) for k in ("source_file", "kind", "label", "source_location")) if nid in nodes else None
        if nid in nodes and old_identity != identity:
            original = nid
            nid += "_" + normalize(kind)
            if nid in nodes and tuple(nodes[nid].get(k) for k in ("source_file", "kind", "label", "source_location")) != identity:
                nid += "_" + hashlib.sha256(repr(identity).encode()).hexdigest()[:8]
            diagnostics["resolved_symbol_id_collisions"].append({"id": original, "new_id": nid, "old": nodes[original].get("source_file"), "new": path})
            new["id"] = nid
        nodes.setdefault(nid, new)
        return nid

    def file_node(path: str, *, unresolved: bool = False, reason: str | None = None) -> str:
        nid = ids.get(path, normalize(str(PurePosixPath(path).with_suffix(""))))
        if path not in ids and nid in nodes and nodes[nid].get("source_file") != path:
            nid += "_" + normalize(PurePosixPath(path).suffix.lstrip("."))
        return node(nid, PurePosixPath(path).name, path, unresolved=unresolved, **({"unresolved_reason": reason} if reason else {}))

    def edge(source: str, target: str, relation: str, path: str, line: int, context: str, *, confidence: str = "EXTRACTED", **extra):
        key = (source, target, relation, path, line, context)
        if key in seen_edges:
            return
        seen_edges.add(key)
        edges.append({"source": source, "target": target, "relation": relation, "source_file": path, "source_location": f"L{line}", "confidence": confidence, "confidence_score": 1.0 if confidence == "EXTRACTED" else 0.2, "weight": 1.0, "context": context, **extra})

    for path in source_paths:
        try:
            text_by_file[path] = (root / path).read_text(encoding="utf-8-sig")
        except (UnicodeError, OSError) as exc:
            diagnostics["unreadable_files"].append({"file": path, "error": str(exc)})
            continue
        file_node(path)
    # UID resolution is grounded in sidecars and declared resource/scene headers.
    for path in existing:
        if path.endswith((".gd.uid", ".tscn.uid", ".tres.uid", ".gdshader.uid")):
            value = (root / path).read_text(encoding="utf-8-sig").strip()
            if value.startswith("uid://") and (root / path[:-4]).is_file():
                uid_files[value].append(path[:-4])
    for path, text in text_by_file.items():
        header = re.search(r"(?m)^\[gd_(?:scene|resource)\b([^\n]*)\]", text)
        if header and "uid" in attrs(header.group(1)):
            uid_files[attrs(header.group(1))["uid"]].append(path)
    for uid in uid_files:
        uid_files[uid] = sorted(set(uid_files[uid]))

    def resource_target(value: str, source: str, line: int) -> str | None:
        value = value.lstrip("*")
        if value.startswith("uid://"):
            matches = uid_files.get(value, [])
            if len(matches) == 1:
                return file_node(matches[0])
            nid = node("godot_unresolved_" + normalize(value), value, None, 1, "unresolved_uid", unresolved=True, uid=value)
            diagnostics["unresolved_resource_references"].append({"file": source, "line": line, "reference": value, "reason": "UID absent from authored metadata" if not matches else "duplicate UID metadata"})
            return nid
        if not value.startswith("res://"):
            return None
        game_root = next((PurePosixPath(source).parts[:i] for i in range(len(PurePosixPath(source).parts), 0, -1) if (root / PurePosixPath(*PurePosixPath(source).parts[:i]) / "project.godot").is_file()), ("game",))
        rel = str(PurePosixPath(*game_root) / value[6:])
        if ".." in PurePosixPath(rel).parts or not safe_source(rel):
            diagnostics["excluded_resource_references"].append({"file": source, "line": line, "reference": value, "reason": "excluded or sensitive target"})
            return None
        exists = (root / rel).is_file()
        reason = "not an authored file (directory or path prefix)" if (root / rel).is_dir() or value.endswith("/") else "target absent from working tree"
        if not exists:
            diagnostics["unresolved_resource_references"].append({"file": source, "line": line, "reference": value, "target": rel, "reason": reason})
        return file_node(rel, unresolved=not exists, reason=reason if not exists else None)

    # First pass registers declarations across every .gd file before references.
    views = {}
    for path, text in text_by_file.items():
        if not path.endswith(".gd"):
            continue
        code, strings = lexical_view(text)
        views[path] = (code, strings)
        fid = ids[path]
        global_match = re.search(r"(?m)^class_name[ \t]+([A-Za-z_]\w*)", code)
        if global_match:
            name = global_match.group(1)
            cid = node(fid + "_" + symbol_normalize(name), name, path, line_at(text, global_match.start()), "class", global_class=True)
            global_classes[name].append((path, cid))
            classes_by_file[path].append({"id": cid, "name": name, "start": 0, "end": len(code), "indent": -1})
            edge(fid, cid, "declares_class", path, line_at(text, global_match.start()), f"class_name {name}")
        all_lines = [(m.start(), m.group(), indent_width(m.group()) - indent_width(m.group().lstrip())) for m in re.finditer(r"(?m)^.*$", code)]

        def scope_end(start: int, indent: int, skip_until: int = 0) -> int:
            return next((off for off, content, width in all_lines if off > max(start, skip_until) and content.strip() and width <= indent), len(code))

        for match in INNER_CLASS.finditer(code):
            name = match.group(2)
            indent = indent_width(match.group(1))
            parents = [c for c in classes_by_file[path] if c["start"] < match.start() < c["end"] and c["indent"] < indent]
            owner = max(parents, key=lambda c: c["indent"])["id"] if parents else fid
            cid = node(owner + "_" + symbol_normalize(name), name, path, line_at(text, match.start()), "class", global_class=False)
            classes_by_file[path].append({"id": cid, "name": name, "start": match.start(), "end": scope_end(match.start(), indent), "indent": indent, "base": match.group(3)})
            edge(owner, cid, "declares_class", path, line_at(text, match.start()), f"nested class {name}")

        def class_owner(offset: int) -> str:
            possible = [c for c in classes_by_file[path] if c["start"] <= offset < c["end"]]
            return max(possible, key=lambda c: c["indent"])["id"] if possible else fid

        for match in FUNCTION.finditer(code):
            name, indent = match.group(2), indent_width(match.group(1))
            owner = class_owner(match.start())
            method_id = node(owner + "_" + symbol_normalize(name), name, path, line_at(text, match.start()), "function", static=bool(re.match(r"\s*static", match.group())))
            close, depth = match.end(), 1
            while close < len(code) and depth:
                depth += (code[close] == "(") - (code[close] == ")")
                close += 1
            colon = code.find(":", close)
            body_start = colon + 1 if colon >= 0 else close
            functions_by_file[path].append({"id": method_id, "name": name, "owner": owner, "start": match.start(), "end": scope_end(match.start(), indent, body_start), "declaration_end": body_start, "parameters": code[match.end():close - 1], "indent": indent})
            edge(owner, method_id, "contains", path, line_at(text, match.start()), f"method {name}")
        for match in re.finditer(r"(?m)^([ \t]*)signal[ \t]+([A-Za-z_]\w*)", code):
            name = match.group(2)
            owner = class_owner(match.start())
            sid = node(owner + "_signal_" + symbol_normalize(name), name, path, line_at(text, match.start()), "signal")
            signals_by_file[path].append({"id": sid, "name": name, "owner": owner})
            edge(owner, sid, "declares_signal", path, line_at(text, match.start()), f"signal {name}")
        for match in re.finditer(r"(?m)^([ \t]*)(?:@\w+(?:\([^\n]*\))?[ \t]*)*(?:static[ \t]+)?var[ \t]+([A-Za-z_]\w*)", code):
            # Export annotations can occur on preceding lines.
            start_line = code.rfind("\n", 0, max(0, match.start() - 1)) + 1
            previous = code[start_line:match.start()]
            declaration = match.group()
            exported = "@export" in declaration or bool(re.search(r"@export\w*(?:\([^\n]*\))?[ \t]*\n[ \t]*$", previous))
            if exported:
                owner = class_owner(match.start())
                name = match.group(2)
                pid = node(owner + "_export_" + symbol_normalize(name), name, path, line_at(text, match.start()), "exported_property")
                properties_by_file[path].append({"id": pid, "start": match.start(), "end": code.find("\n", match.start())})
                edge(owner, pid, "exports_property", path, line_at(text, match.start()), f"exported var {name}")
        for offset, value in strings:
            prefix = code[max(0, offset - 180):offset]
            alias = re.search(r"\bconst\s+([A-Za-z_]\w*)\s*(?::\s*[A-Za-z_]\w*\s*)?(?::=|=)\s*preload\s*\(\s*$", prefix)
            if alias and RESOURCE_LITERAL.match(value):
                target = resource_target(value, path, line_at(text, offset))
                if target:
                    preload_aliases[path][alias.group(1)] = target

    for name, declarations in global_classes.items():
        if len(declarations) > 1:
            diagnostics["duplicate_global_classes"].append({"class": name, "files": [p for p, _ in declarations]})

    def resolve_type(name: str, path: str, offset: int) -> str | None:
        local = [c for c in classes_by_file[path] if c["name"] == name]
        if len(local) == 1:
            return local[0]["id"]
        if "." in name:
            first, *rest = name.split(".")
            roots = global_classes.get(first, [])
            if len(roots) == 1:
                target_file = roots[0][0]
            elif first in preload_aliases[path]:
                target_file = nodes[preload_aliases[path][first]].get("source_file")
            else:
                target_file = None
            qualified = [c for c in classes_by_file.get(target_file, []) if c["name"] == rest[-1]]
            if len(qualified) == 1:
                return qualified[0]["id"]
        declarations = global_classes.get(name, [])
        return declarations[0][1] if len(declarations) == 1 else None

    for path, (code, strings) in views.items():
        text, fid = text_by_file[path], ids[path]
        classes, methods, signals = classes_by_file[path], functions_by_file[path], signals_by_file[path]

        def owner_at(offset: int) -> tuple[str, str]:
            method = next((f for f in methods if f["start"] <= offset < f["end"]), None)
            if method:
                return method["id"], method["owner"]
            possible = [c for c in classes if c["start"] <= offset < c["end"]]
            cid = max(possible, key=lambda c: c["indent"])["id"] if possible else fid
            return cid, cid

        for match in re.finditer(r"(?m)^([ \t]*)extends[ \t]+([A-Za-z_]\w*(?:\.\w+)*)", code):
            name = match.group(2)
            owner, _ = owner_at(match.start())
            target = resolve_type(name, path, match.start())
            target = target or preload_aliases[path].get(name)
            if target is None:
                known_engine_base = name in ENGINE_BASE_TYPES
                target = node("godot_type_" + normalize(name), name, None, kind="engine_base_type" if known_engine_base else "external_base_type", external=True)
            edge(owner, target, "extends", path, line_at(text, match.start()), f"extends {name}")
        for cls in classes:
            if cls.get("base"):
                base = cls["base"]
                target = resolve_type(base, path, cls["start"]) or preload_aliases[path].get(base) or node("godot_type_" + normalize(base), base, None, kind="engine_base_type" if base in ENGINE_BASE_TYPES else "external_base_type", external=True)
                edge(cls["id"], target, "extends", path, line_at(text, cls["start"]), f"nested class extends {base}")
        for offset, value in strings:
            if RESOURCE_LITERAL.match(value):
                target = resource_target(value, path, line_at(text, offset))
                if target:
                    source, _ = owner_at(offset)
                    prefix = code[max(0, offset - 30):offset]
                    relation = "extends" if re.search(r"\bextends\s*$", prefix) else "preloads" if re.search(r"\bpreload\s*\(\s*$", prefix) else "loads" if re.search(r"\bload\s*\(\s*$", prefix) else "resource_path"
                    edge(source, target, relation, path, line_at(text, offset), value)
        # Exactly written project type references; no unknown short-name binding.
        type_patterns = [r":\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*\[[^\n=]*\])?)", r"->\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*\[[^\n:]*\])?)", r"\b(?:as|is)\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)", r"\b([A-Za-z_]\w*)\s*\.\s*[A-Za-z_]\w*"]
        for pattern in type_patterns:
            for match in re.finditer(pattern, code):
                for name in re.findall(r"\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*", match.group(1)):
                    target = resolve_type(name, path, match.start())
                    source, _ = owner_at(match.start())
                    if target and source != target:
                        edge(source, target, "references_type", path, line_at(text, match.start()), f"explicit project type {name}")
        # Same-class unqualified/self calls, excluding declarations and shadowing.
        for method in methods:
            body = code[method["declaration_end"]:method["end"]]
            # Conservatively suppress names shadowed by any parameter/local binding.
            shadows = set(re.findall(r"\b(?:var|const|for)\s+([A-Za-z_]\w*)", body))
            signature = method["parameters"]
            shadows.update(re.findall(r"(?:^|,)\s*([A-Za-z_]\w*)\s*:", signature))
            same = {f["name"]: f["id"] for f in methods if f["owner"] == method["owner"]}
            for match in re.finditer(r"(?<![\w.])(?:(self)\s*\.\s*)?([A-Za-z_]\w*)\s*\(", body):
                name = match.group(2)
                if name in same and (match.group(1) or name not in shadows):
                    absolute = method["declaration_end"] + match.start()
                    if re.search(r"\b(?:super|func)\s*\.?\s*$", body[max(0, match.start() - 12):match.start()]):
                        continue
                    edge(method["id"], same[name], "calls", path, line_at(text, absolute), f"{method['name']} -> {name} (same script)")
            same_signals = {s["name"]: s["id"] for s in signals if s["owner"] == method["owner"]}
            for match in re.finditer(r"(?<![\w.])(?:self\s*\.\s*)?([A-Za-z_]\w*)\s*\.\s*emit\s*\(", body):
                if match.group(1) in same_signals:
                    edge(method["id"], same_signals[match.group(1)], "emits", path, line_at(text, method["declaration_end"] + match.start()), f"signal {match.group(1)}.emit")
            for match in re.finditer(r"(?<![\w.])(?:self\s*\.\s*)?([A-Za-z_]\w*)\s*\.\s*connect\s*\(\s*(?:self\s*\.\s*)?([A-Za-z_]\w*)\s*(?:[,)])", body):
                if match.group(1) in same_signals and match.group(2) in same:
                    edge(same_signals[match.group(1)], same[match.group(2)], "connects_to", path, line_at(text, method["declaration_end"] + match.start()), f"signal {match.group(1)} -> {match.group(2)}")

    # Scene/resource headers and explicit ExtResource/SubResource references.
    for path, text in text_by_file.items():
        if not path.endswith((".tscn", ".tres")):
            continue
        fid = ids[path]
        headers = list(re.finditer(r"(?m)^\[([A-Za-z_]\w*)\b([^\n]*)\]\s*$", text))
        ext = {}
        subs = {}
        scene_nodes = {}
        attachments = {}
        root_node = None
        sections = []
        for i, match in enumerate(headers):
            kind, fields = match.group(1), attrs(match.group(2))
            line = line_at(text, match.start())
            end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
            if kind == "ext_resource":
                target = resource_target(fields.get("path", fields.get("uid", "")), path, line)
                eid = node(fid + "_extresource_" + normalize(fields.get("id", str(i))), f"ExtResource {fields.get('id', i)}", path, line, "external_resource", resource_type=fields.get("type"))
                ext[fields.get("id", str(i))] = (eid, target)
                edge(fid, eid, "declares_ext_resource", path, line, match.group().strip())
                if target:
                    edge(eid, target, "resource_path", path, line, fields.get("path", fields.get("uid", "")))
                sections.append((match, end, eid, fields))
            elif kind == "sub_resource":
                sid = node(fid + "_subresource_" + normalize(fields.get("id", str(i))), fields.get("id", f"SubResource {i}"), path, line, "subresource", resource_type=fields.get("type"))
                subs[fields.get("id", str(i))] = sid
                edge(fid, sid, "contains_subresource", path, line, match.group().strip())
                sections.append((match, end, sid, fields))
            elif kind == "node":
                name, parent = fields.get("name", f"node{i}"), fields.get("parent")
                scene_path = "." if parent is None else name if parent == "." else parent.rstrip("/") + "/" + name
                # Root name and a child with the same name are distinct paths.
                node_suffix = "_node_root_" + symbol_normalize(name) if parent is None else "_node_path_" + symbol_normalize(scene_path)
                nid = node(fid + node_suffix, name, path, line, "scene_node", node_type=fields.get("type"), scene_node_path=scene_path)
                scene_nodes[scene_path] = nid
                if parent is None:
                    root_node = nid
                    edge(fid, nid, "scene_root", path, line, name)
                sections.append((match, end, nid, fields))
            elif kind == "resource":
                sections.append((match, end, fid, fields))
        for match, end, source, fields in sections:
            line = line_at(text, match.start())
            if match.group(1) == "node":
                parent = fields.get("parent")
                if parent is not None and parent in scene_nodes:
                    edge(scene_nodes[parent], source, "parent_of", path, line, f"parent={parent}")
                elif parent is not None:
                    diagnostics["unresolved_scene_parents"].append({"file": path, "line": line, "parent": parent})
            body_start = match.end()
            body = text[body_start:end]
            for chunk, offset in [(match.group(2), match.start(2)), (body, body_start)]:
                for ref in re.finditer(r'(ExtResource|SubResource)\(\s*"([^"\n]+)"\s*\)', chunk):
                    resource_kind, rid = ref.groups()
                    target = ext.get(rid, (None, None))[0] if resource_kind == "ExtResource" else subs.get(rid)
                    ref_line = line_at(text, offset + ref.start())
                    if target:
                        before = chunk[:ref.start()].split("\n")[-1].strip()
                        relation = "script_attachment" if re.search(r"\bscript\s*=\s*$", before) else "instances_scene" if re.search(r"\binstance\s*=\s*$", before) else "uses_resource"
                        edge(source, target, relation, path, ref_line, f"{before}{resource_kind}({rid})")
                        if relation == "script_attachment" and resource_kind == "ExtResource" and ext[rid][1]:
                            attached_target = nodes[ext[rid][1]].get("source_file")
                            attachments[source] = attached_target
                    else:
                        diagnostics["unresolved_local_resource_ids"].append({"file": path, "line": ref_line, "kind": resource_kind, "id": rid})
        for match in headers:
            if match.group(1) != "connection":
                continue
            fields, line = attrs(match.group(2)), line_at(text, match.start())
            cid = node(fid + "_connection_" + str(line), f"{fields.get('signal', '?')} -> {fields.get('method', '?')}", path, line, "signal_connection")
            edge(fid, cid, "declares_connection", path, line, match.group().strip())
            source = scene_nodes.get(fields.get("from", "."))
            target = scene_nodes.get(fields.get("to", "."))
            if source:
                edge(source, cid, "signal_source", path, line, fields.get("signal", ""))
            if target:
                edge(cid, target, "signal_target", path, line, fields.get("method", ""))
                script = attachments.get(target)
                matches = [f for f in functions_by_file.get(script, []) if f["name"] == fields.get("method") and f["indent"] == 0]
                if len(matches) == 1:
                    edge(cid, matches[0]["id"], "connects_to", path, line, fields["method"])
                else:
                    diagnostics["scene_connections_without_local_method_resolution"].append({"file": path, "line": line, "method": fields.get("method"), "script": script})
            else:
                diagnostics["unresolved_scene_connection_endpoints"].append({"file": path, "line": line, "target": fields.get("to")})

    for path, text in text_by_file.items():
        fid = ids[path]
        if path.endswith((".cfg", ".godot")):
            section = ""
            for line, content in enumerate(text.splitlines(), 1):
                stripped = content.strip()
                if stripped.startswith((";", "#")):
                    continue
                if stripped.startswith("[") and stripped.endswith("]"):
                    section = stripped[1:-1]
                    continue
                assignment = re.match(r"([^=]+?)\s*=\s*(.*)", stripped)
                if not assignment:
                    continue
                key, value = assignment.group(1).strip(), assignment.group(2)
                _, strings = lexical_view(value, semicolon_comments=True)
                resource_values = [s for _, s in strings if RESOURCE_LITERAL.match(s)]
                if section == "plugin" and key == "script":
                    for _, value_string in strings:
                        if value_string.endswith(".gd") and "://" not in value_string:
                            target_path = str(PurePosixPath(path).parent / value_string)
                            if safe_source(target_path):
                                edge(fid, file_node(target_path, unresolved=not (root / target_path).is_file()), "plugin_script", path, line, f"plugin/script={value_string}")
                for resource_value in resource_values:
                    target = resource_target(resource_value, path, line)
                    if not target:
                        continue
                    setting_id = node(fid + "_setting_" + normalize(section + "_" + key), f"{section}/{key}", path, line, "project_setting")
                    edge(fid, setting_id, "declares_setting", path, line, f"[{section}] {key}")
                    relation = "autoloads" if section == "autoload" else "main_scene" if section == "application" and key == "run/main_scene" else "enables_plugin" if section == "editor_plugins" and key == "enabled" else "resource_path"
                    edge(setting_id, target, relation, path, line, resource_value)
        elif path.endswith(".gdshader"):
            code, strings = lexical_view(text, shader=True)
            for match in re.finditer(r"(?m)^\s*(?:void|float|int|bool|vec[234]|mat[234])\s+([A-Za-z_]\w*)\s*\(", code):
                sid = node(fid + "_" + symbol_normalize(match.group(1)), match.group(1), path, line_at(text, match.start()), "shader_function")
                edge(fid, sid, "contains", path, line_at(text, match.start()), f"shader function {match.group(1)}")
            for match in re.finditer(r"\buniform\s+\w+\s+([A-Za-z_]\w*)", code):
                sid = node(fid + "_uniform_" + symbol_normalize(match.group(1)), match.group(1), path, line_at(text, match.start()), "shader_uniform")
                edge(fid, sid, "declares_uniform", path, line_at(text, match.start()), match.group(1))
            for offset, value in strings:
                if RESOURCE_LITERAL.match(value):
                    target = resource_target(value, path, line_at(text, offset))
                    if target:
                        edge(fid, target, "resource_path", path, line_at(text, offset), value)

    dangling = [e for e in edges if e["source"] not in nodes or e["target"] not in nodes]
    diagnostics["dangling_edges"] = dangling
    structural_selfloops = [e for e in edges if e["source"] == e["target"] and e["relation"] != "calls"]
    diagnostics["structural_self_loop_edges"] = structural_selfloops
    statistics = {
        "inventory_files": len(existing), "godot_source_files": len(source_paths), "readable_godot_files": len(text_by_file),
        "source_files_by_extension": dict(Counter(PurePosixPath(p).suffix for p in source_paths)),
        "nodes": len(nodes), "edges": len(edges), "node_kinds": dict(Counter(n["kind"] for n in nodes.values())),
        "edge_relations": dict(Counter(e["relation"] for e in edges)), "uids_resolved_from_authored_metadata": len(uid_files),
        "diagnostic_counts": {k: len(v) for k, v in diagnostics.items()},
        "unresolved_nodes": sum(bool(n.get("unresolved")) for n in nodes.values()),
        "file_id_collision_groups": sum(1 for count in Counter(normalize(str(PurePosixPath(p).with_suffix(""))) for p in existing).values() if count > 1),
        "self_loop_edges_by_relation": dict(Counter(e["relation"] for e in edges if e["source"] == e["target"])),
    }
    return {"nodes": sorted(nodes.values(), key=lambda n: n["id"]), "edges": sorted(edges, key=lambda e: (e["source_file"], e["source_location"], e["source"], e["target"], e["relation"], e["context"])), "hyperedges": [], "input_tokens": 0, "output_tokens": 0, "file_ids": ids, "statistics": statistics, "diagnostics": dict(diagnostics), "limitations": ["Lexical/structural extraction, not a complete GDScript AST or runtime trace.", "Only unqualified/self-qualified same-class function calls are resolved; dynamic/member receivers and inherited calls are omitted.", "Exact project class type references require a unique declaration; preload aliases retain file links without invented call bindings.", "Computed resource paths, runtime-created Control hierarchies, inherited scene expansions and user:// state are not resolved.", "Absent resource literals can be path prefixes or test cases, rather than broken runtime dependencies.", "UID resolution uses authored sidecars and scene/resource headers, never the generated Godot cache."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--output", default="graphify-out/.graphify_godot.json")
    args = parser.parse_args()
    project_root = Path(args.root).resolve()
    result = extract_godot(project_root, git_inventory(project_root))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result["statistics"], indent=2, ensure_ascii=False))
