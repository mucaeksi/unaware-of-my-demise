import { z } from 'zod';
import { HttpError } from '../content/store';

const Member = z.object({ characterId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), slot: z.number().int().min(0).max(4), row: z.enum(['front', 'rear']) }).strict();
export const TeamBody = z.object({ name: z.string().trim().min(1).max(24), members: z.array(Member).min(1).max(5) }).strict();
export type TeamBody = z.infer<typeof TeamBody>;

export async function listTeams(db: D1Database, playerId: string): Promise<{ teams: { slot: number; name: string; active: boolean; members: unknown }[] }> {
  const { results } = await db.prepare('SELECT slot, name, members_json, active FROM player_teams WHERE player_id = ?1 ORDER BY slot').bind(playerId).all<{ slot: number; name: string; members_json: string; active: number }>();
  return { teams: results.map((r) => ({ slot: r.slot, name: r.name, active: r.active === 1, members: JSON.parse(r.members_json) as unknown })) };
}

/** Saves a preset. Every member must be a character the player owns, no character twice, no formation slot twice. */
export async function saveTeam(db: D1Database, playerId: string, slot: number, input: TeamBody): Promise<Record<string, unknown>> {
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) throw new HttpError(400, 'bad_request', 'team slot must be 1-5');
  const ids = input.members.map((m) => m.characterId);
  if (new Set(ids).size !== ids.length) throw new HttpError(422, 'duplicate_member', 'a character can only be in a team once');
  if (new Set(input.members.map((m) => m.slot)).size !== ids.length) throw new HttpError(422, 'duplicate_slot', 'two members cannot share a formation slot');
  const owned = new Set((await db.prepare(`SELECT item_id FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id IN (${ids.map(() => '?').join(',')})`).bind(playerId, ...ids).all<{ item_id: string }>()).results.map((r) => r.item_id));
  const missing = ids.filter((i) => !owned.has(i));
  if (missing.length) throw new HttpError(422, 'not_owned', `you do not own: ${missing.join(', ')}`);
  const hasAny = await db.prepare('SELECT 1 AS x FROM player_teams WHERE player_id = ?1 LIMIT 1').bind(playerId).first();
  await db
    .prepare(
      `INSERT INTO player_teams (player_id, slot, name, members_json, active) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (player_id, slot) DO UPDATE SET name = excluded.name, members_json = excluded.members_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    )
    .bind(playerId, slot, input.name, JSON.stringify(input.members), hasAny ? 0 : 1) // the first preset becomes the active one
    .run();
  return { slot, name: input.name, members: input.members };
}

export async function activateTeam(db: D1Database, playerId: string, slot: number): Promise<Record<string, unknown>> {
  const row = await db.prepare('SELECT slot FROM player_teams WHERE player_id = ?1 AND slot = ?2').bind(playerId, slot).first();
  if (!row) throw new HttpError(404, 'no_such_team', 'that preset is empty');
  await db.batch([
    db.prepare('UPDATE player_teams SET active = 0 WHERE player_id = ?1 AND active = 1 AND slot <> ?2').bind(playerId, slot),
    db.prepare('UPDATE player_teams SET active = 1 WHERE player_id = ?1 AND slot = ?2').bind(playerId, slot)
  ]);
  return { active: slot };
}

export async function deleteTeam(db: D1Database, playerId: string, slot: number): Promise<Record<string, unknown>> {
  await db.prepare('DELETE FROM player_teams WHERE player_id = ?1 AND slot = ?2').bind(playerId, slot).run();
  return { deleted: slot };
}
