import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { balanceOf } from '../db/ledger';
import { battleResult, type BattleOutcome } from '../progress/service';

interface StoredOperation {
  input_json: string | null;
  result_json: string;
  kind?: string;
}

/** Read only the authenticated player's original result; absence does not prove a request failed. */
export async function operationStatus(db: D1Database, playerId: string, requestId: string, path: string): Promise<Record<string, unknown>> {
  let row: StoredOperation | null;
  let battle = false;
  if (path === '/api/v1/gacha/pull') {
    row = await db.prepare('SELECT input_json, result_json FROM gacha_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<StoredOperation>();
  } else if (path === '/api/v1/progress/battle') {
    battle = true;
    row = await db.prepare('SELECT input_json, result_json FROM battle_claims WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<StoredOperation>();
  } else {
    const character = /^\/api\/v1\/characters\/([a-z][a-z0-9_]{1,79})\/(level-up|ascend|skills\/([a-z][a-z0-9_]{1,79})\/upgrade)$/.exec(path);
    const gear = /^\/api\/v1\/gear\/([1-9]\d{0,15})\/(level-up|ascend|reroll|dismantle)$/.exec(path);
    const mail = /^\/api\/v1\/mail\/([1-9]\d{0,15})\/claim$/.exec(path);
    const task = path === '/api/v1/tasks/claim';
    const selector = /^\/api\/v1\/recruitment\/([a-z][a-z0-9_]{1,79})$/.exec(path);
    const checkpoint = path === '/api/v1/entry' ? 'entry_checkpoint' : path === '/api/v1/save' ? 'cloud_save' : path === '/api/v1/progress/story' ? 'story_complete' : null;
    if (!character && !selector && !task && !checkpoint && (!gear || !Number.isSafeInteger(Number(gear[1]))) && (!mail || !Number.isSafeInteger(Number(mail[1]))))
      throw new HttpError(400, 'bad_request', 'unsupported operation path');
    const kind = character
      ? `${character[2] === 'level-up' ? 'level_up' : character[2] === 'ascend' ? 'ascend' : `skill:${character[3]}`}:${character[1]}`
      : gear ? `gear_${gear[2] === 'level-up' ? 'level' : gear[2]}:${gear[1]}` : mail ? `mail_claim:${mail[1]}` : selector ? `recruit_selector:${selector[1]}` : checkpoint;
    row = await db.prepare('SELECT kind, input_json, result_json FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<StoredOperation>();
    if (row && (task ? !row.kind?.startsWith('task_claim:') : row.kind !== kind)) throw new HttpError(409, 'request_id_reused', 'this identity belongs to another operation');
  }
  if (!row) return { requestId, path, state: 'unknown', binding: null, inputHash: null, result: null };
  const original = JSON.parse(row.result_json) as Record<string, unknown>;
  const result = battle ? await battleResult(db, playerId, original as unknown as BattleOutcome, true)
    : { ...original, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: true };
  return { requestId, path, state: 'confirmed', binding: row.input_json === null ? 'legacy' : 'exact',
    inputHash: row.input_json === null ? null : await sha256Hex(row.input_json), result };
}
