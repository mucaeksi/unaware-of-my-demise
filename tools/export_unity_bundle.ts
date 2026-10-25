/**
 * Exports validated UOMD content, Unity bottom-left sprite/atlas metadata, and bit-exact C# core
 * primitives (Mulberry32 RNG, D-27 Stat Math, Trust Roots & Capabilities) for the Unity (C#) client
 * migration owned by Claude Opus 5.5 (Decision D-31).
 *
 * Usage:
 *   npx tsx tools/export_unity_bundle.ts [--out .cache/unity_bundle] [--dry-run]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArtManifest, CONTENT_CAPABILITIES, ContentManifest } from '@uomd/content-schema';
import { ATTRIBUTE_RULES } from '@uomd/economy';
import { assertTrustedKeys, type PublicKeyJwk } from '@uomd/shared';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export interface UnitySpriteSlice {
  name: string;
  /** Unity TextureImporter rect (origin at bottom-left of texture) */
  rect: { x: number; y: number; width: number; height: number };
  /** Original top-left rect from UOMD art_manifest.json */
  topLeftRect: [number, number, number, number];
  /** Normalized pivot in Unity coordinates (0,0 = bottom-left, 1,1 = top-right) */
  pivot: { x: number; y: number };
}

export interface UnityUnitAnimClip {
  state: string;
  stillFrame: string;
  scale: number;
  pivotX: number;
  footY: number;
  unityPivotY: number;
  fps: number;
  loop: boolean;
  frames: string[];
}

export interface UnityAtlasDescriptor {
  atlasId: string;
  imagePath: string;
  width: number;
  height: number;
  slices: UnitySpriteSlice[];
}

export interface UnityUnitDescriptor {
  unitArtKey: string;
  atlasId: string;
  facing: 'left' | 'right';
  heightPx: number;
  clips: UnityUnitAnimClip[];
}

export interface UnityArtExport {
  schema: 1;
  coordinateSystem: 'unity_bottom_left';
  referenceResolution: { width: 1920; height: 1080 };
  atlases: Record<string, UnityAtlasDescriptor>;
  units: Record<string, UnityUnitDescriptor>;
}

const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Converts a UOMD ArtManifest (top-left coordinates, foot_y measured from top) into Unity bottom-left
 * Sprite rects and normalized pivots `(pivot_x, 1 - foot_y)`.
 */
export function buildUnityArtMetadata(art: ArtManifest): UnityArtExport {
  const atlases: Record<string, UnityAtlasDescriptor> = {};
  const framePivots = new Map<string, { pivotX: number; footY: number }>();

  for (const unit of Object.values(art.units)) {
    for (const st of Object.values(unit.states)) {
      const key = `${unit.atlas}:${st.frame}`;
      if (!framePivots.has(key)) {
        framePivots.set(key, { pivotX: st.pivot_x, footY: st.foot_y });
      }
      for (const animFrame of st.animation?.frames ?? []) {
        const animKey = `${unit.atlas}:${animFrame}`;
        if (!framePivots.has(animKey)) {
          framePivots.set(animKey, { pivotX: st.pivot_x, footY: st.foot_y });
        }
      }
    }
  }

  for (const [atlasId, atlas] of Object.entries(art.atlases)) {
    const slices: UnitySpriteSlice[] = [];
    for (const [frameName, [x, y, w, h]] of Object.entries(atlas.frames)) {
      const piv = framePivots.get(`${atlasId}:${frameName}`) ?? { pivotX: 0.5, footY: 0.92 };
      slices.push({
        name: frameName,
        rect: {
          x,
          y: atlas.height - (y + h),
          width: w,
          height: h
        },
        topLeftRect: [x, y, w, h],
        pivot: {
          x: r4(piv.pivotX),
          y: r4(1 - piv.footY)
        }
      });
    }
    atlases[atlasId] = {
      atlasId,
      imagePath: atlas.image,
      width: atlas.width,
      height: atlas.height,
      slices
    };
  }

  const units: Record<string, UnityUnitDescriptor> = {};
  for (const [unitArtKey, unit] of Object.entries(art.units)) {
    const clips: UnityUnitAnimClip[] = [];
    for (const [stateName, st] of Object.entries(unit.states)) {
      clips.push({
        state: stateName,
        stillFrame: st.frame,
        scale: st.scale,
        pivotX: r4(st.pivot_x),
        footY: r4(st.foot_y),
        unityPivotY: r4(1 - st.foot_y),
        fps: st.animation?.fps ?? 1,
        loop: st.animation?.loop ?? false,
        frames: st.animation?.frames ?? [st.frame]
      });
    }
    units[unitArtKey] = {
      unitArtKey,
      atlasId: unit.atlas,
      facing: unit.facing,
      heightPx: unit.height_px,
      clips
    };
  }

  return {
    schema: 1,
    coordinateSystem: 'unity_bottom_left',
    referenceResolution: { width: 1920, height: 1080 },
    atlases,
    units
  };
}

