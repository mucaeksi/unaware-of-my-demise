import { z } from 'zod';
import { HttpError } from '../content/store';

const PassiveMetadata = z.object({ passive_effect_id: z.string().max(100).optional(), passive_name_en: z.string().max(200).optional(), passive_effect_en: z.string().max(2000).optional() }).passthrough();

/** Authored signature echoes have no executable ops/magnitude yet; do not invent one. */
export function gearPassive(extraJson: string): { name: string; text?: string; supported: false } | null {
  let extra: z.infer<typeof PassiveMetadata>;
  try { extra = PassiveMetadata.parse(JSON.parse(extraJson)); }
  catch { throw new HttpError(503, 'invalid_gear_definition', 'this equipment definition needs review'); }
  if (!extra.passive_effect_id && !extra.passive_name_en && !extra.passive_effect_en) return null;
  return { name: extra.passive_name_en || 'Weapon passive', ...(extra.passive_effect_en ? { text: extra.passive_effect_en } : {}), supported: false };
}

export function requireSupportedGearPassive(extraJson: string): void {
  if (gearPassive(extraJson)) throw new HttpError(422, 'unsupported_gear_passive', 'this passive is not available in battle yet; remove this item or choose other equipment');
}
