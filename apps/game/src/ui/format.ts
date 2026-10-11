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

export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits).replace(/\.0+$/, '')} %`;
