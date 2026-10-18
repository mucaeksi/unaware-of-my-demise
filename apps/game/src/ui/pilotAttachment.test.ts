import { describe, expect, it } from 'vitest';
import { UNIT_ANIM_STATES } from '@uomd/content-schema';
import {
  PILOT_IDENTITY_ANCHORS,
  STUDIO_MARK_DECISION,
  THIRD_PARTY_ENGINE_CREDITS,
  describeCompanionAttachment,
  nextPortraitExpression,
  verifyPilotPoseContract
} from './pilotAttachment';

describe('R15 visual pilot, character attachment, and provenance contract', () => {
  it('locks Fadyme and Mahmut pilot identity anchors with adult-age provenance and resolved hood-vs-cape costume rules', () => {
    expect(PILOT_IDENTITY_ANCHORS.fadyme.adultAge).toBe(22);
    expect(PILOT_IDENTITY_ANCHORS.fadyme.reunionPlateAge).toBe(20);
    expect(PILOT_IDENTITY_ANCHORS.fadyme.costumeDecision.selectedVariant).toBe('hooded_pilgrim_mantle');
    expect(PILOT_IDENTITY_ANCHORS.fadyme.costumeDecision.distinctProps).toEqual([
      'broken_silver_crown_clasp_above_brow',
      'house_veyr_tiny_silver_bell_hairpin',
      'silver_chain_bell_with_thorn_clapper'
    ]);
    expect(PILOT_IDENTITY_ANCHORS.fadyme.costumeDecision.rejectedLegacyMotifs).toContain('crimson_burgundy_legacy_cape');

    expect(PILOT_IDENTITY_ANCHORS.mahmut.adultAge).toBe(28);
    expect(PILOT_IDENTITY_ANCHORS.mahmut.reunionPlateAge).toBe(26);
    expect(PILOT_IDENTITY_ANCHORS.mahmut.costumeDecision.selectedVariant).toBe('tattered_oxblood_half_plate');
    expect(PILOT_IDENTITY_ANCHORS.mahmut.costumeDecision.distinctProps).toContain('crown_guard_star_with_empty_crown_socket');
  });

  it('cycles portrait expressions across the canonical tutorial expression sets', () => {
    expect(nextPortraitExpression('fadyme', 'composed')).toBe('dry_amusement');
    expect(nextPortraitExpression('fadyme', 'dry_amusement')).toBe('soft_smile');
    expect(nextPortraitExpression('fadyme', 'soft_smile')).toBe('determined');
    expect(nextPortraitExpression('fadyme', 'determined')).toBe('composed');

    expect(nextPortraitExpression('mahmut', 'composed')).toBe('watchful');
    expect(nextPortraitExpression('mahmut', 'watchful')).toBe('protective');
    expect(nextPortraitExpression('mahmut', 'protective')).toBe('dry_humor');
    expect(nextPortraitExpression('mahmut', 'dry_humor')).toBe('composed');
  });

  it('describes relationship bonds and tactical roles for pilot heroes and general companions', () => {
    const fadyme = describeCompanionAttachment('fadyme', 'Veil', 'support_dps');
    expect(fadyme.isPilotAnchor).toBe(true);
    expect(fadyme.formationSlot).toBe('backline');
    expect(fadyme.bondTitle).toContain('Mahmut');

    const mahmut = describeCompanionAttachment('mahmut', 'Stone', 'tank_bruiser');
    expect(mahmut.isPilotAnchor).toBe(true);
    expect(mahmut.formationSlot).toBe('frontline');
    expect(mahmut.bondTitle).toContain('Fadyme');

    const custom = describeCompanionAttachment('new_season_warden', 'Dawn', 'vanguard_defender');
    expect(custom.isPilotAnchor).toBe(false);
    expect(custom.formationSlot).toBe('frontline');
    expect(custom.tacticalBadge).toContain('Frontline Dawn');
  });

  it('verifies the 8-pose chibi contract and flags missing poses or unplanted soles', () => {
    const validStates = Object.fromEntries(
      UNIT_ANIM_STATES.map((st) => [st, { frame: `${st}_0`, scale: 1, footY: 0.985, pivotX: 0.5 }])
    );
    const ok = verifyPilotPoseContract('fadyme', {
      facing: 'right',
      heightPx: 360,
      states: validStates
    });
    expect(ok.valid).toBe(true);
    expect(ok.missingStates).toEqual([]);

    const incomplete = { ...validStates };
    delete incomplete.ultimate;
    const bad = verifyPilotPoseContract('mahmut', {
      facing: 'left',
      heightPx: 360,
      states: incomplete
    });
    expect(bad.valid).toBe(false);
    expect(bad.missingStates).toEqual(['ultimate']);
    expect(bad.errors.some((e) => e.includes("Expected facing 'right'"))).toBe(true);
  });

  it('resolves the studio mark decision and keeps third-party engine credits separate from project art', () => {
    expect(STUDIO_MARK_DECISION.activeMode).toBe('hairline_diamond_ornament');
    expect(STUDIO_MARK_DECISION.rules.some((r) => r.includes('Never borrow the game logo motifs'))).toBe(true);
    expect(THIRD_PARTY_ENGINE_CREDITS.map((c) => c.id)).toContain('pixijs8');
    expect(THIRD_PARTY_ENGINE_CREDITS.map((c) => c.id)).toContain('phaser4');
    expect(THIRD_PARTY_ENGINE_CREDITS.every((c) => c.attributionNote.length > 10)).toBe(true);
  });
});
