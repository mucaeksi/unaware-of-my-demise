"""Import reviewed local downloads as export-excluded 2D references with provenance.

Run after fetching the pinned sources described in the collection manifest.
Existing altered assets are preserved by refusing to overwrite different bytes.
"""
from __future__ import annotations
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'build/free-2d-review-20261008'
DEST = ROOT / 'game/assets/third_party/reference'
REF = ROOT / 'references/free_2d/upstream'
packs = []

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def copy(source, destination):
    if destination.exists():
        if sha(source) != sha(destination):
            raise RuntimeError(f'Preserving altered local reference: {destination}')
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)

def commit(folder):
    return subprocess.check_output(['git', '-C', str(folder), 'rev-parse', 'HEAD'], text=True).strip()

def add(slug, source, files, url, license_file, license_id, version, download=None):
    records = []
    for path in sorted(files):
        relative = path.relative_to(source).as_posix()
        if path.suffix == '.gdshader' and 'shader_type canvas_item' not in path.read_text(encoding='utf-8'):
            raise RuntimeError(f'Non-2D shader refused: {path}')
        copy(path, DEST / slug / relative)
        records.append({'path': relative, 'sha256': sha(path), 'bytes': path.stat().st_size,
                        **({'author': path.relative_to(source).parts[0]} if slug == 'game-icons' else {})})
    copy(license_file, DEST / slug / 'LICENSE.txt')
    pack = {'id': slug, 'source': url, 'version': version, 'license': license_id,
            'status': 'REFERENCE_ONLY_EXPORT_EXCLUDED', 'asset_count': len(records),
            'files': records, 'license_sha256': sha(license_file)}
    if download:
        pack['download'] = download
    packs.append(pack)

particle = STAGE / 'kenney-particle-pack'
add('kenney-particles', particle / 'addons/kenney_particle_pack', (particle / 'addons/kenney_particle_pack').glob('*.png'),
    'https://github.com/Calinou/kenney-particle-pack', particle / 'LICENSE.txt', 'CC0-1.0', commit(particle))
zip_packs = [
    ('kenney-smoke', 'https://kenney.nl/assets/smoke-particles', ['PNG'], 'smoke-particles.zip', 'https://kenney.nl/media/pages/assets/smoke-particles/23249a0d35-1677695171/kenney_smoke-particles.zip'),
    ('kenney-light', 'https://kenney.nl/assets/light-masks', ['Default', 'Inverted', 'Transparent'], 'light-masks.zip', 'https://kenney.nl/media/pages/assets/light-masks/6530e254f9-1775631687/kenney_light-masks-1.0.zip'),
    ('kenney-ui-adventure', 'https://kenney.nl/assets/ui-pack-adventure', ['PNG'], 'ui-adventure.zip', 'https://kenney.nl/media/pages/assets/ui-pack-adventure/9a877376bc-1723597274/kenney_ui-pack-adventure.zip'),
    ('kenney-fantasy-borders', 'https://kenney.nl/assets/fantasy-ui-borders', ['PNG', 'Vector'], 'fantasy-ui-borders.zip', 'https://kenney.nl/media/pages/assets/fantasy-ui-borders/ab29cd0165-1701602367/kenney_fantasy-ui-borders.zip'),
]
for slug, url, directories, archive, download in zip_packs:
    folder = STAGE / slug
    license_file = next(p for p in folder.iterdir() if p.name.lower() == 'license.txt')
    files = [p for directory in directories for p in (folder / directory).rglob('*') if p.suffix.lower() in {'.png', '.svg'}]
    add(slug, folder, files, url, license_file, 'CC0-1.0', sha(STAGE / 'downloads' / archive), download)

demos = STAGE / 'godot-demos'
add('godot-sprite-shaders', demos / '2d/sprite_shaders/shaders', (demos / '2d/sprite_shaders/shaders').glob('*.gdshader'),
    'https://github.com/godotengine/godot-demo-projects/tree/master/2d/sprite_shaders', demos / 'LICENSE.md', 'MIT', commit(demos))
library = STAGE / 'godot-vfx-library'
add('godot-vfx-shaders', library / 'addons/vfx_library/shaders', (library / 'addons/vfx_library/shaders').glob('*.gdshader'),
    'https://github.com/haowg/GODOT-VFX-LIBRARY', library / 'LICENSE', 'MIT', commit(library))

icons = STAGE / 'game-icons'
weapon_fx = re.compile(r'(sword|blade|dagger|spear|halberd|saber|katana|scimitar|shield|axe|quiver|crossbow|warhammer|mace|flail|trident|wand|staff|magic|spell|rune|lightning|fireball|flame|spark|explosion|shockwave|aura|whirlwind|vortex|ice-spikes|ice-shield|crystal-wand)', re.I)
add('game-icons', icons, [p for p in icons.rglob('*.svg') if weapon_fx.search(p.stem) and not any(word in p.stem for word in ['skull', 'dragon', 'human', 'woman', 'man-', 'face', 'heart'])],
    'https://github.com/game-icons/icons', icons / 'license.txt', 'CC-BY-3.0 (author-specific CC0 exceptions)', commit(icons))

# Original typed/untyped demo architecture stays outside the strict main project.
for source, target in [(library, REF / 'godot-vfx-library'), (demos / '2d/sprite_shaders', REF / 'godot-sprite-shaders'), (demos / '2d/particles', REF / 'godot-2d-particles')]:
    for path in source.rglob('*'):
        if path.is_file() and not any(part in {'.git', '.godot'} for part in path.relative_to(source).parts) and path.suffix != '.import':
            copy(path, target / path.relative_to(source))
for slug in ['godot-sprite-shaders', 'godot-2d-particles']:
    copy(demos / 'LICENSE.md', REF / slug / 'LICENSE.md')
packs.append({'id': 'godot-2d-particles', 'source': 'https://github.com/godotengine/godot-demo-projects/tree/master/2d/particles',
              'version': commit(demos), 'license': 'MIT', 'status': 'SEPARATE_REFERENCE_PROJECT',
              'scene_count': len(list((REF / 'godot-2d-particles').rglob('*.tscn')))})
DEST.mkdir(parents=True, exist_ok=True)
manifest = {'reviewed': '2026-10-08', 'scope': '2D resources only; no character/chibi packs or active plugins', 'packs': packs}
(DEST / 'COLLECTION.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({'packs': len(packs), 'assets': sum(p.get('asset_count', 0) for p in packs), 'counts': {p['id']: p.get('asset_count', p.get('scene_count')) for p in packs}}))
