import { z } from 'zod';
import { Id, LineId, SafeAssetPath, Sha256Hex } from './primitives';
import { VFX_PATH } from './vfx';

export const PRESENTATION_PATH = 'presentation/presentation.json';
export const LocaleId = z.string().regex(/^[a-z]{2}(?:-[A-Za-z0-9]{2,8}){0,2}$/);
const TextId = z.string().regex(/^[a-z0-9][a-z0-9_.]{1,99}$/);
const AudioPath = SafeAssetPath.refine((p) => /\.(ogg|mp3|m4a)$/.test(p), 'audio file required');
const Position = z.number().min(-3840).max(3840);
const Seconds = z.number().min(0).max(30);
export const CompiledScreen = z.enum(['Home', 'Chapters', 'Roster', 'Team', 'Gear', 'Summon', 'Tasks', 'Mail', 'Shop', 'Account', 'Library']);
export const LocalePack = z.object({ schema_version: z.literal(1), locale: LocaleId, fallback: z.literal('en'), strings: z.record(TextId, z.string().min(1).max(1200)) }).strict();
export type LocalePack = z.infer<typeof LocalePack>;
const Caption = z.object({ line_id: LineId, text_en: z.string().min(1).max(600), start_s: z.number().min(0).max(300), end_s: z.number().positive().max(300) }).strict();
const Captions = z.array(Caption).max(200).superRefine((rows, ctx) => {
  for (const [i, row] of rows.entries()) if (row.end_s <= row.start_s || i > 0 && row.start_s < rows[i - 1]!.end_s) ctx.addIssue({ code: 'custom', message: 'captions must have ordered, non-overlapping positive intervals' });
});
const PanelAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('close') }).strict(),
  z.object({ type: z.literal('screen'), screen: CompiledScreen }).strict(),
  z.object({ type: z.literal('panel'), panel_id: Id }).strict()
]);
export const CalendarWindow = z.object({ starts_at: z.iso.datetime(), ends_at: z.iso.datetime() }).strict().refine((w) => Date.parse(w.starts_at) < Date.parse(w.ends_at), 'schedule must have a positive duration');
export const EventSchedule = z.object({ schema_version: z.literal(1), events: z.array(z.object({ entry_id: Id, window: CalendarWindow }).strict()).max(128) }).strict();
export type EventSchedule = z.infer<typeof EventSchedule>;
export const ShopSchedule = z.object({ schema_version: z.literal(1), offers: z.array(z.object({ product_id: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/), window: CalendarWindow }).strict()).max(128) }).strict();
export type ShopSchedule = z.infer<typeof ShopSchedule>;
const Label = z.object({ text_en: z.string().min(1).max(600), text_id: TextId.optional() }).strict();
export const PresentationPack = z.object({ schema_version: z.literal(1),
  voices: z.record(LineId, z.object({ file: AudioPath, language: z.literal('ja'), reviewed_transcript_sha256: Sha256Hex, duration_s: z.number().positive().max(60) }).strict()).default({}),
  sounds: z.record(Id, z.object({ file: AudioPath, duration_s: z.number().positive().max(180), loop: z.boolean(), volume: z.number().min(0).max(1) }).strict()).default({}),
  videos: z.record(Id, z.object({ file: SafeAssetPath.refine((p) => p.endsWith('.webm'), 'WebM video required'), poster_id: Id.optional(), duration_s: z.number().positive().max(300), captions: Captions, audio: z.enum(['none', 'ja']), reviewed_transcript_sha256: Sha256Hex.optional() }).strict().superRefine((v, ctx) => { if (v.audio === 'ja' && !v.reviewed_transcript_sha256) ctx.addIssue({ code: 'custom', message: 'Japanese video audio requires reviewed transcript provenance' }); if (v.captions.some((c) => c.end_s > v.duration_s)) ctx.addIssue({ code: 'custom', message: 'caption exceeds video duration' }); })).default({}),
  locales: z.array(LocaleId).max(16).default([]),
  panels: z.record(Id, z.object({ title: Label.extend({ text_en: z.string().min(1).max(80) }), after_node: Id.optional(), window: CalendarWindow.optional(), body: z.array(Label).max(8), image_id: Id.optional(), buttons: z.array(z.object({ label: Label.extend({ text_en: z.string().min(1).max(40) }), action: PanelAction }).strict()).min(1).max(4) }).strict()).default({})
}).strict().superRefine((p, ctx) => {
  for (const [name, cap] of [['voices', 4096], ['sounds', 128], ['videos', 32], ['panels', 64]] as const) if (Object.keys(p[name]).length > cap) ctx.addIssue({ code: 'custom', message: `${name} exceeds its entry budget` });
  if (new Set(p.locales).size !== p.locales.length) ctx.addIssue({ code: 'custom', message: 'duplicate locale' });
});
export type PresentationPack = z.infer<typeof PresentationPack>;

