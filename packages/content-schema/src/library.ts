import { z } from 'zod';
import { Id, LineId, Sha256Hex } from './primitives';
import { StoryScene } from './story';

/** Finite AND gates; absent conditions add no requirement. Unknown fields never become permission. */
export const NarrativeGate = z.object({ after_node: Id.optional(), owned_character: Id.optional(), after_entry: Id.optional() }).strict();
export type NarrativeGate = z.infer<typeof NarrativeGate>;
export interface NarrativeFacts {
  completedNodes: ReadonlySet<string>;
  ownedCharacters: ReadonlySet<string>;
  completedEntries: ReadonlySet<string>;
}
export function narrativeGateAllows(gate: NarrativeGate, facts: NarrativeFacts): boolean {
  return (!gate.after_node || facts.completedNodes.has(gate.after_node))
    && (!gate.owned_character || facts.ownedCharacters.has(gate.owned_character))
    && (!gate.after_entry || facts.completedEntries.has(gate.after_entry));
}
export const LibraryEntry = z.object({ entry_id: Id, kind: z.enum(['companion', 'codex', 'event']), group_id: Id,
  part: z.number().int().min(1).max(200), title_en: z.string().min(1).max(80), gate: NarrativeGate,
  scenes: z.array(StoryScene).min(1).max(8), line_ids: z.array(LineId).min(1).max(1000),
  provenance: z.object({ source: z.string().regex(/^narrative\/[A-Za-z0-9_/-]+\.json$/), source_sha256: Sha256Hex }).strict()
}).strict();
export type LibraryEntry = z.infer<typeof LibraryEntry>;
export const NarrativeLibrary = z.object({ schema_version: z.literal(1),
  sources: z.array(z.object({ path: z.string().regex(/^narrative\/[A-Za-z0-9_/-]+\.json$/), sha256: Sha256Hex }).strict()).min(1).max(20),
  entries: z.array(LibraryEntry).min(1).max(200)
}).strict();
export type NarrativeLibrary = z.infer<typeof NarrativeLibrary>;
export const LibraryCard = LibraryEntry.pick({ entry_id: true, kind: true, group_id: true, part: true, title_en: true }).extend({ completed: z.boolean() }).strict();
export type LibraryCard = z.infer<typeof LibraryCard>;
export const LibraryListing = z.object({ releaseId: Id, entries: z.array(LibraryCard).max(200) }).strict();
