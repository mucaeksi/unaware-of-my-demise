import { NarrativeLibrary, narrativeGateAllows, type LibraryEntry, type LibraryCard, type NarrativeFacts, type NarrativeGate } from '@uomd/content-schema';
import { requireEconomic } from '../content/authority';
import { ContentStore, HttpError } from '../content/store';
import type { GameEnv } from '../env';

type Env = Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>;
export async function loadLibrary(env: Env, releaseId: string): Promise<NarrativeLibrary | null> {
  const store = new ContentStore(env.DB, env.CONTENT); const release = await store.getRelease(releaseId);
  if (!release || release.state !== 'published' || release.channel !== env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'no published release on this channel');
  const bytes = await store.effectiveBytes(releaseId, 'library/library_index.json');
  if (!bytes) return null;
  try { return NarrativeLibrary.parse(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new HttpError(503, 'content_unavailable', 'the library could not be loaded'); }
}
async function facts(env: Env, playerId: string, entries: readonly LibraryEntry[]): Promise<NarrativeFacts> {
  const statements: D1PreparedStatement[] = [];
  const query = (ids: string[], table: 'player_progress' | 'player_items'): void => {
    for (let i = 0; i < ids.length; i += 99) {
      const chunk = ids.slice(i, i + 99); const placeholders = chunk.map((_, j) => `?${j + 2}`).join(',');
      statements.push(env.DB.prepare(table === 'player_progress'
        ? `SELECT node_id, stars, clears FROM player_progress WHERE player_id = ?1 AND node_id IN (${placeholders})`
        : `SELECT item_id FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND copies > 0 AND item_id IN (${placeholders})`).bind(playerId, ...chunk));
    }
  };
  query([...new Set(entries.flatMap((entry) => [entry.entry_id, entry.gate.after_node, entry.gate.after_entry]).filter((id): id is string => !!id))], 'player_progress');
  query([...new Set(entries.flatMap((entry) => entry.gate.owned_character ? [entry.gate.owned_character] : []))], 'player_items');
  const results = await env.DB.batch<{ node_id?: string; stars?: number; clears?: number; item_id?: string }>(statements);
  const rows = results.flatMap((result) => result.results);
  return { completedNodes: new Set(rows.filter((row) => row.node_id && Number(row.stars) > 0).map((row) => row.node_id!)),
    completedEntries: new Set(rows.filter((row) => row.node_id && Number(row.clears) > 0).map((row) => row.node_id!)),
    ownedCharacters: new Set(rows.flatMap((row) => row.item_id ? [row.item_id] : [])) };
}
export async function requireLibraryGate(env: Env, playerId: string, entry: LibraryEntry): Promise<void> {
  if (!narrativeGateAllows(entry.gate, await facts(env, playerId, [entry]))) throw new HttpError(403, 'node_locked', 'continue the main story and earlier companion parts first');
}
/** Same three AND requirements as the shared evaluator, fenced again at the completion write. */
export function libraryGateStatement(db: D1Database, playerId: string, gate: NarrativeGate): D1PreparedStatement {
  return db.prepare(`INSERT INTO tx_guard (ok) VALUES (CASE WHEN
    (?2 IS NULL OR EXISTS (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?2 AND stars > 0))
    AND (?3 IS NULL OR EXISTS (SELECT 1 FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?3 AND copies > 0))
    AND (?4 IS NULL OR EXISTS (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?4 AND clears > 0)) THEN 1 ELSE 0 END)`)
    .bind(playerId, gate.after_node ?? null, gate.owned_character ?? null, gate.after_entry ?? null);
}
export async function listLibrary(env: Env, playerId: string, releaseId: string): Promise<{ releaseId: string; entries: LibraryCard[] }> {
  const library = await loadLibrary(env, releaseId);
  await requireEconomic(env.DB, env.CONTENT_CHANNEL, releaseId, playerId, '', new Date());
  if (!library) return { releaseId, entries: [] };
  const state = await facts(env, playerId, library.entries);
  return { releaseId, entries: library.entries.filter((entry) => narrativeGateAllows(entry.gate, state)).map((entry) => ({ entry_id: entry.entry_id,
    kind: entry.kind, group_id: entry.group_id, part: entry.part, title_en: entry.title_en, completed: state.completedEntries.has(entry.entry_id) })) };
}
export async function readLibraryEntry(env: Env, playerId: string, releaseId: string, entryId: string): Promise<{ releaseId: string; entry: LibraryEntry }> {
  const library = await loadLibrary(env, releaseId); const entry = library?.entries.find((entry) => entry.entry_id === entryId);
  if (!entry) throw new HttpError(404, 'unknown_node', 'no such library entry');
  await requireEconomic(env.DB, env.CONTENT_CHANNEL, releaseId, playerId, entryId, new Date());
  await requireLibraryGate(env, playerId, entry);
  return { releaseId, entry };
}
