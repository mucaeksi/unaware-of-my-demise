import { describe, expect, it } from 'vitest';
import type { ManifestFile } from '@uomd/content-schema';
import { ApiRemote } from './remote';
const file: ManifestFile = { path: 'audio/test.ogg', sha256: 'a'.repeat(64), bytes: 5, kind: 'audio', media_type: 'audio/ogg' };
describe('verified object transport', () => {
  it('resumes the exact signed range and restarts safely when a server ignores Range', async () => {
    for (const status of [200, 206]) {
      const remote = new ApiRemote('', async (_url, init) => {
        expect(new Headers(init?.headers).get('Range')).toBe('bytes=2-');
        return new Response(new Uint8Array(status === 206 ? [3, 4, 5] : [1, 2, 3, 4, 5]), { status, headers: status === 206 ? { 'Content-Range': 'bytes 2-4/5' } : {} });
      });
      expect(await remote.fetchObject(file.sha256, file, undefined, { partial: new Uint8Array([1, 2]) })).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    }
  });
  it('refuses a misleading range and an oversized body before writing beyond the signed allocation', async () => {
    const wrong = new ApiRemote('', async () => new Response(new Uint8Array([3, 4, 5]), { status: 206, headers: { 'Content-Range': 'bytes 0-2/3' } }));
    await expect(wrong.fetchObject(file.sha256, file, undefined, { partial: new Uint8Array([1, 2]) })).rejects.toThrow('signed size');
    const oversized = new ApiRemote('', async () => new Response(new Uint8Array(6)));
    await expect(oversized.fetchObject(file.sha256, file)).rejects.toThrow('larger');
  });
  it('persists bounded prefixes while streaming and forwards the abort signal', async () => {
    const signal = new AbortController().signal; const total = 3 * 1024 * 1024; const saved: number[] = [];
    const remote = new ApiRemote('', async (_url, init) => {
      expect(init?.signal).toBe(signal);
      return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < 3; i++) controller.enqueue(new Uint8Array(1024 * 1024).fill(i)); controller.close(); } }));
    });
    const data = await remote.fetchObject(file.sha256, { ...file, bytes: total }, undefined, { signal, onPartial: async (bytes) => { saved.push(bytes.length); } });
    expect(saved).toEqual([1024 * 1024, 2 * 1024 * 1024]); expect(data.length).toBe(total);
  });
});
