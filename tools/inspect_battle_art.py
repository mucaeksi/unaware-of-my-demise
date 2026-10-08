"""Read-only PNG/pose QA. Does not modify or render image assets.

Reports alpha bounds and ground-anchor candidates for the runtime manifest.
Run using the bundled workspace Python (Pillow is already provided there).
"""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATES = ["idle", "walk", "basic", "active", "ultimate", "hit", "defeat", "victory"]

def inspect(manifest: Path) -> dict:
    data = json.loads(manifest.read_text(encoding="utf-8-sig"))
    report = {"manifest": str(manifest.relative_to(ROOT)), "actors": {}}
    for actor, spec in data["actors"].items():
        poses = {}
        for state in STATES:
            separate = spec.get("pose_files", {}).get(state)
            resource = separate or spec["atlas"]
            source = ROOT / "game" / resource.removeprefix("res://")
            with Image.open(source) as image:
                cols, rows = spec["columns"], spec["rows"]
                index = spec.get("pose_indices", {}).get(state, STATES.index(state))
                cw, ch = image.width / cols, image.height / rows
                region = [index % cols * cw, index // cols * ch, cw, ch]
                if "regions" in spec:
                    region = spec["regions"][index]
                if separate:
                    region = [0, 0, image.width, image.height]
                x, y, w, h = region
                pixels = image.load()
                xs, ys = [], []
                for py in range(round(y), min(image.height, round(y + h))):
                    for px in range(round(x), min(image.width, round(x + w))):
                        if image.mode == "RGBA" and pixels[px, py][3] > 32:
                            xs.append(px - x)
                            ys.append(py - y)
                bounds = [min(xs), min(ys), max(xs) + 1, max(ys) + 1] if xs else None
                foot = spec.get("foot_y_by_state", {}).get(state, spec.get("foot_y", 0.88))
                poses[state] = {
                    "source": resource, "source_size": list(image.size), "mode": image.mode,
                    "region": region, "alpha_bounds": bounds,
                    "ground_candidate_y": round(bounds[3] / h, 5) if bounds else None,
                    "authored_foot_y": foot,
                    "ground_error_at_250px": round((bounds[3] / h - foot) * 250, 2) if bounds else None,
                    "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                }
        report["actors"][actor] = poses
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = inspect(ROOT / "game/data/presentation/battle_art_v001.json")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({actor: {state: pose["ground_error_at_250px"] for state, pose in poses.items()} for actor, poses in result["actors"].items()}))