/**
 * Generates the C# core primitives source file (`UomdCorePrimitives.g.cs`) so the Unity client matches
 * the Cloudflare Worker server's Mulberry32 PRNG, D-27 stat derivation, and trust roots bit-for-bit.
 */
export function generateCSharpCorePrimitives(trustedKeys: readonly PublicKeyJwk[]): string {
  assertTrustedKeys(trustedKeys);
  const capabilitiesLiteral = CONTENT_CAPABILITIES.map((c) => `"${c}"`).join(', ');
  const keysLiteral = trustedKeys
    .map(
      (k) =>
        `new TrustKeyJwk("${k.kid ?? ''}", "${k.kty}", "${k.crv}", "${k.x}", "${k.y}")`
    )
    .join(',\n            ');

  return `// <auto-generated>
// Generated by tools/export_unity_bundle.ts — DO NOT EDIT MANUALLY.
// Bit-exact C# ports of @uomd/shared (Mulberry32 RNG, trust roots) and @uomd/economy (D-27 stat math).
// </auto-generated>
#nullable enable
using System;
using System.Collections.Generic;

namespace Uomd.Core
{
    public readonly struct TrustKeyJwk
    {
        public readonly string Kid;
        public readonly string Kty;
        public readonly string Crv;
        public readonly string X;
        public readonly string Y;

        public TrustKeyJwk(string kid, string kty, string crv, string x, string y)
        {
            Kid = kid;
            Kty = kty;
            Crv = crv;
            X = x;
            Y = y;
        }
    }

    public static class UomdClientConfig
    {
        public const int ReferenceWidth = 1920;
        public const int ReferenceHeight = 1080;
        public const int SupportedContentSchema = 1;
        public const long PatchStorageBudgetBytes = 200L * 1024L * 1024L;
        public const int MaxCombatTurns = 300;

        public static readonly string[] SupportedCapabilities = new string[]
        {
            ${capabilitiesLiteral}
        };

        public static readonly TrustKeyJwk[] TrustedPublicKeys = new TrustKeyJwk[]
        {
            ${keysLiteral}
        };

        public static bool SupportsCapability(string capability)
        {
            if (string.IsNullOrEmpty(capability)) return false;
            for (int i = 0; i < SupportedCapabilities.Length; i++)
            {
                if (string.Equals(SupportedCapabilities[i], capability, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }
    }

    /// <summary>
    /// Deterministic Mulberry32 PRNG matching packages/shared/src/rng.ts bit-for-bit.
    /// Required so client battle replays produce the exact SHA-256 logHash expected by POST /api/v1/battles/verify.
    /// </summary>
    public sealed class Mulberry32Rng
    {
        private uint _state;

        public Mulberry32Rng(long seed)
        {
            _state = unchecked((uint)seed);
        }

        public double Next()
        {
            unchecked
            {
                _state += 0x6D2B79F5u;
                uint t = _state;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                uint result = t ^ (t >> 14);
                return result / 4294967296.0;
            }
        }

        public double NextDouble() => Next();

        public uint Snapshot() => _state;
    }

    public readonly struct AttributeValues
    {
        public readonly int Str;
        public readonly int Int;
        public readonly int Vit;
        public readonly int Agi;

        public AttributeValues(int str, int @int, int vit, int agi)
        {
            Str = str;
            Int = @int;
            Vit = vit;
            Agi = agi;
        }
    }

    public readonly struct DerivedCombatStats
    {
        public readonly int Hp;
        public readonly int Atk;
        public readonly int Def;
        public readonly int Spd;
        public readonly double CritRate;
        public readonly double CritDamage;
        public readonly double EffectHit;

        public DerivedCombatStats(int hp, int atk, int def, int spd, double critRate, double critDamage, double effectHit)
        {
            Hp = hp;
            Atk = atk;
            Def = def;
            Spd = spd;
            CritRate = critRate;
            CritDamage = critDamage;
            EffectHit = effectHit;
        }
    }

    public readonly struct HeroDerivedStats
    {
        public readonly int Str;
        public readonly int Int;
        public readonly int Vit;
        public readonly int Agi;
        public readonly int Hp;
        public readonly int Atk;
        public readonly int Def;
        public readonly int Spd;
        public readonly double CritRate;
        public readonly double CritDamage;
        public double CritDmg => CritDamage;
        public readonly double EffectHit;

        public HeroDerivedStats(int str, int @int, int vit, int agi, int hp, int atk, int def, int spd, double critRate, double critDamage, double effectHit)
        {
            Str = str;
            Int = @int;
            Vit = vit;
            Agi = agi;
            Hp = hp;
            Atk = atk;
            Def = def;
            Spd = spd;
            CritRate = critRate;
            CritDamage = critDamage;
            EffectHit = effectHit;
        }
    }

    /// <summary>
    /// Bit-exact C# port of packages/economy/src/attributes.ts (Decision D-27) and packages/combat/src/engine.ts.
    /// </summary>
    public static class UomdStatMath
    {
        public const int HpBase = ${ATTRIBUTE_RULES.hpBase};
        public const int HpPerVit = ${ATTRIBUTE_RULES.hpPerVit};
        public const double CritPerAgi = ${ATTRIBUTE_RULES.critPerAgi};
        public const double CritCap = ${ATTRIBUTE_RULES.critCap};
        public const double BaseCritDamage = ${ATTRIBUTE_RULES.critDamage};
        public const double CritDamagePerAgiOverCap = ${ATTRIBUTE_RULES.critDamagePerAgiOverCap};
        public const double EffectHitPerInt = ${ATTRIBUTE_RULES.effectHitPerInt};

        public static int RoundHalfUp(double x) => (int)Math.Floor(x + 0.5 + 1e-9);

        private static double Round3(double x) => Math.Round(x * 1000.0, MidpointRounding.AwayFromZero) / 1000.0;

        public static (int Vit, int Power) ResonancePoints(int tier)
        {
            int clamped = Math.Max(0, tier);
            return ((clamped + 1) / 2, clamped / 2);
        }

        public static AttributeValues AttributesAt(
            string powerStat,
            double baseStr, double baseInt, double baseVit, double baseAgi,
            double growthStr, double growthInt, double growthVit, double growthAgi,
            int level,
            double bonusStr = 0, double bonusInt = 0, double bonusVit = 0, double bonusAgi = 0, double bonusPower = 0)
        {
            int lvlOffset = level - 1;
            int str = Math.Max(0, RoundHalfUp(baseStr + growthStr * lvlOffset + bonusStr + (powerStat == "str" ? bonusPower : 0)));
            int @int = Math.Max(0, RoundHalfUp(baseInt + growthInt * lvlOffset + bonusInt + (powerStat == "int" ? bonusPower : 0)));
            int vit = Math.Max(0, RoundHalfUp(baseVit + growthVit * lvlOffset + bonusVit));
            int agi = Math.Max(0, RoundHalfUp(baseAgi + growthAgi * lvlOffset + bonusAgi));
            return new AttributeValues(str, @int, vit, agi);
        }

        public static DerivedCombatStats DeriveStats(string powerStat, AttributeValues a, int naturalArmor = 0, double equippedArmor = 0)
        {
            double agiCapPoints = CritCap / CritPerAgi;
            double overCap = Math.Max(0.0, a.Agi - agiCapPoints);
            int hp = Math.Max(1, HpBase + HpPerVit * a.Vit);
            int atk = powerStat == "int" ? a.Int : a.Str;
            int def = naturalArmor + Math.Max(0, RoundHalfUp(equippedArmor));
            int spd = Math.Max(1, a.Agi);
            double critRate = Round3(Math.Min(CritCap, CritPerAgi * a.Agi));
            double critDamage = Round3(BaseCritDamage + CritDamagePerAgiOverCap * overCap);
            double effectHit = Round3(EffectHitPerInt * a.Int);
            return new DerivedCombatStats(hp, atk, def, spd, critRate, critDamage, effectHit);
        }

        public static int ComputeVictoryStars(int startingPlayers, int defeated)
        {
            if (startingPlayers >= 5) return defeated >= 4 ? 1 : defeated == 3 ? 2 : 3;
            if (startingPlayers == 4) return defeated >= 3 ? 1 : defeated == 2 ? 2 : 3;
            if (startingPlayers == 3) return defeated >= 2 ? 1 : defeated == 1 ? 2 : 3;
            return defeated == 0 ? 3 : 2;
        }

        // shortcut: compile shim for scene code; the turn-limit rule is NOT in @uomd/combat. Replace with the real result flow.
        [Obsolete("Placeholder: not a port of @uomd/combat. Use ComputeVictoryStars(startingPlayers, defeated).")]
        public static int ComputeVictoryStars(int totalAllies, int survivingAllies, int turn, int turnLimit)
        {
            int defeated = Math.Max(0, totalAllies - survivingAllies);
            int stars = ComputeVictoryStars(totalAllies, defeated);
            if (turnLimit > 0 && turn > turnLimit && stars > 1)
            {
                stars--;
            }
            return stars;
        }

        // shortcut: compile shim with invented archetype numbers; real stats come from content units/*.json AttributeBlocks.
        [Obsolete("Placeholder stats, not canon. Use AttributesAt/DeriveStats with the unit's content AttributeBlock.")]
        public static HeroDerivedStats ComputeHeroStats(string archetype, int level, int ascension = 0)
        {
            string powerStat = "str";
            double baseStr = 10, baseInt = 10, baseVit = 12, baseAgi = 10;
            double growthStr = 1.5, growthInt = 1.0, growthVit = 2.0, growthAgi = 1.2;
            int naturalArmor = 5;

            switch ((archetype ?? "").ToUpperInvariant())
            {
                case "TACTICIAN":
                    powerStat = "int";
                    baseStr = 8; baseInt = 18; baseVit = 12; baseAgi = 12;
                    growthStr = 0.8; growthInt = 2.4; growthVit = 1.4; growthAgi = 1.5;
                    naturalArmor = 3;
                    break;
                case "VANGUARD":
                    powerStat = "str";
                    baseStr = 16; baseInt = 8; baseVit = 22; baseAgi = 10;
                    growthStr = 2.2; growthInt = 0.6; growthVit = 3.0; growthAgi = 1.0;
                    naturalArmor = 10;
                    break;
                case "EXECUTIONER":
                    powerStat = "str";
                    baseStr = 18; baseInt = 6; baseVit = 14; baseAgi = 16;
                    growthStr = 2.5; growthInt = 0.5; growthVit = 1.8; growthAgi = 2.0;
                    naturalArmor = 6;
                    break;
            }

            var res = ResonancePoints(ascension);
            var attrs = AttributesAt(powerStat, baseStr, baseInt, baseVit, baseAgi, growthStr, growthInt, growthVit, growthAgi, level, bonusVit: res.Vit, bonusPower: res.Power);
            var derived = DeriveStats(powerStat, attrs, naturalArmor);
            return new HeroDerivedStats(attrs.Str, attrs.Int, attrs.Vit, attrs.Agi, derived.Hp, derived.Atk, derived.Def, derived.Spd, derived.CritRate, derived.CritDamage, derived.EffectHit);
        }
    }
}
`;
}

