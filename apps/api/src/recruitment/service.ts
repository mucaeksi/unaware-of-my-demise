import { z } from 'zod';
import { ChapterIndex, Id, type ChapterIndex as Index } from '@uomd/content-schema';
import { canonicalJson } from '@uomd/shared';
import { CANON } from '@uomd/economy';
import { economicStatement, requireEconomic } from '../content/authority';
import { ContentStore, HttpError } from '../content/store';
import { grantStatements, stackSpend } from '../db/grants';
import { recordedOperation } from '../db/operations';
import { catalogCharacter, loadReleaseCatalog } from '../content/runtime-catalog';
import type { GameEnv } from '../env';

type Env = Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>;
type Selector = NonNullable<Index['recruit_selectors']>[number];
export const RecruitSelection = z.object({ releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/), characterId: Id,
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();
export type RecruitSelection = z.infer<typeof RecruitSelection>;

async function indexFor(env: Env, releaseId: string): Promise<Index> {
  const store = new ContentStore(env.DB, env.CONTENT); const release = await store.getRelease(releaseId);
  if (!release || release.state !== 'published' || release.channel !== env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'no published release on this channel');
  const bytes = await store.effectiveBytes(releaseId, 'chapters/chapter_index.json');
  try { return ChapterIndex.parse(JSON.parse(new TextDecoder().decode(bytes ?? new Uint8Array()))); }
  catch { throw new HttpError(503, 'content_unavailable', 'the recruitment rules could not be loaded'); }
}
async function unlocked(env: Env, playerId: string, selector: Selector): Promise<boolean> {
  return !!await env.DB.prepare(`SELECT 1 AS ok WHERE EXISTS (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?2 AND stars >= 1)
    AND EXISTS (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?3 AND clears >= 1)`)
    .bind(playerId, selector.after_node, selector.scene_node).first();
}

/** Only completed story choices are disclosed; a locked selector cannot reveal future companions. */
export async function listRecruitSelectors(env: Env, playerId: string, releaseId: string): Promise<{ releaseId: string; selectors: Record<string, unknown>[] }> {
  const index = await indexFor(env, releaseId);
  await requireEconomic(env.DB, env.CONTENT_CHANNEL, releaseId, playerId, '', new Date());
  const catalog = await loadReleaseCatalog(env, releaseId);
  const selectors: Record<string, unknown>[] = [];
  for (const selector of index.recruit_selectors ?? []) {
    if (!await unlocked(env, playerId, selector)) continue;
    if (catalog && !catalog.data.items.some((item) => item.item_id === selector.item_id && item.kind === 'recruit_selector' && item.consumable && item.status !== 'retired')) throw new HttpError(503, 'selector_unavailable', 'the declared invitation is unavailable in this release');
    const item = catalog ? await env.DB.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2 AND qty > 0').bind(playerId, selector.item_id).first<{ qty: number }>() : await env.DB.prepare(`SELECT s.qty FROM player_stacks s JOIN item_defs i ON i.item_id = s.item_id
      WHERE s.player_id = ?1 AND s.item_id = ?2 AND s.qty > 0 AND i.kind = 'recruit_selector' AND i.consumable = 1 AND i.status <> 'retired'`).bind(playerId, selector.item_id).first<{ qty: number }>();
    if (!item) continue;
    const copies = catalog ? new Map((await env.DB.prepare("SELECT item_id, copies FROM player_items WHERE player_id = ?1 AND item_type = 'character'").bind(playerId).all<{ item_id: string; copies: number }>()).results.map((row) => [row.item_id, row.copies])) : undefined;
    const snapshotChoices = catalog ? selector.choices.map((id) => {
      const character = catalogCharacter(catalog, id);
      if (character.rarity !== selector.rarity) throw new HttpError(503, 'selector_unavailable', 'a declared companion has the wrong rarity');
      return { id, name_en: character.name_en, rarity: character.rarity, element: character.element, role: character.role, copies: copies!.get(id) ?? 0 };
    }) : undefined;
    const results = snapshotChoices ?? (await env.DB.prepare(`SELECT c.id, c.name_en, c.rarity, c.element, c.role, COALESCE(p.copies, 0) AS copies FROM characters c
      LEFT JOIN player_items p ON p.player_id = ?1 AND p.item_type = 'character' AND p.item_id = c.id
      WHERE c.status <> 'retired' AND c.rarity = ?2 AND c.id IN (${selector.choices.map((_, i) => `?${i + 3}`).join(',')})`)
      .bind(playerId, selector.rarity, ...selector.choices).all<{ id: string } & Record<string, unknown>>()).results;
    const characters = new Map(results.map((character) => [character.id, character]));
    if (characters.size !== selector.choices.length) throw new HttpError(503, 'selector_unavailable', 'a declared companion is unavailable; no invitation was used');
    const choices = selector.choices.map((id) => characters.get(id)!);
    selectors.push({ itemId: selector.item_id, title: selector.title_en, quantity: item.qty, duplicateShards: CANON.duplicateShards[4], choices });
  }
  return { releaseId, selectors };
}

export async function selectRecruit(env: Env, playerId: string, itemId: string, input: RecruitSelection, now = new Date()): Promise<Record<string, unknown>> {
  const db = env.DB; const kind = `recruit_selector:${itemId}`;
  const original = await recordedOperation(db, playerId, kind, input);
  if (original) return original;
  const index = await indexFor(env, input.releaseId);
  const selector = index.recruit_selectors?.find((selector) => selector.item_id === itemId);
  if (!selector) throw new HttpError(404, 'unknown_selector', 'this release does not support that invitation');
  if (!selector.choices.includes(input.characterId)) throw new HttpError(422, 'invalid_choice', 'this companion is not eligible for the invitation');
  await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, selector.scene_node, now);
  if (!await unlocked(env, playerId, selector)) throw new HttpError(403, 'story_gate', 'complete the invitation story first');
  const catalog = await loadReleaseCatalog(env, input.releaseId);
  const item = catalog ? catalog.data.items.find((item) => item.item_id === itemId && item.kind === 'recruit_selector' && item.consumable && item.status !== 'retired') : await db.prepare("SELECT 1 AS ok FROM item_defs WHERE item_id = ?1 AND kind = 'recruit_selector' AND consumable = 1 AND status <> 'retired'").bind(itemId).first();
  const definition = catalog ? catalogCharacter(catalog, input.characterId) : undefined;
  const character = definition ? definition.rarity === selector.rarity ? { name_en: definition.name_en } : null : await db.prepare("SELECT name_en FROM characters WHERE id = ?1 AND rarity = ?2 AND status <> 'retired'").bind(input.characterId, selector.rarity).first<{ name_en: string }>();
  if (!item || !character) throw new HttpError(503, 'selector_unavailable', 'the invitation or companion is unavailable; nothing was used');
  const result = { ...(catalog ? { catalogSha256: catalog.sha256 } : {}), requestId: input.requestId, releaseId: input.releaseId, itemId, characterId: input.characterId, characterName: character.name_en, consumed: 1, replayed: false };
  const grants = await grantStatements(db, playerId, [{ type: 'character', itemId: input.characterId }], { keyPrefix: `selector:${playerId}:${input.requestId}`, reason: `selector:${itemId}`, catalog });
  try {
    await db.batch([
      economicStatement(db, env.CONTENT_CHANNEL, input.releaseId, playerId, selector.scene_node, now, undefined, true),
      db.prepare(`INSERT INTO tx_guard (ok) VALUES (CASE WHEN
        EXISTS (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?2 AND stars >= 1)
        AND EXISTS (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?3 AND clears >= 1)
        ${catalog ? '' : `AND EXISTS (SELECT 1 FROM item_defs WHERE item_id = ?4 AND kind = 'recruit_selector' AND consumable = 1 AND status <> 'retired')
        AND EXISTS (SELECT 1 FROM characters WHERE id = ?5 AND rarity = ?6 AND status <> 'retired')`} THEN 1 ELSE 0 END)`)
        .bind(...(catalog ? [playerId, selector.after_node, selector.scene_node] : [playerId, selector.after_node, selector.scene_node, itemId, input.characterId, selector.rarity])),
      stackSpend(db, playerId, itemId, 1), ...grants,
      // Freeze the grant's transaction-time duplicate classification with the original response.
      db.prepare(`INSERT INTO progression_requests (player_id, request_id, kind, input_json, result_json)
        SELECT ?1, ?2, ?3, ?4, json_set(?5, '$.grant', json(result_json)) FROM reward_grants WHERE player_id = ?1 AND grant_key = ?6`)
        .bind(playerId, input.requestId, kind, canonicalJson(input), JSON.stringify(result), `selector:${playerId}:${input.requestId}:0`),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'), db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (error) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    if (/CHECK constraint failed: qty >= 0/i.test(String(error))) throw new HttpError(402, 'insufficient_items', 'you do not have an invitation');
    if (/CHECK constraint failed: ok = 1/i.test(String(error))) throw new HttpError(409, 'selector_state_changed', 'the account, release or invitation changed; refresh before choosing');
    throw error;
  }
  const committed = await recordedOperation(db, playerId, kind, input);
  if (!committed) throw new HttpError(503, 'operation_unverified', 'the invitation result could not be confirmed');
  return { ...committed, replayed: false };
}
