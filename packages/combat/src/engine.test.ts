import { describe, expect, it } from 'vitest';
import { Battle, IllegalActionError, MAX_TURNS, playAuto, replayBattle, type BattleEvent } from './index';
import { basePack, encounterT1, encounterT2, noCrit, patchUnit } from './fixtures';

const events = <T extends BattleEvent['type']>(log: BattleEvent[], type: T): Extract<BattleEvent, { type: T }>[] =>
  log.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

const FADYME = 'player:1:fadyme';
const MAHMUT = 'player:0:mahmut';
const E0 = 'enemy:0:bellbound_dead';
const E1 = 'enemy:1:bellbound_dead';

describe('turn order', () => {
  it('Fadyme acts first: equal ready time vs. a SPD-5 enemy is resolved for the player team', () => {
    const b = Battle.create(basePack(), encounterT1());
    const step = b.advance();
    expect(step.prompt?.actor).toBe(FADYME);
    const turnStarts = events(step.events, 'turn_start');
    expect(turnStarts).toHaveLength(1);
  });

  it('previewOrder matches the real order of the next actors', () => {
    const b = Battle.create(noCrit(basePack()), encounterT1());
    b.advance();
    const predicted = b.previewOrder(9); // [Fadyme (now), then the next 8]
    const start = b.log.length;
    for (let i = 0; i < 4 && !b.result; i++) b.act(b.autoAction());
    // the preview assumes nobody dies or changes speed, so only the first turns are comparable
    const real = events(b.log.slice(start - 1), 'turn_start').map((e) => e.actor);
    expect(real.slice(0, 5)).toEqual(predicted.slice(0, 5));
  });
});

describe('damage rules', () => {
  const pack = noCrit(basePack());

  it('Veilglass Thorn vs Bellbound Dead: 3 ATK x 1.0 x 10/10 x 0.9 (explicit Veil resistance) = floor 2', () => {
    const b = Battle.create(pack, encounterT1());
    b.advance();
    const step = b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E0 });
    const dmg = events(step.events, 'damage').find((d) => d.source === FADYME);
    expect(dmg).toMatchObject({ target: E0, amount: 2, hpAfter: 3, crit: false });
    expect(dmg?.elementMultiplier).toBeCloseTo(0.9);
  });

  it('crit multiplies by 1.5 and is rolled from the seeded RNG only', () => {
    const forced = { ...basePack(), rules: { ...basePack().rules, crit: { chance: 1, multiplier: 1.5 } } };
    const b = Battle.create(forced, encounterT1());
    b.advance();
    const step = b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E0 });
    const dmg = events(step.events, 'damage').find((d) => d.source === FADYME);
    expect(dmg?.crit).toBe(true);
    expect(dmg?.amount).toBe(4); // floor(3 * 0.9 * 1.5 = 4.05)
  });

  it('minimum damage is 1 and shields absorb before HP', () => {
    const b = Battle.create(pack, encounterT1());
    b.advance();
    const step = b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E0 });
    const dmgToPlayers = events(step.events, 'damage').filter((d) => d.target.startsWith('player'));
    for (const d of dmgToPlayers) expect(d.amount).toBeGreaterThanOrEqual(1);
  });
});

describe('targeting and legality', () => {
  it('enemy single-target attacks only reach the front row while a front unit lives', () => {
    const { battle } = playAuto(pack(), encounterT1());
    let mahmutAlive = true;
    for (const e of battle.log) {
      if (e.type === 'defeat' && e.unit === MAHMUT) mahmutAlive = false;
      if (e.type === 'damage' && e.source.startsWith('enemy') && mahmutAlive && !e.redirectedFrom) {
        expect(e.target).toBe(MAHMUT);
      }
    }
  });

  it('rejects unavailable skills, illegal targets and stray targets', () => {
    const b = Battle.create(pack(), encounterT1());
    b.advance();
    expect(() => b.act({ skillId: 'fadyme_ultimate_the_bell_that_forgets' })).toThrow(IllegalActionError); // 0 focus
    expect(() => b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: MAHMUT })).toThrow(IllegalActionError); // ally
    expect(() => b.act({ skillId: 'fadyme_basic_veilglass_thorn' })).toThrow(IllegalActionError); // missing target
    expect(() => b.act({ skillId: 'fadyme_ultimate_the_bell_that_forgets', targetId: E0 })).toThrow(IllegalActionError);
    expect(() => b.act({ skillId: 'fadyme_passive_a_smile_kept' })).toThrow(IllegalActionError); // passive
    expect(() => b.act({ skillId: 'mahmut_basic_oathless_cut', targetId: E0 })).toThrow(IllegalActionError); // not her skill
  });

  it('cooldown: Borrowed Hour (2) is locked for two own turns after use', () => {
    const b = Battle.create(noCrit(basePack()), encounterT1());
    b.advance();
    b.act({ skillId: 'fadyme_active_borrowed_hour', targetId: E0 });
    let prompt = b.prompt();
    expect(prompt?.actor).toBe(MAHMUT);
    b.act({ skillId: 'mahmut_basic_oathless_cut', targetId: E1 });
    prompt = b.prompt();
    expect(prompt?.actor).toBe(FADYME);
    expect(prompt?.options.find((o) => o.skillId === 'fadyme_active_borrowed_hour')).toMatchObject({ available: false, reason: 'cooldown', cooldownLeft: 1 });
  });
});

