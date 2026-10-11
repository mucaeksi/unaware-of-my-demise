import type { MailItem } from '../net/api';
import { currency } from '../net/currency';

export const currencyLabel = (_id?: string): string => currency.name;

export const stars = (n: number): string => '★'.repeat(n);

export function describeAttachments(atts: MailItem['attachments'], names: Map<string, string>): string {
  return atts.length === 0 ? 'No attachment' : atts.map((a) => (a.type === 'currency' ? `${a.amount.toLocaleString('en-US')} ${currencyLabel(a.currency)}` : (names.get(a.itemId) ?? a.itemId))).join(' · ');
}

export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits).replace(/\.0+$/, '')} %`;
