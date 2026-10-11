import { z } from 'zod';
import { CANON } from '@uomd/economy';
import { HttpError } from '../content/store';
import { ledgerStatements } from '../db/ledger';

export const Attachment = z.discriminatedUnion('type', [
  z.object({ type: z.literal('currency'), currency: z.enum(['silver_crowns', 'eclipse_token', 'fates_thread']), amount: z.number().int().min(1).max(1_000_000_000) }).strict(),
  z.object({ type: z.literal('character'), itemId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/) }).strict()
]);
export type Attachment = z.infer<typeof Attachment>;

export const NewMail = z
  .object({
    kind: z.enum(['reward', 'compensation', 'notice', 'subscription', 'event']),
    title: z.string().min(1).max(120),
    body: z.string().max(2000).default(''),
    attachments: z.array(Attachment).max(10).default([]),
    /** days the mail stays claimable (canon: unclaimed completed rewards stay 7 days; subscription grace 14) */
    expiresInDays: z.number().int().min(1).max(365).default(14),
    sourceKey: z.string().regex(/^[A-Za-z0-9:_-]{1,100}$/).optional()
  })
  .strict();
export type NewMail = z.input<typeof NewMail>;

export interface MailRow {
  id: number;
  kind: string;
  title: string;
  body: string;
  attachments: Attachment[];
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  read_at: string | null;
}

/** Creates a mail. A repeated `sourceKey` for the same player is a no-op and returns the existing mail id. */
export async function sendMail(db: D1Database, playerId: string, mail: NewMail, createdBy: string, now = new Date()): Promise<{ id: number; created: boolean }> {
  const m = NewMail.parse(mail);
  const expires = new Date(now.getTime() + m.expiresInDays * 86_400_000).toISOString();
  const res = await db
    .prepare('INSERT INTO mail (player_id, kind, title, body, attachments, source_key, created_by, created_at, expires_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT (player_id, source_key) DO NOTHING RETURNING id')
    .bind(playerId, m.kind, m.title, m.body, JSON.stringify(m.attachments), m.sourceKey ?? null, createdBy, now.toISOString(), expires)
    .first<{ id: number }>();
  if (res) return { id: res.id, created: true };
  const existing = await db.prepare('SELECT id FROM mail WHERE player_id = ?1 AND source_key = ?2').bind(playerId, m.sourceKey ?? '').first<{ id: number }>();
  if (!existing) throw new HttpError(404, 'player_unknown', 'mail could not be created');
  return { id: existing.id, created: false };
}

const parse = (r: Omit<MailRow, 'attachments'> & { attachments: string }): MailRow => ({ ...r, attachments: JSON.parse(r.attachments) as Attachment[] });

export async function listMail(db: D1Database, playerId: string, now = new Date()): Promise<MailRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, kind, title, body, attachments, created_at, expires_at, claimed_at, read_at FROM mail
       WHERE player_id = ?1 AND (claimed_at IS NOT NULL AND claimed_at > ?3 OR claimed_at IS NULL AND expires_at > ?2) ORDER BY id DESC LIMIT 100`
    )
    .bind(playerId, now.toISOString(), new Date(now.getTime() - 3 * 86_400_000).toISOString())
    .all<Omit<MailRow, 'attachments'> & { attachments: string }>();
  return results.map(parse);
}

/** Atomically claims one mail: the guarded UPDATE, the ledger credits and the item grants succeed or fail together. */
export async function claimMail(db: D1Database, playerId: string, mailId: number, now = new Date()): Promise<{ claimed: Attachment[] }> {
  const row = await db
    .prepare('SELECT id, kind, title, body, attachments, created_at, expires_at, claimed_at, read_at FROM mail WHERE id = ?1 AND player_id = ?2')
    .bind(mailId, playerId)
    .first<Omit<MailRow, 'attachments'> & { attachments: string }>();
  if (!row) throw new HttpError(404, 'mail_not_found', 'no such mail');
  const mail = parse(row);
  if (mail.claimed_at) throw new HttpError(409, 'already_claimed', 'this mail was already claimed');
  if (mail.expires_at <= now.toISOString()) throw new HttpError(409, 'expired', 'this mail has expired');

  const items = mail.attachments.filter((a): a is Extract<Attachment, { type: 'character' }> => a.type === 'character');
  const rarity = new Map<string, number>();
  for (const it of items) {
    const c = await db.prepare("SELECT rarity FROM characters WHERE id = ?1 AND status <> 'retired'").bind(it.itemId).first<{ rarity: number }>();
    if (!c) throw new HttpError(422, 'unknown_item', `attachment ${it.itemId} does not exist`);
    rarity.set(it.itemId, c.rarity);
  }
  const batch: D1PreparedStatement[] = [
    db.prepare('UPDATE mail SET claimed_at = ?3, read_at = COALESCE(read_at, ?3) WHERE id = ?1 AND player_id = ?2 AND claimed_at IS NULL AND expires_at > ?3').bind(mailId, playerId, now.toISOString()),
    db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
  ];
  mail.attachments.forEach((a, i) => {
    if (a.type === 'currency') {
      batch.push(...ledgerStatements(db, { playerId, currency: a.currency, delta: a.amount, reason: `mail:${mail.kind}`, idempotencyKey: `mail:${mailId}:${i}` }));
    } else {
      const shards = CANON.duplicateShards[(rarity.get(a.itemId) ?? 3) as 3 | 4 | 5] ?? 2;
      batch.push(
        db
          .prepare("INSERT INTO player_items (player_id, item_type, item_id, copies, shards) VALUES (?1, 'character', ?2, 1, 0) ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET copies = copies + 1, shards = shards + ?3")
          .bind(playerId, a.itemId, shards)
      );
    }
  });
  batch.push(db.prepare('DELETE FROM tx_guard'));
  try {
    await db.batch(batch);
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: ledger/i.test(msg)) throw new HttpError(409, 'already_claimed', 'this mail was already claimed');
    throw e;
  }
  return { claimed: mail.attachments };
}

export async function markRead(db: D1Database, playerId: string, mailId: number, now = new Date()): Promise<void> {
  await db.prepare('UPDATE mail SET read_at = COALESCE(read_at, ?3) WHERE id = ?1 AND player_id = ?2').bind(mailId, playerId, now.toISOString()).run();
}
