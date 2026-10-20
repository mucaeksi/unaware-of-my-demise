import { EventHook } from '@uomd/content-schema';
import { z } from 'zod';
import table from '../../../../content/balance/gear_passives.json';
import { HttpError } from '../content/store';

const PassiveMetadata = z.object({ passive_effect_id: z.string().max(100).optional(), passive_name_en: z.string().max(200).optional(), passive_effect_en: z.string().max(2000).optional() }).passthrough();

/** Owner-approved battle effects of gear passives (content/balance/gear_passives.json); a passive not listed has no executable effect. */
export const GEAR_PASSIVE_HOOKS: Readonly<Record<string, EventHook>> = z.object({ note: z.string().optional(), hooks: z.record(z.string(), EventHook) }).parse(table).hooks;

function metadata(extraJson: string): z.infer<typeof PassiveMetadata> {
  try { return PassiveMetadata.parse(JSON.parse(extraJson)); }
  catch { throw new HttpError(503, 'invalid_gear_definition', 'this equipment definition needs review'); }
}

/** What the player sees of a gear passive; `supported` = it has an approved battle effect. */
export function gearPassive(extraJson: string, hooks = GEAR_PASSIVE_HOOKS): { name: string; text?: string; supported: boolean } | null {
  const extra = metadata(extraJson);
  if (!extra.passive_effect_id && !extra.passive_name_en && !extra.passive_effect_en) return null;
  return { name: extra.passive_name_en || 'Weapon passive', ...(extra.passive_effect_en ? { text: extra.passive_effect_en } : {}), supported: Boolean(extra.passive_effect_id && hooks[extra.passive_effect_id]) };
}

/** The battle hook of a supported passive (frozen into the party snapshot), or null. */
export function gearPassiveHook(extraJson: string, hooks = GEAR_PASSIVE_HOOKS): EventHook | null {
  const id = metadata(extraJson).passive_effect_id;
  return (id && hooks[id]) || null;
}

export function requireSupportedGearPassive(extraJson: string): void {
  if (gearPassive(extraJson)?.supported === false) throw new HttpError(422, 'unsupported_gear_passive', 'this passive is not available in battle yet; remove this item or choose other equipment');
}

/** Story loans carry stats only, so a loan template may not include any passive. */
export function requireNoGearPassive(extraJson: string): void {
  if (gearPassive(extraJson)) throw new HttpError(422, 'unsupported_gear_passive', 'loan equipment cannot carry a passive');
}
