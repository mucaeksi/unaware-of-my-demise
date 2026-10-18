import * as PIXI from 'pixi.js';
import type { VfxPreset } from '@uomd/content-schema';

type TextureName = Extract<VfxPreset['elements'][number], { kind: 'sprite' }>['texture'];

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): PIXI.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  return new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: canvas }) });
}

const radial = (ctx: CanvasRenderingContext2D, c: number, r: number, stops: [number, number][]): void => {
  const g = ctx.createRadialGradient(c, c, 0, c, c, r);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c * 2, c * 2);
};

/** white procedural sprites tinted per element at draw time (same artwork as the former canvas renderer) */
function build(): Record<TextureName, PIXI.Texture> {
  return {
    spark: canvasTexture(64, 64, (ctx) => radial(ctx, 32, 32, [[0, 1], [0.35, 0.65], [1, 0]])),
    star: canvasTexture(96, 96, (ctx) => {
      radial(ctx, 48, 44, [[0, 1], [0.25, 0.75], [1, 0]]);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (const rot of [0, Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4]) {
        ctx.save();
        ctx.translate(48, 48);
        ctx.rotate(rot);
        const len = rot % (Math.PI / 2) === 0 ? 46 : 26;
        const thick = rot % (Math.PI / 2) === 0 ? 5.5 : 3;
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.quadraticCurveTo(thick, 0, 0, len);
        ctx.quadraticCurveTo(-thick, 0, 0, -len);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }),
    slash: canvasTexture(256, 128, (ctx) => {
      const grad = ctx.createLinearGradient(16, 64, 240, 64);
      for (const [o, a] of [[0, 0], [0.2, 0.75], [0.55, 1], [0.85, 0.8], [1, 0]] as const) grad.addColorStop(o, `rgba(255,255,255,${a})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(12, 96);
      ctx.quadraticCurveTo(128, 4, 244, 88);
      ctx.quadraticCurveTo(132, 46, 12, 96);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.beginPath();
      ctx.moveTo(36, 86);
      ctx.quadraticCurveTo(128, 18, 224, 80);
      ctx.quadraticCurveTo(130, 36, 36, 86);
      ctx.closePath();
      ctx.fill();
    }),
    ring: canvasTexture(256, 256, (ctx) => {
      ctx.translate(128, 128);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 114, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 96, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.48)';
      for (let k = 0; k < 2; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 4);
        ctx.strokeRect(-68, -68, 136, 136);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 16; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 8);
        ctx.fillRect(-2, -112, 4, i % 2 === 0 ? 14 : 8);
        ctx.restore();
      }
    }),
    pillar: canvasTexture(128, 512, (ctx) => {
      const hg = ctx.createLinearGradient(0, 0, 128, 0);
      for (const [o, a] of [[0, 0], [0.28, 0.55], [0.5, 1], [0.72, 0.55], [1, 0]] as const) hg.addColorStop(o, `rgba(255,255,255,${a})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, 128, 512);
      ctx.globalCompositeOperation = 'destination-in';
      const vg = ctx.createLinearGradient(0, 0, 0, 512);
      for (const [o, a] of [[0, 0], [0.18, 0.9], [0.88, 1], [1, 0]] as const) vg.addColorStop(o, `rgba(255,255,255,${a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, 128, 512);
    }),
    shard: canvasTexture(48, 48, (ctx) => {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(24, 2);
      ctx.lineTo(38, 24);
      ctx.lineTo(24, 46);
      ctx.lineTo(10, 24);
      ctx.closePath();
      ctx.fill();
    })
  };
}

let cache: Record<TextureName, PIXI.Texture> | null = null;
/** created once per app (a few hundred KB of GPU memory); a lost WebGL context re-uploads them from their canvases */
export function vfxTextures(): Record<TextureName, PIXI.Texture> {
  return (cache ??= build());
}
