// `zlib.crc32` (IEEE 802.3, reflected polynomial 0xEDB88320), unsigned 32-bit (port of core/rng/crc32.gd).
// Derives deterministic seeds, e.g. story-loan accessories: crc32 of "<character>:<stage>:<accessory>" as UTF-8.

const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

/** crc32 of raw bytes, optionally continuing from a previous result (`zlib.crc32(data, value)`). */
export function crc32Bytes(data: Uint8Array, start = 0): number {
  let crc = (start ^ 0xffffffff) >>> 0;
  for (const byte of data) crc = (TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

/** crc32 of the UTF-8 encoding of `text`. */
export const crc32Text = (text: string): number => crc32Bytes(new TextEncoder().encode(text));
