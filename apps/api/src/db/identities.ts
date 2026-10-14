/** Identity registration carries no stats, prices or mutable authoring metadata. Append it to the caller's guarded transaction. */
export function identityStatement(db: D1Database, kind: 'character' | 'item' | 'gear', id: string): D1PreparedStatement {
  const table = { character: 'character_identities', item: 'item_identities', gear: 'gear_identities' }[kind];
  return db.prepare(`INSERT OR IGNORE INTO ${table} (id) VALUES (?1)`).bind(id);
}
