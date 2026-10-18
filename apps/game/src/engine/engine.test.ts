import { describe, expect, it } from 'vitest';
import Phaser from './index';

const { parseFontStyle } = Phaser;

describe('PIXI engine shim', () => {
  it('maps Phaser font style strings onto PIXI style + weight', () => {
    expect(parseFontStyle('700')).toEqual({ fontStyle: 'normal', fontWeight: '700' });
    expect(parseFontStyle('italic 500')).toEqual({ fontStyle: 'italic', fontWeight: '500' });
    expect(parseFontStyle('bold')).toEqual({ fontStyle: 'normal', fontWeight: 'bold' });
    expect(parseFontStyle(undefined)).toEqual({ fontStyle: 'normal', fontWeight: 'normal' });
  });

  it('records Graphics calls as self-contained ops and bumps the version per change', () => {
    const g = new Phaser.GameObjects.Graphics(new Phaser.Scene('t'));
    const v0 = g.version;
    g.fillGradientStyle(0x111111, 0, 0x222222, 0, 1, 1, 0.5, 0.5).fillRect(0, 0, 10, 20);
    g.fillStyle(0xff0000, 0.5).fillCircle(5, 5, 3);
    g.lineStyle(2, 0x00ff00, 1).strokeRoundedRect(1, 2, 3, 4, 6);
    expect(g.ops).toEqual([
      { k: 'rect', x: 0, y: 0, w: 10, h: 20, r: 0, fill: { color: 0xffffff, alpha: 1, grad: { top: 0x111111, topAlpha: 1, bottom: 0x222222, bottomAlpha: 0.5 } } },
      { k: 'circle', x: 5, y: 5, r: 3, fill: { color: 0xff0000, alpha: 0.5 } },
      { k: 'rect', x: 1, y: 2, w: 3, h: 4, r: 6, line: { width: 2, color: 0x00ff00, alpha: 1 } }
    ]);
    expect(g.version).toBe(v0 + 3);
    g.clear();
    expect(g.ops).toEqual([]);
    expect(g.version).toBe(v0 + 4);
  });

  it('records colour-matrix calls for the PIXI filter and resets them', () => {
    const f = new Phaser.FilterList().addColorMatrix();
    f.saturate(-1).brightness(0.8, true).sepia();
    expect(f.ops).toEqual([['saturate', -1, false], ['brightness', 0.8, true], ['sepia', false]]);
    const v = f.version;
    f.reset();
    expect(f.ops).toEqual([]);
    expect(f.version).toBe(v + 1);
  });

  it('has nothing to draw without a source image and stays released after destroy', () => {
    const tex = new Phaser.Textures.Texture('t', null, 100, 50);
    // no source image: nothing drawable
    expect(tex.pixiFrame(tex.get())).toBeNull();
    tex.destroy();
    expect(tex.destroyed).toBe(true);
  });
});
