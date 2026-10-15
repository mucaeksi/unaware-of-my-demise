import { describe, expect, it } from 'vitest';
import { Encounter, UnitDef } from '@uomd/content-schema';
import { Battle, playAuto, replayBattle, type BattleEvent } from './index';
import { basePack, encounterT1, noCrit, patchUnit } from './fixtures';

const events = <T extends BattleEvent['type']>(log: BattleEvent[], type: T): Extract<BattleEvent, { type: T }>[] =>
  log.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

const FADYME = 'player:1:fadyme';
const E0 = 'enemy:0:bellbound_dead';

describe('effect_res & element_res', () => {
  it('mitigates hostile status application via UnitDef.effect_res and emits status_resisted', () => {
    const pack = patchUnit(noCrit(basePack()), 'bellbound_dead', (u) => ({
      ...u,
      effect_res: 1.0
    }));
    const parsed = UnitDef.parse(pack.units.find((u) => u.unit_id === 'bellbound_dead'));
    expect(parsed.effect_res).toBe(1.0);

    const b = Battle.create(pack, encounterT1());
    b.advance();
    const step = b.act({ skillId: 'fadyme_active_borrowed_hour', targetId: E0 });
    expect(events(step.events, 'status_applied').filter((s) => s.target === E0 && s.status === 'dread')).toHaveLength(0);
    expect(events(step.events, 'status_resisted')).toContainEqual({
      type: 'status_resisted',
      source: FADYME,
      target: E0,
      status: 'dread'
    });
  });

  it('mitigates incoming elemental damage via UnitDef.element_res and EquipmentEffects.element_res_pct', () => {
    const base = Battle.create(noCrit(basePack()), encounterT1());
    base.advance();
    const baseStep = base.act({ skillId: 'fadyme_active_borrowed_hour', targetId: E0 });
    const baseDmg = events(baseStep.events, 'damage').find((d) => d.source === FADYME)?.amount ?? 0;
    expect(baseDmg).toBe(4); // floor(3 * 1.6 * 0.9 = 4.32)

    const resistPack = patchUnit(noCrit(basePack()), 'bellbound_dead', (u) => ({
      ...u,
      element_res: { Veil: 0.5 }
    }));
    const resisted = Battle.create(resistPack, encounterT1());
    resisted.advance();
    const resStep = resisted.act({ skillId: 'fadyme_active_borrowed_hour', targetId: E0 });
    const resDmg = events(resStep.events, 'damage').find((d) => d.source === FADYME)?.amount ?? 0;
    expect(resDmg).toBe(2); // floor(4.32 * 0.5 = 2.16)
  });

  it('supports equipment_effects.effect_res_pct and modify_stat effect_res on party members', () => {
    const enc = encounterT1();
    const b = Battle.create(noCrit(basePack()), enc, [
      { unit_id: 'mahmut', level: 1, slot: 0, row: 'front', equipment_effects: { version: 1, effect_res_pct: 0.4, element_res_pct: { Dusk: 0.25 } } },
      { unit_id: 'fadyme', level: 1, slot: 1, row: 'rear', equipment_effects: { version: 1, effect_res_pct: 0.2 } }
    ]);
    const mahmut = b.unit('player:0:mahmut');
    expect(b.effEffectRes(mahmut)).toBeCloseTo(0.4);
    expect(b.effElementResMult(mahmut, 'Dusk')).toBeCloseTo(0.75);
  });
});

describe('multi-wave encounters', () => {
  it('validates Encounter.waves schema and rejects duplicate slots within a wave', () => {
    const valid = Encounter.parse({
      ...encounterT1(),
      waves: [
        [{ unit_id: 'bellbound_dead', level: 1, slot: 0, row: 'front' }],
        [
          { unit_id: 'bellbound_dead', level: 1, slot: 0, row: 'front' },
          { unit_id: 'hollow_pilgrim', level: 1, slot: 2, row: 'rear' }
        ]
      ]
    });
    expect(valid.waves).toHaveLength(2);

    expect(() =>
      Encounter.parse({
        ...encounterT1(),
        waves: [
          [
            { unit_id: 'bellbound_dead', level: 1, slot: 0, row: 'front' },
            { unit_id: 'hollow_pilgrim', level: 1, slot: 0, row: 'rear' }
          ]
        ]
      })
    ).toThrow(/duplicate slot 0/);
  });

  it('spawns sequential enemy waves, preserves player state across waves, and replays deterministically', async () => {
    const multiEnc = Encounter.parse({
      ...encounterT1(),
      enemies: [{ unit_id: 'bellbound_dead', level: 1, slot: 0, row: 'front' }],
      waves: [
        [{ unit_id: 'bellbound_dead', level: 1, slot: 1, row: 'front' }],
        [{ unit_id: 'hollow_pilgrim', level: 1, slot: 2, row: 'rear' }]
      ]
    });

    const { battle, actions } = playAuto(noCrit(basePack()), multiEnc);
    expect(battle.totalWaves).toBe(3);
    expect(battle.wave).toBe(3);
    expect(battle.result?.winner).toBe('player');

    const waveStarts = events(battle.log, 'wave_start');
    expect(waveStarts).toEqual([
      { type: 'wave_start', wave: 2 },
      { type: 'wave_start', wave: 3 }
    ]);

    const replay = await replayBattle(noCrit(basePack()), multiEnc, actions);
    expect(replay.valid).toBe(true);
    expect(replay.complete).toBe(true);
    expect(replay.result).toEqual(battle.result);
  });
});
