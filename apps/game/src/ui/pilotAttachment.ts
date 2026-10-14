import { UNIT_ANIM_STATES, type UnitAnimState } from '@uomd/content-schema';

/**
 * R15 — Small visual pilot and character attachment contract.
 * Locks the original Fadyme/Mahmut identity pilot, adult-age provenance,
 * costume/hood-versus-cape resolution, studio mark decision, eight-pose chibi
 * alignment contract, portrait expression sets, relationship/bond metadata,
 * tactical role tags, and separation of third-party engine credits from project art.
 */

export type PilotCharacterId = 'fadyme' | 'mahmut';

export interface RelationshipBond {
  partnerId: string;
  partnerName: string;
  bondTitle: string;
  summary: string;
}

export interface TacticalRoleProfile {
  roleTag: string;
  synergyTag: string;
  formationSlot: 'frontline' | 'backline' | 'flex';
  summary: string;
}

export interface PilotIdentityAnchor {
  characterId: PilotCharacterId;
  displayName: string;
  adultAge: number;
  reunionPlateAge: number;
  pilotTier: 'locked_pilot_p0';
  /** Explicit resolution of the reference hood-versus-cape / costume conflict. */
  costumeDecision: {
    selectedVariant: 'hooded_pilgrim_mantle' | 'tattered_oxblood_half_plate';
    summary: string;
    distinctProps: readonly string[];
    rejectedLegacyMotifs: readonly string[];
  };
  expressions: {
    tutorial: readonly string[];
    storyExtended: readonly string[];
    cropRule: {
      aspectRatio: '2:3';
      eyeBandTopFraction: readonly [number, number];
      visibleUpperFraction: number;
      facing: 'viewer_right' | 'viewer_left';
    };
  };
  chibiContract: {
    poses: readonly UnitAnimState[];
    grid: '4x2';
    facing: 'right';
    heightPx: number;
    footY: number;
    minGutterFraction: number;
  };
  relationshipBond: RelationshipBond;
  tacticalProfile: TacticalRoleProfile;
}

export const PILOT_IDENTITY_ANCHORS: Readonly<Record<PilotCharacterId, PilotIdentityAnchor>> = {
  fadyme: {
    characterId: 'fadyme',
    displayName: 'Fadyme',
    adultAge: 22,
    reunionPlateAge: 20,
    pilotTier: 'locked_pilot_p0',
    costumeDecision: {
      selectedVariant: 'hooded_pilgrim_mantle',
      summary:
        'Deep plum Saint Luthos hooded pilgrim mantle raised over a high-collar black dress with silver-lilac embroidery and high clean white scarf; resolves hood-vs-cape conflict in favor of the raised hood.',
      distinctProps: [
        'broken_silver_crown_clasp_above_brow',
        'house_veyr_tiny_silver_bell_hairpin',
        'silver_chain_bell_with_thorn_clapper'
      ],
      rejectedLegacyMotifs: [
        'crimson_burgundy_legacy_cape',
        'cross_shaped_clasp_pins',
        'tiara_circlet_crown',
        'bone_white_lock_before_5_4'
      ]
    },
    expressions: {
      tutorial: ['composed', 'dry_amusement', 'soft_smile', 'determined'],
      storyExtended: ['quiet_pain', 'honest_fear'],
      cropRule: {
        aspectRatio: '2:3',
        eyeBandTopFraction: [0.24, 0.3],
        visibleUpperFraction: 0.7,
        facing: 'viewer_right'
      }
    },
    chibiContract: {
      poses: UNIT_ANIM_STATES,
      grid: '4x2',
      facing: 'right',
      heightPx: 360,
      footY: 0.985,
      minGutterFraction: 0.08
    },
    relationshipBond: {
      partnerId: 'mahmut',
      partnerName: 'Mahmut',
      bondTitle: 'Unspoken Watch of the Road',
      summary: 'Walks beside Mahmut since the hill-village reunion; trusts his shield before her own bell.'
    },
    tacticalProfile: {
      roleTag: 'Veil Support-DPS · Bell Resonance',
      synergyTag: 'Pairs with Stone Vanguard',
      formationSlot: 'backline',
      summary: 'Weaves Veil thorns and Borrowed Hour tempo from the back row while shielded from Break pressure.'
    }
  },
  mahmut: {
    characterId: 'mahmut',
    displayName: 'Mahmut',
    adultAge: 28,
    reunionPlateAge: 26,
    pilotTier: 'locked_pilot_p0',
    costumeDecision: {
      selectedVariant: 'tattered_oxblood_half_plate',
      summary:
        'Dark worn village-repaired Guard half-plate with Crown Guard star and hammered-empty crown socket beneath a dyed tattered oxblood cloak (darker than UI crimson) and scarred leather gloves.',
      distinctProps: [
        'crown_guard_star_with_empty_crown_socket',
        'repaired_heater_shield_with_yseldra_rim_seal',
        'arming_sword_with_iron_filled_crest_socket'
      ],
      rejectedLegacyMotifs: [
        'intact_royal_crown_crest',
        'bright_ui_crimson_cape',
        'ornate_plate_gauntlets',
        'closed_knight_helm_in_portraits'
      ]
    },
    expressions: {
      tutorial: ['composed', 'watchful', 'protective', 'dry_humor'],
      storyExtended: [],
      cropRule: {
        aspectRatio: '2:3',
        eyeBandTopFraction: [0.24, 0.3],
        visibleUpperFraction: 0.7,
        facing: 'viewer_left'
      }
    },
    chibiContract: {
      poses: UNIT_ANIM_STATES,
      grid: '4x2',
      facing: 'right',
      heightPx: 360,
      footY: 0.985,
      minGutterFraction: 0.08
    },
    relationshipBond: {
      partnerId: 'fadyme',
      partnerName: 'Fadyme',
      bondTitle: 'Oathless Guard of the Last Bell',
      summary: 'Hammered the royal crest from his armor and walked every winter road until he found her.'
    },
    tacticalProfile: {
      roleTag: 'Stone Tank-Bruiser · Vanguard Wall',
      synergyTag: 'Protects Veil & Dawn Casters',
      formationSlot: 'frontline',
      summary: 'Anchors the front column with Broken Crest Guard and Last Wall at Dusk to absorb boss telegraphs.'
    }
  }
};

