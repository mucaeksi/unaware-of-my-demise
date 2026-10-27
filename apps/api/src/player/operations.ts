import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { balanceOf } from '../db/ledger';
import { battleResult, sweepResult, type BattleOutcome, type SweepOutcome } from '../progress/service';

interface StoredOperation {
  input_json: string | null;
  result_json: string;
  kind?: string;
}

/** Read only the authenticated player's original result; absence does not prove a request failed. */
export async function operationStatus(db: D1Database, playerId: string, requestId: string, path: string): Promise<Record<string, unknown>> {
  let row: StoredOperation | null;
  let battle = false;
  let sweep = false;
  if (path === '/api/v1/gacha/pull') {
    row = await db.prepare('SELECT input_json, result_json FROM gacha_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<StoredOperation>();
  } else if (path === '/api/v1/progress/battle' || path === '/api/v1/progress/sweep') {
    row = await db.prepare('SELECT input_json, result_json FROM battle_claims WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<StoredOperation>();
    if (row) {
      const parsedInput = row.input_json ? (JSON.parse(row.input_json) as { sweep?: boolean }) : {};
      const isSweepRow = parsedInput.sweep === true;
      if ((path === '/api/v1/progress/sweep') !== isSweepRow) {
        throw new HttpError(409, 'request_id_reused', 'this identity belongs to another operation');
      }
      sweep = isSweepRow;
      battle = !isSweepRow;
    }
  } else {
    const character = /^\/api\/v1\/characters\/([a-z][a-z0-9_]{1,79})\/(level-up|ascend|shards\/attune|shards\/convert|skills\/([a-z][a-z0-9_]{1,79})\/upgrade)$/.exec(path);
    const gear = /^\/api\/v1\/gear\/([1-9]\d{0,15})\/(level-up|ascend|reroll|dismantle)$/.exec(path);
    const mail = /^\/api\/v1\/mail\/([1-9]\d{0,15})\/claim$/.exec(path);
    const task = path === '/api/v1/tasks/claim';
    const supplies = path === '/api/v1/tasks/supplies';
    const selector = /^\/api\/v1\/recruitment\/([a-z][a-z0-9_]{1,79})$/.exec(path);
    const eventClaim = /^\/api\/v1\/events\/([a-z][a-z0-9_]{1,63})\/claim$/.exec(path);
    const prefixKind =
      path === '/api/v1/achievements/claim'
        ? 'achievement_claim:'
        : eventClaim
          ? `event_claim:${eventClaim[1]}:`
          : path === '/api/v1/arena/match'
            ? 'arena_match:'
            : path === '/api/v1/arena/season/claim'
              ? 'arena_season_claim:'
              : path === '/api/v1/endless/wave'
                ? 'endless_wave:'
                : path === '/api/v1/endless/milestone/claim'
                  ? 'endless_milestone:'
                  : null;
    const checkpoint =
      path === '/api/v1/entry'
        ? 'entry_checkpoint'
        : path === '/api/v1/save'
          ? 'cloud_save'
          : path === '/api/v1/progress/story'
            ? 'story_complete'
            : path === '/api/v1/afk/claim'
              ? 'afk_claim'
              : path === '/api/v1/profile'
                ? 'profile_update'
                : path === '/api/v1/arena/defense'
                  ? 'arena_defense'
                  : path === '/api/v1/endless/start'
                    ? 'endless_start'
                    : null;
    if (!character && !selector && !task && !supplies && !prefixKind && !checkpoint && (!gear || !Number.isSafeInteger(Number(gear[1]))) && (!mail || !Number.isSafeInteger(Number(mail[1]))))
      throw new HttpError(400, 'bad_request', 'unsupported operation path');
    const kind = character
      ? `${
          character[2] === 'level-up'
            ? 'level_up'
            : character[2] === 'ascend'
              ? 'ascend'
              : character[2] === 'shards/attune'
                ? 'shard_attune'
                : character[2] === 'shards/convert'
                  ? 'shard_convert'
                  : `skill:${character[3]}`
        }:${character[1]}`
      : gear
        ? `gear_${gear[2] === 'level-up' ? 'level' : gear[2]}:${gear[1]}`
        : mail
          ? `mail_claim:${mail[1]}`
          : selector
            ? `recruit_selector:${selector[1]}`
            : checkpoint;
    row = await db.prepare('SELECT kind, input_json, result_json FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<StoredOperation>();
    const supplyKind = row && /^task_claim:supply:\d{4}-\d{2}-\d{2}:_daily_supplies$/.test(row.kind ?? '');
    if (row && (supplies ? !supplyKind : task ? !row.kind?.startsWith('task_claim:') || supplyKind : prefixKind ? !row.kind?.startsWith(prefixKind) : row.kind !== kind)) {
      throw new HttpError(409, 'request_id_reused', 'this identity belongs to another operation');
    }
  }
  if (!row) return { requestId, path, state: 'unknown', binding: null, inputHash: null, result: null };
  const original = JSON.parse(row.result_json) as Record<string, unknown>;
  const result = battle
    ? await battleResult(db, playerId, original as unknown as BattleOutcome, true)
    : sweep
      ? await sweepResult(db, playerId, original as unknown as SweepOutcome, true)
      : { ...original, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: true };
  return {
    requestId,
    path,
    state: 'confirmed',
    binding: row.input_json === null ? 'legacy' : 'exact',
    inputHash: row.input_json === null ? null : await sha256Hex(row.input_json),
    result
  };
}