/** Finite owned-stage operations: no property paths, shaders, expressions, remote URLs or downloaded callbacks. */
export const PresentationCommand = z.discriminatedUnion('op', [
  z.object({ op: z.literal('voice'), line_id: LineId }).strict(),
  z.object({ op: z.literal('sound'), cue_id: Id, action: z.enum(['play', 'stop']) }).strict(),
  z.object({ op: z.literal('video'), video_id: Id, skippable: z.boolean() }).strict(),
  z.object({ op: z.literal('layer'), layer_id: Id, art_id: Id, kind: z.enum(['still', 'ui']), x: Position, y: Position, width: z.number().positive().max(3840), height: z.number().positive().max(2160), alpha: z.number().min(0).max(1), depth: z.number().int().min(0).max(20) }).strict(),
  z.object({ op: z.literal('remove_layer'), layer_id: Id }).strict(),
  z.object({ op: z.literal('animate'), layer_id: Id, to: z.object({ x: Position.optional(), y: Position.optional(), alpha: z.number().min(0).max(1).optional(), scale: z.number().min(0.1).max(4).optional(), angle: z.number().min(-360).max(360).optional() }).strict(), seconds: Seconds, ease: z.enum(['linear', 'sine', 'quad']), wait: z.boolean() }).strict(),
  z.object({ op: z.literal('camera'), x: Position, y: Position, zoom: z.number().min(0.25).max(4), seconds: Seconds }).strict(),
  z.object({ op: z.literal('mask'), layer_id: Id, shape: z.enum(['rectangle', 'ellipse', 'none']), x: Position, y: Position, width: z.number().positive().max(3840), height: z.number().positive().max(2160) }).strict(),
  z.object({ op: z.literal('panel'), panel_id: Id }).strict()
]);
export type PresentationCommand = z.infer<typeof PresentationCommand>;
export const CONTENT_CAPABILITIES = ['calendar_v1', 'catalog_v1', 'presentation_v1', 'locale_v1', 'sprite_animation_v1', 'story_flags_v1', 'snapshot_v1', 'vfx_v1'] as const;
export const ContentCapability = z.enum(CONTENT_CAPABILITIES);

/** Required primitives are declared by the publisher; old binaries reject unknown capabilities before downloading. */
export function requiredContentCapabilities(files: ReadonlyMap<string, Uint8Array>): string[] {
  const required = new Set<string>();
  if (files.has('schedules/events.json') || files.has('schedules/shop.json')) required.add('calendar_v1');
  if (files.has('catalog/economy.json')) required.add('catalog_v1');
  if (files.has(PRESENTATION_PATH)) required.add('presentation_v1');
  if (files.has(VFX_PATH)) required.add('vfx_v1');
  if ([...files.keys()].some((p) => p.startsWith('locales/'))) required.add('locale_v1');
  const presentationOps = new Set(PresentationCommand.options.map((c) => c.shape.op.value as string));
  for (const [path, bytes] of files) if (path.endsWith('.json')) {
    const pending: unknown[] = [JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))];
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object') continue;
      if (Array.isArray(value)) { for (const item of value) pending.push(item); continue; }
      const row = value as Record<string, unknown>;
      if (row.op === 'set_flag' || row.op === 'branch') required.add('story_flags_v1');
      if (typeof row.op === 'string' && presentationOps.has(row.op)) required.add('presentation_v1');
      if (path === 'art/art_manifest.json' && row.animation) required.add('sprite_animation_v1');
      for (const item of Object.values(row)) pending.push(item);
    }
  }
  return [...required].sort();
}