export interface StudioMarkDecisionRecord {
  activeMode: 'hairline_diamond_ornament' | 'silver_gold_glyph_candidate';
  studioDisplayName: string;
  nameClearanceStatus: 'preliminary_text_ornament_default';
  rules: readonly string[];
}

/** Explicit studio mark resolution (R15): keeps hairline diamond ornament until trademark clearance; bans game-logo motifs and legacy raven/hourglass. */
export const STUDIO_MARK_DECISION: StudioMarkDecisionRecord = {
  activeMode: 'hairline_diamond_ornament',
  studioDisplayName: 'SovTaym Studios',
  nameClearanceStatus: 'preliminary_text_ornament_default',
  rules: [
    'Default runtime card uses the procedural gold hairline-and-diamond ornament in StudioScene until studio name clearance is finalized.',
    'If a studio_mark glyph is commissioned, it must use silver/old-gold (#C9B6E4 / #B8975A) on #00FF00 chroma key with zero letters.',
    'Never borrow the game logo motifs (House Veyr bell, broken crown fragment, or crimson eclipse ring) for the studio mark.',
    'Archived non-Google raven/hourglass emblem is excluded from runtime and reference conditioning.'
  ]
};

export interface ThirdPartyCreditEntry {
  id: string;
  name: string;
  category: 'engine_runtime' | 'native_shell' | 'cloud_edge' | 'typography_cc0_vfx';
  license: string;
  attributionNote: string;
}

/** Preserves approved third-party engine/runtime credits strictly separate from generated or authored project art provenance. */
export const THIRD_PARTY_ENGINE_CREDITS: readonly ThirdPartyCreditEntry[] = [
  {
    id: 'phaser4',
    name: 'Phaser 4',
    category: 'engine_runtime',
    license: 'MIT',
    attributionNote: '2D WebGL/Canvas game runtime; separate from UOMD generated/authored art assets.'
  },
  {
    id: 'capacitor',
    name: 'Ionic Capacitor',
    category: 'native_shell',
    license: 'MIT',
    attributionNote: 'Android native bridge and WebView host container.'
  },
  {
    id: 'cloudflare_workers_d1',
    name: 'Cloudflare Workers & D1',
    category: 'cloud_edge',
    license: 'Apache-2.0 / Service Terms',
    attributionNote: 'Authoritative edge runtime, SQLite persistence, and R2 signed patch storage.'
  },
  {
    id: 'cinzel_cormorant_cc0_vfx',
    name: 'Cinzel & Cormorant Garamond Fonts / CC0 Particle Primitives',
    category: 'typography_cc0_vfx',
    license: 'OFL-1.1 / CC0-1.0',
    attributionNote: 'Display/body typography and non-character atmospheric spark/ash primitives.'
  }
];

export interface CompanionAttachmentSummary {
  characterId: string;
  isPilotAnchor: boolean;
  adultAge: number | null;
  bondTitle: string;
  bondLine: string;
  tacticalBadge: string;
  formationSlot: 'frontline' | 'backline' | 'flex';
  availableExpressions: readonly string[];
  costumeNote: string;
}

