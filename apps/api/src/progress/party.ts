import { BattleParty, EquipmentEffects, type Encounter, type PartyMember, type StoryLoanEquipment } from '@uomd/content-schema';
import { finalStats, type ProgressionConfig } from '@uomd/economy';
import { HttpError } from '../content/store';
import { computeCharacterStats } from '../gear/service';
import { loadProgressionConfig } from '../progression/characters';
import { loanGear } from './loan-gear';
import { catalogCharacter, characterDefinition, type RuntimeCatalog } from '../content/runtime-catalog';

interface TeamMember {
  characterId: string;
  slot: number;
  row: 'front' | 'rear';
}

const FRONT = 2;
type Member = Omit<PartyMember, 'slot' | 'row'> & { affinity: 'front' | 'rear' | null };

/**
 * The party the server fights with for an owned-hero stage: story guests first (they take slots before the player's own heroes,
 * canon: "Brin, Nixie and Kera are story loans so the two starters can field five"), then the player's active team in its formation
 * order. Stats are computed here (level growth + equipped gear + set bonuses); the client never supplies any of them.
 * Heroes the published unit pack does not contain are skipped, so an old release can never crash a battle.
 */
export async function buildParty(db: D1Database, playerId: string, encounter: Encounter, unitIds: ReadonlySet<string>, cfg?: ProgressionConfig, template?: StoryLoanEquipment, catalog?: RuntimeCatalog): Promise<BattleParty> {
  cfg = catalog?.data.config.progression ?? cfg ?? await loadProgressionConfig(db);
  const stageLevel = Math.max(...encounter.enemies.map((e) => e.level), 1);
  const members: Member[] = [];

  for (const id of [...new Set(encounter.guests ?? [])].filter((g) => unitIds.has(g)).slice(0, 5)) {
    const definition = catalog ? catalogCharacter(catalog, id) : undefined;
    const ch = definition ? characterDefinition(definition) : await db
      .prepare('SELECT base_hp, base_atk, base_def, base_spd, growth_hp, growth_atk, growth_def, growth_spd, formation_affinity, weapon_type, role FROM characters WHERE id = ?1')
      .bind(id)
      .first<{ base_hp: number; base_atk: number; base_def: number; base_spd: number; growth_hp: number; growth_atk: number; growth_def: number; growth_spd: number; formation_affinity: string | null; weapon_type: string | null; role: string }>();
    if (!ch) continue;
    const affinity = ch.formation_affinity === 'front' || ch.formation_affinity === 'rear' ? ch.formation_affinity : null;
    const owned = await db.prepare("SELECT 1 FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2").bind(playerId, id).first();
    if (owned) {
      members.push(await ownedMember(db, playerId, id, cfg, affinity, catalog));
      continue;
    }
    // Older releases without a declared template retain their original gearless loan contract.
    const gear = template ? await loanGear(db, id, ch.weapon_type, ch.role, encounter.stage_id, cfg, template, catalog) : { flat: {}, pct: {}, other: {} };
    const stats = finalStats({ hp: ch.base_hp, atk: ch.base_atk, def: ch.base_def, spd: ch.base_spd }, { hp: ch.growth_hp, atk: ch.growth_atk, def: ch.growth_def, spd: ch.growth_spd }, stageLevel, gear);
    members.push({ unit_id: id, level: stageLevel, stats, ...equipmentEffects(gear.other), loan: true, affinity });
  }

  const room = 5 - members.length;
  if (room > 0) {
    for (const t of await ownedTeam(db, playerId, unitIds, catalog)) {
      if (members.length >= 5) break;
      if (members.some((m) => m.unit_id === t.characterId)) continue; // a guest already stands in for this hero
      members.push(await ownedMember(db, playerId, t.characterId, cfg, t.row, catalog));
    }
  }
  if (members.length === 0) throw new HttpError(409, 'no_team', 'you have no hero to send into battle');

  // formation: two front, three rear. Heroes keep the row they asked for while room lasts, guests follow their canon affinity.
  const front = members.filter((m) => m.affinity === 'front').slice(0, FRONT);
  const rest = members.filter((m) => !front.includes(m));
  while (front.length < FRONT && rest.length > 0 && members.length > 3) front.push(rest.shift() as (typeof members)[number]);
  if (front.length === 0 && rest.length > 0) front.push(rest.shift() as (typeof members)[number]);
  const out: PartyMember[] = [];
  front.forEach((m, i) => out.push(strip(m, i, 'front')));
  rest.forEach((m, i) => out.push(strip(m, front.length + i, 'rear')));
  return BattleParty.parse(out);
}

