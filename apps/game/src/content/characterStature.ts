import { REF_H } from '../config';

export interface CharacterStature {
  /** Canonical physical height in centimeters. */
  heightCm: number;
  /** Target portrait container height in 1920x1080 VN scenes. */
  vnTargetHeight: number;
  /** Baseline Y position for the bottom of the knee-up portrait in 1920x1080 VN scenes. */
  vnBaseY: number;
  /** Native facing direction of the character's portrait art ('left' | 'right'). */
  nativeFacing?: 'left' | 'right';
}

/**
 * Canonical physical stature table for all playable heroes, companions, and story NPCs across the game.
 * Ensures tall vanguards/warders (e.g. Mahmut 190cm, Garrick 195cm, Corbin 191cm) visibly tower over
 * medium and petite characters (e.g. Fadyme 161cm, Nixie 159cm, Pippa 154cm) in every Visual Novel cutscene,
 * while battle SD Chibi sprites keep their compact 2-head chibi proportions.
 */
const STATURE_TABLE: Readonly<Record<string, CharacterStature>> = {
  // Colossal / Heavy Vanguards & Templars (186cm - 196cm)
  garrick_cinder: { heightCm: 195, vnTargetHeight: 1255, vnBaseY: REF_H + 8, nativeFacing: 'right' },
  corbin_locke: { heightCm: 191, vnTargetHeight: 1235, vnBaseY: REF_H + 10, nativeFacing: 'right' },
  mahmut: { heightCm: 190, vnTargetHeight: 1185, vnBaseY: REF_H + 10, nativeFacing: 'right' },
  cassian_thorne: { heightCm: 188, vnTargetHeight: 1210, vnBaseY: REF_H + 12, nativeFacing: 'right' },
  marek_vane: { heightCm: 185, vnTargetHeight: 1190, vnBaseY: REF_H + 14, nativeFacing: 'right' },
  brin_alder: { heightCm: 184, vnTargetHeight: 1180, vnBaseY: REF_H + 14, nativeFacing: 'right' },
  jori_flint: { heightCm: 182, vnTargetHeight: 1168, vnBaseY: REF_H + 16, nativeFacing: 'right' },
  dorian_kesk: { heightCm: 181, vnTargetHeight: 1160, vnBaseY: REF_H + 16, nativeFacing: 'right' },

  // Tall / Medium-Tall Guardians & Marksmen (172cm - 179cm)
  nara_vell: { heightCm: 178, vnTargetHeight: 1138, vnBaseY: REF_H + 18, nativeFacing: 'left' },
  rowan_reed: { heightCm: 174, vnTargetHeight: 1110, vnBaseY: REF_H + 20, nativeFacing: 'right' },
  odelia_pike: { heightCm: 173, vnTargetHeight: 1102, vnBaseY: REF_H + 20, nativeFacing: 'left' },
  sister_aveline: { heightCm: 171, vnTargetHeight: 1088, vnBaseY: REF_H + 22, nativeFacing: 'left' },
  mirel_quill: { heightCm: 170, vnTargetHeight: 1080, vnBaseY: REF_H + 22, nativeFacing: 'left' },

  // Medium Stature Arcanists, Healers & Assassins (164cm - 169cm)
  vespera_wisp: { heightCm: 169, vnTargetHeight: 1072, vnBaseY: REF_H + 22, nativeFacing: 'left' },
  kera_voss: { heightCm: 168, vnTargetHeight: 1064, vnBaseY: REF_H + 24, nativeFacing: 'left' },
  tilda_fen: { heightCm: 167, vnTargetHeight: 1056, vnBaseY: REF_H + 24, nativeFacing: 'left' },
  iona_mist: { heightCm: 166, vnTargetHeight: 1048, vnBaseY: REF_H + 24, nativeFacing: 'left' },
  iona: { heightCm: 166, vnTargetHeight: 1048, vnBaseY: REF_H + 24, nativeFacing: 'left' },
  sable_wren: { heightCm: 165, vnTargetHeight: 1040, vnBaseY: REF_H + 25, nativeFacing: 'left' },

  // Slender / Petite Characters (154cm - 163cm)
  clem_marr: { heightCm: 162, vnTargetHeight: 1015, vnBaseY: REF_H + 26, nativeFacing: 'left' },
  fadyme: { heightCm: 161, vnTargetHeight: 1095, vnBaseY: REF_H + 18, nativeFacing: 'left' },
  thistle_roe: { heightCm: 160, vnTargetHeight: 990, vnBaseY: REF_H + 28, nativeFacing: 'left' },
  nixie_vale: { heightCm: 159, vnTargetHeight: 982, vnBaseY: REF_H + 30, nativeFacing: 'left' },
  hana_birch: { heightCm: 158, vnTargetHeight: 974, vnBaseY: REF_H + 30, nativeFacing: 'left' },
  rikka_ember: { heightCm: 156, vnTargetHeight: 960, vnBaseY: REF_H + 32, nativeFacing: 'left' },
  pippa_bell: { heightCm: 154, vnTargetHeight: 944, vnBaseY: REF_H + 34, nativeFacing: 'left' }
};

/** Returns the canonical VN stature for any character ID, with a deterministic height fallback for future patched characters. */
export function getCharacterStature(characterId: string): CharacterStature {
  const key = characterId.trim().toLowerCase();
  const known = STATURE_TABLE[key];
  if (known) return known;
  if (/knight|guard|vanguard|templar|captain|warden|pilgrim|construct|boss/.test(key)) {
    return { heightCm: 186, vnTargetHeight: 1195, vnBaseY: REF_H + 12, nativeFacing: 'right' };
  }
  return { heightCm: 168, vnTargetHeight: 1064, vnBaseY: REF_H + 24, nativeFacing: 'left' };
}
