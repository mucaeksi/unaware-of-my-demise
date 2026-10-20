import type { Attachment, MailItem } from '../net/api';
import { currency } from '../net/currency';

export const currencyLabel = (_id?: string): string => currency.name;

export const stars = (n: number): string => '★'.repeat(n);

export function describeAttachment(a: Attachment, names: Map<string, string>): string {
  switch (a.type) {
    case 'currency': return `${a.amount.toLocaleString('en-US')} ${currencyLabel(a.currency)}`;
    case 'character': return names.get(a.itemId) ?? a.itemId;
    case 'item': return `${names.get(a.itemId) ?? a.itemId} ×${a.quantity}`;
    case 'gear': return names.get(a.gearId) ?? a.gearId;
    case 'account_xp': return `${a.amount} account XP`;
  }
}

export function describeAttachments(atts: MailItem['attachments'], names: Map<string, string>): string {
  return atts.length === 0 ? 'No attachment' : atts.map((a) => describeAttachment(a, names)).join(' · ');
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'a', 'in']);
/** Server ids (badges, tiers, modifiers) as player text: `wayfarer_of_ash` → `Wayfarer of Ash`. */
export const idLabel = (id: string): string =>
  id.split('_').map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

export const pct =(x: number, digits = 1): string => `${(x * 100).toFixed(digits).replace(/\.0+$/, '')} %`;

const STAT_NAME: Record<string, string> = { str: 'STR', int: 'INT', vit: 'VIT', agi: 'AGI', power: 'POWER', def: 'DEF', hp: 'HP', atk: 'ATK', spd: 'SPD', heal_bonus: 'HEAL', focus_gain: 'FOCUS', effect_res: 'EFFECT RES', element_res: 'ELEMENT RES' };
/** One gear stat for the player: whole points read `+1 VIT`, percentages `HEAL +5%`. */
export function gearStat(id: string, value: number): string {
  const m = /^(.+)_(flat|pct)$/.exec(id);
  const name = (m && STAT_NAME[m[1]!]) ?? id.toUpperCase();
  if (m?.[2] === 'pct') return `${name} +${Math.round(value * 1000) / 10}%`;
  return `+${Math.round(value * 10) / 10} ${name}`;
}

/** Download sizes for the patch bar: "812 KB", "12.4 MB". */
export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