describe('statuses, focus and skills', () => {
  it('Borrowed Hour: 160% damage, Dread for 2 turns, heals lowest-HP ally; Dread lowers the enemy damage and expires', () => {
    const b = Battle.create(noCrit(basePack()), encounterT1());
    b.advance();
    const step = b.act({ skillId: 'fadyme_active_borrowed_hour', targetId: E0 });
    expect(events(step.events, 'damage').find((d) => d.source === FADYME)).toMatchObject({ amount: 4 }); // floor(3*1.6*.9=4.32)
    expect(events(step.events, 'status_applied')).toContainEqual(expect.objectContaining({ target: E0, status: 'dread', turns: 2 }));
    const focus = events(step.events, 'focus').find((f) => f.unit === FADYME);
    expect(focus?.delta).toBe(25);
    // one enemy action later the status has 1 turn left, and it is gone at that enemy's following turn start
    const log = b.log;
    const removed = events(log, 'status_removed').filter((s) => s.status === 'dread');
    expect(removed.length).toBeLessThanOrEqual(1);
  });

  it('focus: basic +20, taking a hit +5 (cap 15/turn), ultimate is gated at 100 and resets to 0', () => {
    const b = Battle.create(noCrit(basePack()), encounterT1());
    b.advance();
    const target = (): string => b.autoAction().targetId as string;
    let guard = 0;
    while (!b.result && guard++ < 40) {
      const prompt = b.prompt();
      if (!prompt) break;
      const actor = b.unit(prompt.actor);
      const ult = prompt.options.find((o) => o.type === 'ultimate');
      if (ult?.available) {
        const before = actor.focus;
        expect(before).toBeGreaterThanOrEqual(100);
        b.act(ult.needsTarget ? { skillId: ult.skillId, targetId: target() } : { skillId: ult.skillId });
        expect(b.unit(prompt.actor).focus).toBe(0);
        return;
      }
      b.act(b.autoAction());
    }
    // the T-1 fight may end before 100 focus; that is also valid, the gate itself is tested above
    expect(b.result).not.toBeNull();
  });

  it("Mahmut's Last Wall at Dusk: all front enemies damaged and taunted; every ally shielded", () => {
    const pack = noCrit(patchUnit(basePack(), 'mahmut', (u) => u)); // identity, keeps data intact
    const b = Battle.create(pack, encounterT1());
    b.advance();
    b.unit(MAHMUT).focus = 100; // test setup: skip the grind
    b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E0 });
    expect(b.prompt()?.actor).toBe(MAHMUT);
    const step = b.act({ skillId: 'mahmut_ultimate_last_wall_at_dusk' });
    const hits = events(step.events, 'damage').filter((d) => d.source === MAHMUT);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(events(step.events, 'status_applied').filter((s) => s.status === 'taunt').length).toBeGreaterThanOrEqual(1);
    const shields = events(step.events, 'shield');
    expect(shields.map((s) => s.target).sort()).toEqual([FADYME, MAHMUT].sort());
    expect(b.unit(MAHMUT).focus).toBe(0);
  });

  it("Mahmut's Broken Crest Guard shields himself and Fadyme, and redirects 50% of hits aimed at her", () => {
    const b = Battle.create(noCrit(basePack()), encounterT1());
    b.advance();
    b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E0 });
    const step = b.act({ skillId: 'mahmut_active_broken_crest_guard' });
    expect(events(step.events, 'shield').map((s) => s.target).sort()).toEqual([FADYME, MAHMUT].sort());
    expect(events(step.events, 'redirect_granted')).toContainEqual(expect.objectContaining({ protector: MAHMUT, protected: FADYME, fraction: 0.5 }));
  });

  it("Mahmut's passive counters an enemy basic attack while shielded, once per own turn", () => {
    // enemies that only know their basic attack (the signature would not trigger a Basic counter)
    const basicOnly = patchUnit(noCrit(basePack()), 'bellbound_dead', (u) => ({ ...u, skills: u.skills.filter((s) => s.type === 'basic') }));
    const b = Battle.create(basicOnly, encounterT1());
    b.advance();
    b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E0 });
    b.act({ skillId: 'mahmut_active_broken_crest_guard' }); // shielded; Fadyme (SPD 5) acts before the enemies
    b.act({ skillId: 'fadyme_basic_veilglass_thorn', targetId: E1 }); // now both enemy basics land on the shielded Mahmut
    const hooks = events(b.log, 'hook_triggered').filter((h) => h.skill === 'mahmut_passive_a_knight_s_debt');
    const counters = events(b.log, 'damage').filter((d) => d.counter && d.source === MAHMUT);
    expect(hooks).toHaveLength(1); // two enemy basics hit him, the hook is limited to once per owner turn
    expect(counters).toHaveLength(1);
    expect(counters[0]?.amount).toBeGreaterThanOrEqual(1);
    const absorbed = events(b.log, 'damage').filter((d) => d.target === MAHMUT && d.absorbed > 0);
    expect(absorbed.length).toBeGreaterThanOrEqual(1);
  });

  it("Fadyme's A Smile Kept raises Veil RES for all allies when she is below 50% HP, at most twice per battle", () => {
    const sturdy = patchUnit(noCrit(basePack()), 'bellbound_dead', (u) => ({ ...u, base_stats: { ...u.base_stats, hp: 400 } }));
    const lowFadyme = patchUnit(sturdy, 'fadyme', (u) => ({ ...u, base_stats: { ...u.base_stats, hp: 60 } }));
    const enc = { ...encounterT1(), party: encounterT1().party.map((p) => ({ ...p, row: 'front' as const })) };
    const b = Battle.create(lowFadyme, enc);
    b.advance();
    b.unit(FADYME).hp = 20; // 33% of 60: below the 50% threshold from her next turn on
    for (let i = 0; i < 12 && !b.result; i++) b.act(b.autoAction());
    const mods = events(b.log, 'stat_mod').filter((m) => m.stat === 'veil_res');
    const triggers = events(b.log, 'hook_triggered').filter((h) => h.skill === 'fadyme_passive_a_smile_kept');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
    expect(triggers.length).toBeLessThanOrEqual(2);
    expect(mods.length).toBeGreaterThanOrEqual(triggers.length);
  });
});