export interface ExportUnityBundleOptions {
  rootDir?: string;
  outDir?: string;
  dryRun?: boolean;
}

export interface ExportUnityBundleSummary {
  outDir: string;
  baseReleaseId: string;
  baseFilesCopied: number;
  baseAtlases: number;
  baseUnits: number;
  campaignAtlases: number;
  campaignUnits: number;
  csharpFile: string;
}

export function exportUnityBundle(opts: ExportUnityBundleOptions = {}): ExportUnityBundleSummary {
  const rootDir = opts.rootDir ?? ROOT;
  const outDir = opts.outDir ?? join(rootDir, '.cache/unity_bundle');
  const dryRun = opts.dryRun ?? false;

  const baseReleasePath = join(rootDir, 'content/base/release.json');
  const baseManifest = ContentManifest.parse(JSON.parse(readFileSync(baseReleasePath, 'utf8')));

  const baseArtPath = join(rootDir, 'content/base/art/art_manifest.json');
  const baseArt = ArtManifest.parse(JSON.parse(readFileSync(baseArtPath, 'utf8')));
  const baseUnityArt = buildUnityArtMetadata(baseArt);

  const campaignArtPath = join(rootDir, 'content/patches/rel_0003_part1_campaign/art/art_manifest.json');
  let campaignUnityArt: UnityArtExport | null = null;
  if (existsSync(campaignArtPath)) {
    const campaignArt = ArtManifest.parse(JSON.parse(readFileSync(campaignArtPath, 'utf8')));
    campaignUnityArt = buildUnityArtMetadata(campaignArt);
  }

  const keysPath = join(rootDir, 'content/keys/trusted_public_keys.json');
  const keysRaw = JSON.parse(readFileSync(keysPath, 'utf8')) as { keys: PublicKeyJwk[] };
  assertTrustedKeys(keysRaw.keys);

  const csharpSource = generateCSharpCorePrimitives(keysRaw.keys);
  const csharpFile = join(outDir, 'Runtime/Generated/UomdCorePrimitives.g.cs');

  if (!dryRun) {
    const streamingBaseDir = join(outDir, 'StreamingAssets/uomd_base');
    mkdirSync(streamingBaseDir, { recursive: true });
    copyFileSync(baseReleasePath, join(streamingBaseDir, 'release.json'));

    for (const fileEntry of baseManifest.files) {
      const src = join(rootDir, 'content/base', fileEntry.path);
      const dst = join(streamingBaseDir, fileEntry.path);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }

    const metaDir = join(outDir, 'StreamingAssets/uomd_metadata');
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, 'unity_base_art_slices.json'), `${JSON.stringify(baseUnityArt, null, 2)}\n`, 'utf8');
    if (campaignUnityArt) {
      writeFileSync(join(metaDir, 'unity_campaign_art_slices.json'), `${JSON.stringify(campaignUnityArt, null, 2)}\n`, 'utf8');
    }

    mkdirSync(dirname(csharpFile), { recursive: true });
    writeFileSync(csharpFile, csharpSource, 'utf8');

    // When running against the repository default outDir, also sync into apps/unity/Assets/
    if (!opts.outDir) {
      const unityCoreGenFile = join(rootDir, 'apps/unity/Assets/_UOMD/Scripts/Core/Generated/UomdCorePrimitives.g.cs');
      mkdirSync(dirname(unityCoreGenFile), { recursive: true });
      writeFileSync(unityCoreGenFile, csharpSource, 'utf8');

      const unityMetaDir = join(rootDir, 'apps/unity/Assets/StreamingAssets/uomd_metadata');
      mkdirSync(unityMetaDir, { recursive: true });
      writeFileSync(join(unityMetaDir, 'unity_base_art_slices.json'), `${JSON.stringify(baseUnityArt, null, 2)}\n`, 'utf8');
      if (campaignUnityArt) {
        writeFileSync(join(unityMetaDir, 'unity_campaign_art_slices.json'), `${JSON.stringify(campaignUnityArt, null, 2)}\n`, 'utf8');
      }

      const unityStreamingBase = join(rootDir, 'apps/unity/Assets/StreamingAssets/uomd_base');
      mkdirSync(unityStreamingBase, { recursive: true });
      copyFileSync(baseReleasePath, join(unityStreamingBase, 'release.json'));
      for (const fileEntry of baseManifest.files) {
        const src = join(rootDir, 'content/base', fileEntry.path);
        const dst = join(unityStreamingBase, fileEntry.path);
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
      }

      const unitSlicesSummary: Record<string, Record<string, unknown>> = {};
      for (const [unitId, unitDesc] of Object.entries(baseUnityArt.units)) {
        const idleClip = unitDesc.clips.find((c) => c.state === 'idle') ?? unitDesc.clips[0];
        unitSlicesSummary[unitId] = {
          unit_id: unitId,
          atlas_id: unitDesc.atlasId,
          default_facing: unitDesc.facing,
          height_px: unitDesc.heightPx,
          cols: 4,
          rows: 4,
          scale: idleClip?.scale ?? 1,
          pivot_x: idleClip?.pivotX ?? 0.5,
          foot_y: idleClip?.footY ?? 0.92,
          unity_pivot: {
            x: idleClip?.pivotX ?? 0.5,
            y: idleClip?.unityPivotY ?? 0.08
          }
        };
      }
      const exportManifestPayload = {
        release_id: baseManifest.release.id,
        target_engine: 'unity_6000_lts_urp2d',
        copied_file_count: baseManifest.files.length,
        files: baseManifest.files,
        unit_slices: unitSlicesSummary
      };
      writeFileSync(
        join(unityStreamingBase, 'unity_export_manifest.json'),
        `${JSON.stringify(exportManifestPayload, null, 2)}\n`,
        'utf8'
      );
    }
  }

  return {
    outDir,
    baseReleaseId: baseManifest.release.id,
    baseFilesCopied: baseManifest.files.length,
    baseAtlases: Object.keys(baseUnityArt.atlases).length,
    baseUnits: Object.keys(baseUnityArt.units).length,
    campaignAtlases: campaignUnityArt ? Object.keys(campaignUnityArt.atlases).length : 0,
    campaignUnits: campaignUnityArt ? Object.keys(campaignUnityArt.units).length : 0,
    csharpFile
  };
}