async function ownedMember(db: D1Database, playerId: string, characterId: string, cfg: ProgressionConfig, affinity: Member['affinity'], catalog?: RuntimeCatalog): Promise<Member> {
  const st = await computeCharacterStats(db, playerId, characterId, cfg, catalog);
  if (st.unsupportedPassives.length) throw new HttpError(422, 'unsupported_gear_passive', 'an equipped passive is not available in battle yet; remove that item or choose other equipment');
  const ranks = await db.prepare('SELECT skill_ranks FROM player_chars WHERE player_id = ?1 AND character_id = ?2').bind(playerId, characterId).first<{ skill_ranks: string }>();
  const skillRanks = ranks ? JSON.parse(ranks.skill_ranks) as Record<string, number> : {};
  return { unit_id: characterId, level: st.level, stats: st.stats, ...equipmentEffects(st.other), ...(Object.keys(skillRanks).length ? { skill_ranks: skillRanks } : {}), affinity };
}

function equipmentEffects(other: Record<string, number>): Pick<PartyMember, 'equipment_effects'> {
  const effects = Object.fromEntries(['heal_bonus_pct', 'focus_gain_pct'].filter((key) => other[key] !== undefined).map((key) => [key, other[key]]));
  if (!Object.keys(effects).length) return {};
  const parsed = EquipmentEffects.safeParse({ version: 1, ...effects });
  if (!parsed.success) throw new HttpError(503, 'invalid_equipment_effects', 'equipped effects exceed the supported battle contract');
  return { equipment_effects: parsed.data };
}

function strip(m: { affinity: 'front' | 'rear' | null } & Omit<PartyMember, 'slot' | 'row'>, slot: number, row: 'front' | 'rear'): PartyMember {
  const { affinity: _affinity, ...rest } = m;
  void _affinity;
  return { ...rest, slot, row };
}

/** The active preset, or — when the player never made one — their strongest owned heroes, so a new account can fight immediately. */
async function ownedTeam(db: D1Database, playerId: string, unitIds: ReadonlySet<string>, catalog?: RuntimeCatalog): Promise<TeamMember[]> {
  const row = await db.prepare('SELECT members_json FROM player_teams WHERE player_id = ?1 AND active = 1').bind(playerId).first<{ members_json: string }>();
  if (row) {
    const t = (JSON.parse(row.members_json) as TeamMember[]).filter((m) => unitIds.has(m.characterId));
    if (t.length) return [...t].sort((a, b) => a.slot - b.slot);
  }
  if (catalog) {
    const owned = (await db.prepare("SELECT i.item_id AS id, COALESCE(pc.level, 1) AS level FROM player_items i LEFT JOIN player_chars pc ON pc.player_id = i.player_id AND pc.character_id = i.item_id WHERE i.player_id = ?1 AND i.item_type = 'character' ORDER BY level DESC, i.item_id").bind(playerId).all<{ id: string; level: number }>()).results.filter((r) => unitIds.has(r.id));
    return owned.slice(0, 5).map((r, i) => ({ characterId: r.id, slot: i, row: catalogCharacter(catalog, r.id).formation_affinity === 'front' ? 'front' : 'rear' }));
  }
  const owned = (
    await db
      .prepare(
        `SELECT i.item_id AS id, COALESCE(pc.level, 1) AS level, c.formation_affinity AS affinity FROM player_items i JOIN characters c ON c.id = i.item_id
         LEFT JOIN player_chars pc ON pc.player_id = i.player_id AND pc.character_id = i.item_id
         WHERE i.player_id = ?1 AND i.item_type = 'character' ORDER BY level DESC, i.item_id`
      )
      .bind(playerId)
      .all<{ id: string; level: number; affinity: string | null }>()
  ).results.filter((r) => unitIds.has(r.id));
  return owned.slice(0, 5).map((r, i) => ({ characterId: r.id, slot: i, row: r.affinity === 'front' ? 'front' : 'rear' }));
}
