"""Prove a clean source extraction rebuild carries the same runtime files/content."""
import argparse
import hashlib
import json
from pathlib import Path
from pck_inventory import read_pack, integrity_problems

def scene_paths(original: Path) -> list[str]:
    return sorted(e.path[:-6] for e in read_pack(original).entries if e.path.endswith('.tscn.remap'))

def compare(original: Path, rebuilt: Path, original_scenes: Path | None = None, rebuilt_scenes: Path | None = None) -> dict:
    first, second = read_pack(original), read_pack(rebuilt)
    for pack in (first, second):
        if integrity_problems(pack):
            raise ValueError('PCK integrity failed')
    left = {e.path: e for e in first.entries}
    right = {e.path: e for e in second.entries}
    if left.keys() != right.keys():
        raise ValueError('Rebuild inventory differs: ' + ', '.join(sorted(left.keys() ^ right.keys())))
    # project.binary intentionally loses editor helpers. UID/class caches are regenerated.
    generated = {'project.binary', '.godot/uid_cache.bin', '.godot/global_script_class_cache.cfg'}
    # Scene conversion assigns fresh internal IDs on clean import. Compare loaded
    # SceneState properties/connections instead; scripts and imported art stay exact.
    converted_scenes = {p for p in left if p.endswith('.scn') and p.startswith('.godot/exported/')}
    expected_scenes = scene_paths(original)
    if not original_scenes or not rebuilt_scenes:
        raise ValueError('Both real-runtime scene inspection reports are required')
    old_scenes = json.loads(original_scenes.read_text(encoding='utf-8'))
    new_scenes = json.loads(rebuilt_scenes.read_text(encoding='utf-8'))
    if sorted(old_scenes) != expected_scenes or sorted(new_scenes) != expected_scenes or old_scenes != new_scenes:
        raise ValueError('Loaded scene properties/connections differ or inspection is incomplete')
    differing = [p for p in left if p not in generated | converted_scenes and hashlib.sha256(first.content(left[p])).digest() != hashlib.sha256(second.content(right[p])).digest()]
    if differing:
        raise ValueError('Rebuild runtime content differs: ' + ', '.join(sorted(differing)))
    return {'status':'passed', 'entries':len(left), 'identical_runtime_entries':len(left) - len(left.keys() & (generated | converted_scenes)), 'scenes_semantically_equal':len(expected_scenes), 'regenerated_configuration':sorted(left.keys() & generated)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('original', type=Path)
    parser.add_argument('rebuilt', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--write-scene-list', type=Path)
    parser.add_argument('--original-scenes', type=Path)
    parser.add_argument('--rebuilt-scenes', type=Path)
    args = parser.parse_args()
    if args.write_scene_list:
        args.write_scene_list.write_text(json.dumps(scene_paths(args.original)), encoding='utf-8')
        raise SystemExit(0)
    report = compare(args.original, args.rebuilt, args.original_scenes, args.rebuilt_scenes)
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))
