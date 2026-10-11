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

/** Download sizes for the patch bar: "812 KB", "12.4 MB". */
export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
