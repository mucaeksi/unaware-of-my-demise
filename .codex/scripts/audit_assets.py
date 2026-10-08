"""Read-only asset inventory. Measurements do not imply visual/production approval."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import struct

FORMATS = {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.ogg', '.wav', '.mp3', '.gdshader'}

def inspect_png(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n' or len(data) < 33:
        return {'error': 'Invalid/truncated PNG header'}
    if data[8:16] != b'\x00\x00\x00\rIHDR':
        return {'error': 'Invalid PNG IHDR chunk'}
    width, height, depth, color = struct.unpack('>IIBB', data[16:26])
    if not width or not height:
        return {'error': 'Invalid zero-size PNG'}
    has_alpha = color in (4, 6)
    offset = 8
    found_end = False
    while offset + 12 <= len(data):
        size = struct.unpack('>I', data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        if offset + size + 12 > len(data):
            return {'error': 'Truncated PNG chunk'}
        if kind == b'tRNS':
            has_alpha = True
        if kind == b'IEND':
            found_end = True
            break
        offset += size + 12
    if not found_end:
        return {'error': 'Missing PNG IEND chunk'}
    return {'width': width, 'height': height, 'bit_depth': depth,
            'alpha_channel_or_transparency': has_alpha,
            'decode_status': 'header/chunks inspected; full pixel decoding not assessed'}

def audit(root):
    records = []
    duplicates = collections.defaultdict(list)
    for p in sorted(root.rglob('*')):
        if not p.is_file() or p.suffix.lower() not in FORMATS or '.godot' in p.parts:
            continue
        data = p.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        record = {'path': p.relative_to(root).as_posix(), 'bytes': len(data),
                  'format': p.suffix.lower().lstrip('.'), 'sha256': digest}
        if p.suffix.lower() == '.png':
            record.update(inspect_png(data))
        records.append(record)
        duplicates[digest].append(record['path'])
    return {'root': str(root), 'files': records,
            'duplicates': [v for v in duplicates.values() if len(v) > 1],
            'limits': 'No writes, full decoding, canon/licensing approval, orphan verdict or mobile performance certification.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--output', type=Path, help='Optional JSON report destination; originals are never changed.')
    args = parser.parse_args()
    root = args.root.resolve(strict=True)
    if not root.is_dir():
        parser.error('root must be a directory')
    result = audit(root)
    if args.output:
        output = args.output.resolve()
        if output.is_relative_to(root):
            parser.error('report must be outside the audited asset directory')
        if output.exists():
            parser.error('report exists; choose a new destination to preserve it')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f"Measured {len(result['files'])} assets; duplicate groups: {len(result['duplicates'])}; report: {output}")
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
