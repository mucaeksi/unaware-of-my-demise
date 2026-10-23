import { z } from 'zod';
import { Id } from './primitives';

/**
 * Data-driven combat VFX (D-25). A preset is a short timeline over a CLOSED set of primitives that the client
 * compiles into PIXI objects: procedural textures, a few vector shapes, particle bursts, a projectile and camera
 * cues. No shaders, property paths, expressions or code — so new effects ship in signed data patches.
 */
export const VFX_PATH = 'vfx/vfx_presets.json';

/** palette slots resolve against the element of the action (Veil, Stone, Ember, Tide, Gale, Dawn) */
export const VfxColor = z.union([z.enum(['primary', 'secondary', 'core', 'crit']), z.string().regex(/^#[0-9a-fA-F]{6}$/)]);
export const VfxTexture = z.enum(['spark', 'star', 'slash', 'ring', 'pillar', 'shard', 'bell', 'chain', 'seal', 'droplet', 'feather']);
export const VfxEase = z.enum(['linear', 'quad.in', 'quad.out', 'cubic.out', 'back.out', 'sine.inout']);
export const VfxBlend = z.enum(['normal', 'add', 'screen']);
/** ground = under the units, fx = over the units, overlay = above the HUD band */
export const VfxLayer = z.enum(['ground', 'fx', 'overlay']);

const Ms = z.number().int().min(0).max(5000);
const Range = (min: number, max: number) => z.tuple([z.number().min(min).max(max), z.number().min(min).max(max)]).refine(([a, b]) => a <= b, 'range must be [min, max]');
const Props = z
  .object({
    x: z.number().min(-1200).max(1200).optional(),
    y: z.number().min(-1200).max(1200).optional(),
    scale: z.number().min(0).max(8).optional(),
    scale_x: z.number().min(0).max(8).optional(),
    scale_y: z.number().min(0).max(8).optional(),
    alpha: z.number().min(0).max(1).optional(),
    angle: z.number().min(-1440).max(1440).optional()
  })
  .strict();
export type VfxProps = z.infer<typeof Props>;

const Tween = {
  from: Props.default({}),
  to: Props.default({}),
  ease: VfxEase.default('cubic.out'),
  delay_ms: Ms.default(0),
  duration_ms: z.number().int().min(1).max(5000),
  /** optional separate fade-out (alpha to 0) so a shape can grow and fade on different curves */
  fade: z.object({ delay_ms: Ms, duration_ms: z.number().int().min(1).max(5000), ease: VfxEase.default('quad.in') }).strict().optional(),
  /** repeat the element N times, each `every_ms` later, optionally mirroring its angle and cycling tints */
  repeat: z
    .object({ count: z.number().int().min(1).max(8), every_ms: Ms, scale_step: z.number().min(0).max(2).default(0), mirror_angle: z.boolean().default(false), tints: z.array(VfxColor).min(1).max(4).optional() })
    .strict()
    .optional(),
  layer: VfxLayer.default('fx'),
  depth: z.number().int().min(0).max(40).default(0),
  blend: VfxBlend.default('normal')
};

const SpriteEl = z.object({ kind: z.literal('sprite'), texture: VfxTexture, tint: VfxColor.default('core'), ...Tween }).strict();
const ShapeEl = z
  .object({
    kind: z.literal('shape'),
    shape: z.enum(['crescent', 'star_flare', 'spikes', 'crest', 'rings', 'bars', 'bell_arch', 'shield_wall', 'eclipse_corona', 'crosshair']),
    /** main radius / half-span in reference pixels */
    size: z.number().min(1).max(2000),
    /** spikes/crest spokes, crescent smoothness, bars count */
    count: z.number().int().min(1).max(32).default(8),
    /** stroke width; for `bars` the width of the widest bar */
    thickness: z.number().min(0).max(400).default(4),
    /** crescent bow height (sign follows the attack direction) */
    bow: z.number().min(-400).max(400).default(-50),
    tint: VfxColor.default('primary'),
    tint2: VfxColor.default('core'),
    fill_alpha: z.number().min(0).max(1).default(0.92),
    ...Tween
  })
  .strict();
const BurstEl = z
  .object({
    kind: z.literal('burst'),
    texture: VfxTexture,
    count: z.number().int().min(1).max(64),
    speed: Range(0, 3000),
    angle: Range(-720, 720).default([0, 360]),
    offset_x: Range(-600, 600).default([0, 0]),
    offset_y: Range(-600, 600).default([0, 0]),
    scale: z.object({ start: z.number().min(0).max(8), end: z.number().min(0).max(8) }).strict(),
    alpha: z.object({ start: z.number().min(0).max(1), end: z.number().min(0).max(1) }).strict().default({ start: 1, end: 0 }),
    spin: z.boolean().default(false),
    lifespan_ms: z.number().int().min(16).max(5000),
    gravity_y: z.number().min(-3000).max(3000).default(0),
    tints: z.array(VfxColor).min(1).max(4),
    delay_ms: Ms.default(0),
    layer: VfxLayer.default('fx'),
    depth: z.number().int().min(0).max(40).default(0),
    blend: VfxBlend.default('add')
  })
  .strict();
/** travels from the caster to the target on a quadratic arc; the preset resolves when it lands */
const ProjectileEl = z
  .object({
    kind: z.literal('projectile'),
    texture: VfxTexture,
    halo: VfxTexture.optional(),
    tint: VfxColor.default('core'),
    halo_tint: VfxColor.default('primary'),
    scale: z.number().min(0).max(8).default(0.65),
    arc_height: z.number().min(0).max(800).default(65),
    spin_turns: z.number().min(0).max(8).default(1.5),
    duration_ms: z.number().int().min(16).max(3000),
    ease: VfxEase.default('quad.in'),
    trail: z.object({ texture: VfxTexture, every_ms: z.number().int().min(8).max(500), lifespan_ms: z.number().int().min(16).max(2000), scale: z.number().min(0).max(8), tints: z.array(VfxColor).min(1).max(4) }).strict().optional(),
    layer: VfxLayer.default('fx'),
    depth: z.number().int().min(0).max(40).default(20),
    blend: VfxBlend.default('add')
  })
  .strict();
/** camera feedback the battle scene performs (reduced-motion players never get shake or hit-stop) */
const CueEl = z.object({ kind: z.literal('cue'), cue: z.enum(['hit_stop', 'shake', 'flash']), delay_ms: Ms.default(0), duration_ms: z.number().int().min(1).max(1500), intensity: z.number().min(0).max(1).default(0.5) }).strict();

export const VfxElement = z.discriminatedUnion('kind', [SpriteEl, ShapeEl, BurstEl, ProjectileEl, CueEl]);
export type VfxElement = z.infer<typeof VfxElement>;
export const VfxPreset = z.object({ elements: z.array(VfxElement).min(1).max(24) }).strict();
export type VfxPreset = z.infer<typeof VfxPreset>;
const Palette = z.object({ primary: z.number().int().min(0).max(0xffffff), secondary: z.number().int().min(0).max(0xffffff), core: z.number().int().min(0).max(0xffffff) }).strict();

export const VfxPack = z
  .object({
    schema_version: z.literal(1),
    /** element palettes; `crit` is fixed gold */
    palettes: z.record(z.string().regex(/^[A-Z][A-Za-z]{1,23}$/), Palette).default({}),
    presets: z.record(Id, VfxPreset),
    /** optional per-skill override: skill_id -> preset id (otherwise the battle picks by action kind) */
    skills: z.record(Id, Id).default({})
  })
  .strict()
  .superRefine((p, ctx) => {
    if (Object.keys(p.presets).length > 256) ctx.addIssue({ code: 'custom', message: 'presets exceed their entry budget' });
    if (Object.keys(p.skills).length > 1024) ctx.addIssue({ code: 'custom', message: 'skill mappings exceed their entry budget' });
    for (const [skill, preset] of Object.entries(p.skills)) if (!Object.hasOwn(p.presets, preset)) ctx.addIssue({ code: 'custom', message: `skill ${skill}: unknown preset ${preset}` });
    for (const [id, preset] of Object.entries(p.presets)) if (preset.elements.filter((e) => e.kind === 'projectile').length > 1) ctx.addIssue({ code: 'custom', message: `preset ${id}: at most one projectile` });
  });
export type VfxPack = z.infer<typeof VfxPack>;
