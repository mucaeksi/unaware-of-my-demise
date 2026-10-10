/** Append-only audit trail (UPDATE/DELETE are blocked by D1 triggers). */
export async function audit(db: D1Database, actor: string, action: string, target: string | null, detail: Record<string, unknown> = {}): Promise<void> {
  await db.prepare('INSERT INTO audit_log (actor, action, target, detail) VALUES (?1, ?2, ?3, ?4)').bind(actor, action, target, JSON.stringify(detail)).run();
}

/** Statement form so an audit row can join the same D1 batch (transaction) as the change it records. */
export function auditStatement(db: D1Database, actor: string, action: string, target: string | null, detail: Record<string, unknown> = {}): D1PreparedStatement {
  return db.prepare('INSERT INTO audit_log (actor, action, target, detail) VALUES (?1, ?2, ?3, ?4)').bind(actor, action, target, JSON.stringify(detail));
}

/** Audit row that is only written if the immediately preceding statement in the batch changed a row. */
export function auditIfChanged(db: D1Database, actor: string, action: string, target: string | null, detail: Record<string, unknown> = {}): D1PreparedStatement {
  return db.prepare('INSERT INTO audit_log (actor, action, target, detail) SELECT ?1, ?2, ?3, ?4 WHERE changes() > 0').bind(actor, action, target, JSON.stringify(detail));
}
