import { expect, it } from 'vitest';
import { crc32 } from './hash';

it('matches external IEEE CRC32 UTF-8 vectors used by canonical loan equipment', () => {
  expect(crc32('')).toBe(0);
  expect(crc32('123456789')).toBe(3421780262);
  expect(crc32('Türkçe')).toBe(82911232);
  expect(crc32('brin_alder:1-2:accessory_ash_maw_hide_necklace_3')).toBe(3832719240);
});
