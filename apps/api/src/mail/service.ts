import { z } from 'zod';
import { RewardAttachment } from '@uomd/content-schema';
import { HttpError } from '../content/store';
import { grantStatements } from '../db/grants';
import { operationStatement, recordedOperation } from '../db/operations';

export const Attachment = RewardAttachment;
export type Attachment = RewardAttachment;

export const NewMail = z
  .object({
    kind: z.enum(['reward', 'compensation', 'notice', 'subscription', 'event']),
    title: z.string().min(1).max(120),
    body: z.string().max(2000).default(''),
    attachments: z.array(Attachment).max(10).default([]),
    /** days the mail stays claimable (canon: unclaimed completed rewards stay 7 days; subscription grace 14) */
    expiresInDays: z.number().int().min(1).max(365).default(14),
    sourceKey: z.string().regex(/^[A-Za-z0-9:_.-]{1,120}$/).optional()
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

const subscriptionOrder = (sourceKey: string | null | undefined): string | undefined => /^sub:([^:]+):/.exec(sourceKey ?? '')?.[1];

/** Shared statement permits earned windows to be issued in one bounded D1 batch. */
export function prepareMail(db: D1Database, playerId: string, mail: NewMail, createdBy: string, now = new Date()): D1PreparedStatement {
  const m = NewMail.parse(mail);
  const expires = new Date(now.getTime() + m.expiresInDays * 86_400_000).toISOString();
  return db.prepare("INSERT INTO mail (player_id, kind, title, body, attachments, source_key, created_by, created_at, expires_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 FROM players WHERE id = ?1 AND status <> 'deleted' AND (?10 IS NULL OR EXISTS (SELECT 1 FROM purchases WHERE order_id = ?10 AND player_id = ?1 AND state = 'granted' AND entitlement_state IN ('active','canceled','in_grace','expired') AND period_start <= ?8 AND period_end > ?8)) ON CONFLICT (player_id, source_key) DO NOTHING RETURNING id")
    .bind(playerId, m.kind, m.title, m.body, JSON.stringify(m.attachments), m.sourceKey ?? null, createdBy, now.toISOString(), expires, subscriptionOrder(m.sourceKey) ?? null);
}

/** Creates a mail. A repeated `sourceKey` for the same player is a no-op and returns the existing mail id. */
export async function sendMail(db: D1Database, playerId: string, mail: NewMail, createdBy: string, now = new Date()): Promise<{ id: number; created: boolean }> {
  const m = NewMail.parse(mail);
  const res = await prepareMail(db, playerId, m, createdBy, now).first<{ id: number }>();
  if (res) return { id: res.id, created: true };
  const existing = await db.prepare('SELECT id FROM mail WHERE player_id = ?1 AND source_key = ?2').bind(playerId, m.sourceKey ?? '').first<{ id: number }>();
  if (!existing) {
    if (subscriptionOrder(m.sourceKey)) throw new HttpError(409, 'entitlement_unavailable', 'this subscription cannot issue new benefits');
    throw new HttpError(404, 'player_unknown', 'mail could not be created');
  }
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
export async function claimMail(db: D1Database, playerId: string, mailId: number, now = new Date(), requestId?: string): Promise<{ claimed: Attachment[]; requestId?: string; mailId?: number; replayed?: boolean }> {
  const input = requestId ? { requestId } : null;
  const kind = `mail_claim:${mailId}`;
  const recorded = input ? await recordedOperation(db, playerId, kind, input) : null;
  if (recorded) return recorded as { claimed: Attachment[]; requestId: string; mailId: number; replayed: boolean };
  const row = await db
    .prepare('SELECT id, kind, title, body, attachments, created_at, expires_at, claimed_at, read_at FROM mail WHERE id = ?1 AND player_id = ?2')
    .bind(mailId, playerId)
    .first<Omit<MailRow, 'attachments'> & { attachments: string }>();
  if (!row) throw new HttpError(404, 'mail_not_found', 'no such mail');
  const mail = parse(row);
  if (mail.claimed_at) {
    const replay = input ? await recordedOperation(db, playerId, kind, input) : null;
    if (replay) return replay as { claimed: Attachment[]; requestId: string; mailId: number; replayed: boolean };
    throw new HttpError(409, 'already_claimed', 'this mail was already claimed');
  }
  if (mail.expires_at <= now.toISOString()) throw new HttpError(409, 'expired', 'this mail has expired');
  const src = await db.prepare('SELECT source_key FROM mail WHERE id = ?1').bind(mailId).first<{ source_key: string | null }>();
  const order = subscriptionOrder(src?.source_key);
  if (order) {
    const p = await db.prepare('SELECT state FROM purchases WHERE order_id = ?1').bind(order).first<{ state: string }>();
    if (p?.state === 'refunded') throw new HttpError(409, 'revoked', 'this entitlement was revoked by a refund');
  }

  const result = { claimed: mail.attachments, ...(requestId ? { requestId, mailId } : {}) };
  const batch: D1PreparedStatement[] = [
    db.prepare("UPDATE mail SET claimed_at = ?3, read_at = COALESCE(read_at, ?3) WHERE id = ?1 AND player_id = ?2 AND claimed_at IS NULL AND expires_at > ?3 AND EXISTS (SELECT 1 FROM players WHERE id = ?2 AND status <> 'deleted') AND (?4 IS NULL OR EXISTS (SELECT 1 FROM purchases WHERE order_id = ?4 AND player_id = ?2 AND state = 'granted' AND entitlement_state IN ('active', 'canceled', 'in_grace', 'expired')))")
      .bind(mailId, playerId, now.toISOString(), order ?? null),
    db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
    ...(await grantStatements(db, playerId, mail.attachments, { keyPrefix: `mail:${mailId}`, reason: `mail:${mail.kind}` }))
  ];
  if (input) batch.push(operationStatement(db, playerId, kind, input, result));
  batch.push(db.prepare('DELETE FROM tx_guard'));
  try {
    await db.batch(batch);
  } catch (e) {
    const replay = input ? await recordedOperation(db, playerId, kind, input) : null;
    if (replay) return replay as { claimed: Attachment[]; requestId: string; mailId: number; replayed: boolean };
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: ledger/i.test(msg)) {
      if (order) {
        const entitlement = await db.prepare('SELECT state, entitlement_state FROM purchases WHERE order_id = ?1 AND player_id = ?2').bind(order, playerId).first<{ state: string; entitlement_state: string }>();
        if (!entitlement || entitlement.state === 'refunded') throw new HttpError(409, 'revoked', 'this entitlement was revoked');
        if (['on_hold', 'paused', 'pending', 'unknown'].includes(entitlement.entitlement_state)) throw new HttpError(409, 'entitlement_unavailable', 'this subscription is not currently entitled');
      }
      throw new HttpError(409, 'already_claimed', 'this mail is no longer claimable');
    }
    throw e;
  }
  return { ...result, ...(requestId ? { replayed: false } : {}) };
}

export async function markRead(db: D1Database, playerId: string, mailId: number, now = new Date()): Promise<void> {
  await db.prepare('UPDATE mail SET read_at = COALESCE(read_at, ?3) WHERE id = ?1 AND player_id = ?2').bind(mailId, playerId, now.toISOString()).run();
}
