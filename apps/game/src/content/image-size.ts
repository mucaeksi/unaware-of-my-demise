/** Dimensions are checked before handing downloaded images to a decoder/GPU. */
export function imageSize(path: string, bytes: Uint8Array): { width: number; height: number } | undefined {
  if (!/\.(png|webp)$/.test(path)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0; let height = 0;
  const ascii = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  if (path.endsWith('.png') && bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && ascii(12, 4) === 'IHDR') { width = view.getUint32(16); height = view.getUint32(20); }
  else if (path.endsWith('.webp') && bytes.length >= 25 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    if (ascii(12, 4) === 'VP8X' && bytes.length >= 30) { width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16); height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16); }
    else if (bytes.length >= 30 && ascii(12, 4) === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) { width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff; }
    else if (ascii(12, 4) === 'VP8L' && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; }
  }
  if (width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 16_777_216) throw new Error('Image dimensions are invalid or exceed the supported texture budget');
  return { width, height };
}