const COMPANION_BONDS: Readonly<Record<string, Omit<CompanionAttachmentSummary, 'characterId'>>> = {
  fadyme: {
    isPilotAnchor: true,
    adultAge: 22,
    bondTitle: 'Bond · Mahmut (Unspoken Watch)',
    bondLine: 'Trusts Mahmut’s battered heater shield before her own House Veyr bell.',
    tacticalBadge: 'Backline Veil Support-DPS · Bell Resonance',
    formationSlot: 'backline',
    availableExpressions: PILOT_IDENTITY_ANCHORS.fadyme.expressions.tutorial,
    costumeNote: 'Raised plum pilgrim hood · broken silver crown clasp · white scarf'
  },
  mahmut: {
    isPilotAnchor: true,
    adultAge: 28,
    bondTitle: 'Bond · Fadyme (Oathless Guard)',
    bondLine: 'Hammered the royal crest from his breastplate; guards Fadyme across every road.',
    tacticalBadge: 'Frontline Stone Tank-Bruiser · Vanguard Wall',
    formationSlot: 'frontline',
    availableExpressions: PILOT_IDENTITY_ANCHORS.mahmut.expressions.tutorial,
    costumeNote: 'Village-repaired Guard half-plate · empty crown socket · tattered oxblood cloak'
  },
  iona: {
    isPilotAnchor: false,
    adultAge: 25,
    bondTitle: 'Bond · First Oath Ledger Keeper',
    bondLine: 'Keeps the unclosed names of the river parishes in dry ink.',
    tacticalBadge: 'Backline Dawn Healer-Support · Witness Ward',
    formationSlot: 'backline',
    availableExpressions: ['composed', 'determined'],
    costumeNote: 'Chapel-grey travel coat · brass ink-horn · linen stole'
  },
  yseldra: {
    isPilotAnchor: false,
    adultAge: 31,
    bondTitle: 'Bond · Seal of the Border Watch',
    bondLine: 'Pressed her wax seal into the rim of Mahmut’s shield on the night of departure.',
    tacticalBadge: 'Frontline Ember Bruiser · Sealbreaker',
    formationSlot: 'frontline',
    availableExpressions: ['composed', 'determined'],
    costumeNote: 'Charred surcoat · wax-sealed shoulder guard'
  },
  marek: {
    isPilotAnchor: false,
    adultAge: 34,
    bondTitle: 'Bond · Remnant of the Old Guard',
    bondLine: 'Recognizes the hammered-empty socket above the star on Mahmut’s breastplate.',
    tacticalBadge: 'Frontline Stone Defender · Halberd Line',
    formationSlot: 'frontline',
    availableExpressions: ['composed', 'watchful'],
    costumeNote: 'Weathered brigade brigandine · notched polearm'
  }
};

export function describeCompanionAttachment(
  characterId: string,
  element = 'Veil',
  role = 'specialist'
): CompanionAttachmentSummary {
  const known = COMPANION_BONDS[characterId];
  if (known) return { characterId, ...known };
  const cleanRole = role.replaceAll('_', ' ');
  const isFront = /tank|bruiser|vanguard|defender/i.test(cleanRole);
  return {
    characterId,
    isPilotAnchor: false,
    adultAge: null,
    bondTitle: 'Bond · Company of the Unclosed Hours',
    bondLine: 'Travels under the road truce alongside Fadyme and Mahmut.',
    tacticalBadge: `${isFront ? 'Frontline' : 'Backline'} ${element} ${cleanRole}`,
    formationSlot: isFront ? 'frontline' : 'backline',
    availableExpressions: ['composed'],
    costumeNote: 'Road-worn company attire'
  };
}

export function nextPortraitExpression(characterId: string, currentExpression: string): string {
  const summary = describeCompanionAttachment(characterId);
  const list = summary.availableExpressions;
  if (list.length === 0) return 'composed';
  const idx = list.indexOf(currentExpression);
  return list[(idx + 1) % list.length]!;
}

export interface PilotPoseAuditResult {
  valid: boolean;
  missingStates: UnitAnimState[];
  errors: string[];
}

/** Verifies that a unit's loaded or declared state map satisfies the R15 eight-pose chibi alignment contract. */
export function verifyPilotPoseContract(
  characterId: PilotCharacterId,
  unitArt: {
    facing: 'left' | 'right';
    heightPx: number;
    states: Record<string, { frame: string; scale: number; footY: number; pivotX: number }>;
  }
): PilotPoseAuditResult {
  const anchor = PILOT_IDENTITY_ANCHORS[characterId];
  const missingStates: UnitAnimState[] = [];
  const errors: string[] = [];

  if (unitArt.facing !== anchor.chibiContract.facing) {
    errors.push(`Expected facing '${anchor.chibiContract.facing}', got '${unitArt.facing}'`);
  }
  if (unitArt.heightPx < 240 || unitArt.heightPx > 440) {
    errors.push(`Unit heightPx (${unitArt.heightPx}) outside readable chibi range [240, 440]`);
  }

  for (const state of anchor.chibiContract.poses) {
    const entry = unitArt.states[state];
    if (!entry) {
      missingStates.push(state);
      continue;
    }
    if (entry.footY < 0.9 || entry.footY > 1.0) {
      errors.push(`Pose '${state}' footY (${entry.footY}) must plant sole near [0.90, 1.00]`);
    }
    if (entry.pivotX < 0.2 || entry.pivotX > 0.8) {
      errors.push(`Pose '${state}' pivotX (${entry.pivotX}) outside balanced [0.20, 0.80] centroid`);
    }
  }

  if (missingStates.length > 0) {
    errors.push(`Missing required chibi poses: ${missingStates.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    missingStates,
    errors
  };
}
