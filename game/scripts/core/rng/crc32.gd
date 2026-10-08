class_name Crc32
extends RefCounted
## `zlib.crc32` (IEEE 802.3, reflected polynomial 0xEDB88320), unsigned 32-bit result.
##
## Used to derive deterministic seeds (story loan accessories: crc32 of "<character>:<stage>:<accessory>" as UTF-8).
## Fixtures: parity/fixtures/crc32.json.

const _POLYNOMIAL: int = 0xEDB88320
const _MASK32: int = 0xFFFFFFFF

static var _table: PackedInt64Array = PackedInt64Array()


static func _ensure_table() -> void:
	if not _table.is_empty():
		return
	_table.resize(256)
	for index: int in range(256):
		var value: int = index
		for _bit: int in range(8):
			value = ((value >> 1) ^ _POLYNOMIAL) if (value & 1) != 0 else (value >> 1)
		_table[index] = value


## crc32 of raw bytes, optionally continuing from a previous result (`zlib.crc32(data, value)`).
static func of_bytes(data: PackedByteArray, start: int = 0) -> int:
	_ensure_table()
	var crc: int = (start & _MASK32) ^ _MASK32
	for byte: int in data:
		crc = _table[(crc ^ byte) & 0xFF] ^ (crc >> 8)
	return (crc ^ _MASK32) & _MASK32


## crc32 of the UTF-8 encoding of `text`.
static func of_text(text: String) -> int:
	return of_bytes(text.to_utf8_buffer())
