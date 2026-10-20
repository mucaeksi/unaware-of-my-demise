import { readFileSync } from 'node:fs';
import { Battle, type BattleEvent } from '@uomd/combat';
import { BattleParty, Encounter, EventHook, UnitPack } from '@uomd/content-schema';
import { describe, expect, it } from 'vitest';
import { ROOT } from './fsutil';

const json = (p: string): unknown => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'));
const table = (json('content/balance/gear_passives.json') as { hooks: Record<string, unknown> }).hooks;
const weaponsFile = json('narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/weapons_part1.json') as { weapons?: unknown[] } | unknown[];
const weapons = (Array.isArray(weaponsFile) ? weaponsFile : weaponsFile.weapons ?? []) as { weapon_id: string; owner_character_id?: string; passive_effect_id?: string }[];
const pack = UnitPack.parse(json('content/patches/rel_0003_part1_campaign/units/unit_pack.json'));
const encounter = Encounter.parse(json('content/patches/rel_0003_part1_campaign/encounters/stage_1_1.json'));

describe('signature weapon passives (content/balance/gear_passives.json)', () => {
  it('covers every signature weapon exactly once', () => {
    const ids = weapons.filter((w) => w.passive_effect_id).map((w) => w.passive_effect_id!);
    expect(Object.keys(table).sort()).toEqual([...new Set(ids)].sort());
  });

  for (const [passiveId, raw] of Object.entries(table)) {
    it(`${passiveId} fires after its owner's ultimate and applies its effects`, () => {
      const hook = EventHook.parse(raw);
      const owner = weapons.find((w) => w.passive_effect_id === passiveId)!.owner_character_id!;
      const party = BattleParty.parse([{ unit_id: owner, level: 10, slot: 0, row: 'front', start_focus: 100, equipment_effects: { version: 1, hooks: [hook] } }]);
      const b = Battle.create(pack, encounter, party);
      const me = `player:0:${owner}`;
      let step = b.advance();
      let after: BattleEvent[] | null = null;
      for (let i = 0; i < 30 && step.prompt && !after; i++) {
        const ult = step.prompt.actor === me ? step.prompt.options.find((o) => o.type === 'ultimate' && o.available) : undefined;
        step = b.act(ult ? { skillId: ult.skillId, ...(ult.needsTarget ? { targetId: ult.legalTargets[0]! } : {}) } : b.autoAction());
        if (ult) after = step.events;
      }
      expect(after, 'the owner never reached an available ultimate').not.toBeNull();
      const at = after!.findIndex((e) => e.type === 'hook_triggered' && e.unit === me && e.event === 'after_ally_ultimate');
      expect(at, 'the signature hook did not trigger').toBeGreaterThanOrEqual(0);
      // something visible follows the hook (status, stat change, shield, heal, focus, cleanse, cooldown ...)
      expect(after!.slice(at + 1).length).toBeGreaterThan(0);
    });
  }
});
