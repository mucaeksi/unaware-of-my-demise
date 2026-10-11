import type { MailItem } from '../net/api';

export const CURRENCY_NAME: Record<string, string> = { silver_crowns: 'Silver Crowns', eclipse_token: 'Eclipse Tokens', fates_thread: "Fate's Thread" };

export const stars = (n: number): string => '★'.repeat(n);

export function describeAttachments(atts: MailItem['attachments'], names: Map<string, string>): string {
  return atts.length === 0 ? 'No attachment' : atts.map((a) => (a.type === 'currency' ? `${a.amount.toLocaleString('en-US')} ${CURRENCY_NAME[a.currency] ?? a.currency}` : (names.get(a.itemId) ?? a.itemId))).join(' · ');
}

export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits).replace(/\.0+$/, '')} %`;