/**
 * Unity cannot decode WebP at runtime (Texture2D.LoadImage / UnityWebRequestTexture accept PNG/JPG only),
 * so every exported .webp gets a lossless .png sibling. The signed manifest still lists the .webp files.
 */
/**
 * Unity cannot decode WebP. Next to every `.webp` under `dir` this writes a decodable sibling: a JPG (quality 92, no chroma
 * subsampling) when the image is fully opaque, a lossless PNG when it has transparency. `decodable.json` in `dir` maps
 * each WebP path to its sibling for the client (UomdMediaLoader). `removeWebp` drops the sources afterwards, for the copy that
 * ships inside the app where the WebP files would only add size.
 */
export async function writeDecodableSiblings(dir: string, opts: { removeWebp?: boolean } = {}): Promise<Record<string, string>> {
  const { default: sharp } = await import('sharp');
  const map: Record<string, string> = {};
  const walk = async (current: string): Promise<void> => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith('.webp')) continue;
      const image = sharp(full, { animated: false });
      const { isOpaque } = await image.stats();
      const target = full.slice(0, -5) + (isOpaque ? '.jpg' : '.png');
      const stale = full.slice(0, -5) + (isOpaque ? '.png' : '.jpg'); // left by an earlier export
      if (existsSync(stale)) rmSync(stale);
      if (isOpaque) await image.jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(target);
      else await image.png({ compressionLevel: 9 }).toFile(target);
      map[relative(dir, full).split(sep).join('/')] = relative(dir, target).split(sep).join('/');
      if (opts.removeWebp) rmSync(full);
    }
  };
  if (existsSync(dir)) await walk(dir);
  writeFileSync(join(dir, 'decodable.json'), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  return map;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const outIdx = process.argv.indexOf('--out');
  const outDir = outIdx >= 0 ? process.argv[outIdx + 1] : undefined;
  const dryRun = process.argv.includes('--dry-run');
  const summary = exportUnityBundle({ outDir, dryRun });
  let decodableSiblings = 0;
  if (!dryRun) {
    decodableSiblings = Object.keys(await writeDecodableSiblings(join(summary.outDir, 'StreamingAssets/uomd_base'))).length;
    // the copy inside the Unity project ships in the AAB: keep only what Unity can decode
    if (!outDir) decodableSiblings = Object.keys(await writeDecodableSiblings(join(ROOT, 'apps/unity/Assets/StreamingAssets/uomd_base'), { removeWebp: true })).length;
  }
  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'exported', ...summary, decodableSiblings }, null, 2));
}
