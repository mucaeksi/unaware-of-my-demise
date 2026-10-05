#!/usr/bin/env python3
"""Original geometric UI glyphs and 9-slice ornament. Reads or edits no old image.
Source SVGs and identical runtime copies are written together.
"""
from pathlib import Path
import shutil

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[3]
RUNTIME = ROOT / 'game/assets/ui/gothic/v02'
GLYPHS = {
    'back': '<path d="M39 14 21 32l18 18M22 32h29"/>',
    'close': '<path d="m18 18 28 28m0-28L18 46"/>',
    'chevron': '<path d="m24 15 17 17-17 17"/>',
    'check': '<path d="m14 33 12 12 24-28"/>',
    'help': '<path d="M23 23a9 9 0 1 1 15 7c-4 3-6 4-6 9M32 46v1"/><path d="M32 6 56 20v24L32 58 8 44V20Z"/>',
    'settings': '<path d="M26 6h12l2 7 7 4 7-2 6 10-5 5v8l5 5-6 10-7-2-7 4-2 7H26l-2-7-7-4-7 2-6-10 5-5v-8l-5-5 6-10 7 2 7-4Z"/><circle cx="32" cy="34" r="9"/>',
    'home': '<path d="m10 31 22-21 22 21M16 26v29h32V26M26 55V38l6-6 6 6v17"/>',
    'journey': '<path d="M12 52V13h30l10 9v30H12Zm0-39 10 9v30m0-30h30M29 42l8-10 8 3"/>',
    'companions': '<circle cx="25" cy="22" r="8"/><path d="M10 52v-7c0-10 30-10 30 0v7M41 13a8 8 0 0 1 0 16m6 8c6 1 8 4 8 8v7"/>',
    'summon': '<path d="M32 6 42 25l16 7-16 7-10 19-10-19-16-7 16-7Z"/><path d="M32 19v26M20 32h24"/>',
    'records': '<path d="M8 14h17l7 5 7-5h17v37H39l-7 5-7-5H8Zm24 5v37M15 25h9m-9 9h9m-9 9h9m16-18h9m-9 9h9m-9 9h9"/>',
    'lock': '<rect x="13" y="28" width="38" height="27" rx="3"/><path d="M21 28V17a11 11 0 0 1 22 0v11M32 39v7"/>',
    'waiting': '<path d="M16 9h32M16 55h32M20 9c0 14 3 16 12 23-9 7-12 9-12 23m24-46c0 14-3 16-12 23 9 7 12 9 12 23M26 19h12m-6 26 6 5H26Z"/>',
    'unchecked': '<rect x="10" y="10" width="44" height="44" rx="4"/>',
    'checked': '<rect x="10" y="10" width="44" height="44" rx="4"/><path d="m19 32 9 9 18-19"/>',
}


def publish(relative, text):
    source = SOURCE / relative
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_text(text + '\n')
    target = RUNTIME / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


for name, geometry in GLYPHS.items():
    publish(f'icons/{name}.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="none" stroke="#b7bec9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + geometry + '</g></svg>')

publish('panel_frame.svg', '''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<rect x="1" y="1" width="254" height="254" rx="7" fill="#15181f" stroke="#45403e" stroke-width="2"/>
<rect x="7" y="7" width="242" height="242" rx="3" fill="none" stroke="#8c755f" stroke-width="1.5"/>
<g fill="#15181f" stroke="#b59a76" stroke-width="1.5"><path d="m14 4 10 10-10 10L4 14Z"/><path d="m242 4 10 10-10 10-10-10Z"/><path d="m14 232 10 10-10 10-10-10Z"/><path d="m242 232 10 10-10 10-10-10Z"/></g>
<g fill="#b59a76"><path d="m14 10 4 4-4 4-4-4Z"/><path d="m242 10 4 4-4 4-4-4Z"/><path d="m14 238 4 4-4 4-4-4Z"/><path d="m242 238 4 4-4 4-4-4Z"/></g>
</svg>''')
print(f'{len(GLYPHS)} original SVG glyphs + one 9-slice frame: source/runtime copies written')
