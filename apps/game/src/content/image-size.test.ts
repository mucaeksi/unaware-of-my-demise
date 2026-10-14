import { expect, it } from 'vitest';
import { imageSize } from './image-size';
it('bounds decoded texture dimensions before the decoder, including invalid headers and decompression bombs', () => {
  const png = new Uint8Array(24); const v = new DataView(png.buffer); v.setUint32(0, 0x89504e47); png.set(new TextEncoder().encode('IHDR'), 12); v.setUint32(16, 1920); v.setUint32(20, 1080);
  expect(imageSize('art/test.png', png)).toEqual({ width: 1920, height: 1080 });
  v.setUint32(16, 65000); expect(() => imageSize('art/test.png', png)).toThrow('budget');
  expect(() => imageSize('art/test.webp', new Uint8Array(40))).toThrow('invalid');
  expect(imageSize('audio/test.ogg', new Uint8Array(0))).toBeUndefined();
});