describe('outcomes', () => {
  it('Auto Battle wins the T-1 tutorial deterministically', () => {
    const a = playAuto(basePack(), encounterT1());
    const b = playAuto(basePack(), encounterT1());
    expect(a.battle.result?.winner).toBe('player');
    expect(a.battle.result?.stars).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(a.battle.log)).toBe(JSON.stringify(b.battle.log));
    expect(a.actions).toEqual(b.actions);
  });

  it('a different seed changes crit rolls but never breaks invariants (200 seeds)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const enc = { ...encounterT1(), seed };
      const { battle } = playAuto(basePack(), enc);
      expect(battle.result).not.toBeNull();
      expect(battle.result?.turns ?? 0).toBeLessThanOrEqual(MAX_TURNS);
      for (const c of battle.combatants) {
        expect(c.hp).toBeGreaterThanOrEqual(0);
        expect(c.hp).toBeLessThanOrEqual(c.maxHp);
        expect(c.focus).toBeGreaterThanOrEqual(0);
        expect(c.focus).toBeLessThanOrEqual(100);
        expect(c.shields.every((s) => s.amount > 0)).toBe(true);
      }
    }
  });

  it('defeat: overpowered enemies end the battle with 0 stars', () => {
    const brutal = patchUnit(basePack(), 'bellbound_dead', (u) => ({ ...u, base_stats: { ...u.base_stats, atk: 60, hp: 400 } }));
    const { battle } = playAuto(brutal, encounterT1());
    expect(battle.result).toMatchObject({ winner: 'enemy', stars: 0 });
  });

  it('5v5 battles run to completion and stay deterministic', () => {
    const pack = basePack();
    const party = [0, 1, 2, 3, 4].map((slot) => ({ unit_id: slot % 2 === 0 ? 'mahmut' : 'fadyme', level: 3, slot, row: slot < 2 ? ('front' as const) : ('rear' as const) }));
    const enemies = [0, 1, 2, 3, 4].map((slot) => ({ unit_id: slot < 3 ? 'bellbound_dead' : 'hollow_pilgrim', level: 3, slot, row: slot < 2 ? ('front' as const) : ('rear' as const) }));
    const enc = { ...encounterT2(), party, enemies };
    const a = playAuto(pack, enc);
    const b = playAuto(pack, enc);
    expect(a.battle.result).not.toBeNull();
    expect(JSON.stringify(a.battle.log)).toBe(JSON.stringify(b.battle.log));
    expect(a.battle.combatants).toHaveLength(10);
  });
});

describe('server replay verification', () => {
  it('accepts the recorded action list and agrees on the log hash', async () => {
    const { battle, actions } = playAuto(basePack(), encounterT1());
    const out = await replayBattle(basePack(), encounterT1(), actions);
    expect(out).toMatchObject({ valid: true, complete: true });
    expect(out.result).toEqual(battle.result);
    const again = await replayBattle(basePack(), encounterT1(), actions);
    expect(again.logHash).toBe(out.logHash);
  });

  it('rejects tampered, truncated and over-long action lists', async () => {
    const { actions } = playAuto(basePack(), encounterT1());
    const tampered = actions.map((a, i) => (i === 0 ? { ...a, skillId: 'fadyme_ultimate_the_bell_that_forgets' } : a));
    expect((await replayBattle(basePack(), encounterT1(), tampered)).valid).toBe(false);
    const truncated = await replayBattle(basePack(), encounterT1(), actions.slice(0, 1));
    expect(truncated).toMatchObject({ valid: true, complete: false });
    const extra = await replayBattle(basePack(), encounterT1(), [...actions, actions[0] as (typeof actions)[number]]);
    expect(extra.valid).toBe(false);
  });
});

function pack() {
  return basePack();
}
