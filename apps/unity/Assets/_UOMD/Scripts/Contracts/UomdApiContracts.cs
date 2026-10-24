#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;

namespace Uomd.Contracts
{
    // ============================================================================
    // 1. Auth, Session & Error Envelopes (Mirrors apps/game/src/net/api.ts)
    // ============================================================================

    [Serializable, Preserve]
    public sealed class SessionDto
    {
        public string token = string.Empty;
        public string expiresAt = string.Empty;
        public string? playerId;
    }

    [Serializable, Preserve]
    public sealed class ApiErrorEnvelopeDto
    {
        public string? error;
        public string? message;
    }

    [Serializable, Preserve]
    public sealed class GoogleAuthRequestDto
    {
        public string idToken = string.Empty;
    }

    [Serializable, Preserve]
    public sealed class PlayerSummaryDto
    {
        public string id = string.Empty;
        public string? displayName;
        public bool isNew;
        public string? createdAt;
        public string? billingTag;
    }

    [Serializable, Preserve]
    public sealed class GoogleAuthResponseDto
    {
        public string token = string.Empty;
        public string expiresAt = string.Empty;
        public PlayerSummaryDto player = new PlayerSummaryDto();
    }

    [Serializable, Preserve]
    public sealed class RefreshSessionResponseDto
    {
        public string token = string.Empty;
        public string expiresAt = string.Empty;
        public string playerId = string.Empty;
    }

    // ============================================================================
    // 2. Economy, Wallets, Gacha & Attachments (Decision D-17: eclipse_token)
    // ============================================================================

    [Serializable, Preserve]
    public sealed class WalletsDto
    {
        public int eclipse_token;
        public int rations;
        public int gold;
        public int shards;
        public int seals;
    }

    [Serializable, Preserve]
    public sealed class StoryProgressDto
    {
        public bool prologueDone;
        public string? lastNodeId;
    }

    [Serializable, Preserve]
    public sealed class AccountPayloadDto
    {
        public string playerId = string.Empty;
        public string accountTag = string.Empty;
        public string displayName = string.Empty;
        public int level = 1;
        public int tutorialStep;
        public WalletsDto wallets = new WalletsDto();
        public StoryProgressDto storyProgress = new StoryProgressDto();
    }

    [Serializable, Preserve]
    public sealed class EntryConfigDto
    {
        public string phase = "not_started";
        public bool prologue;
        public int tutorials;
    }

    [Serializable, Preserve]
    public sealed class PrologueSceneDto
    {
        public string caption_en = string.Empty;
        public string text_en = string.Empty;
        public float duration_seconds = 5f;
    }

    [Serializable, Preserve]
    public sealed class PrologueConfigDto
    {
        public PrologueSceneDto[] scenes = Array.Empty<PrologueSceneDto>();
    }

    [Serializable, Preserve]
    public sealed class WalletEnvelopeDto
    {
        public WalletsDto wallets = new WalletsDto();
    }

    [Serializable, Preserve]
    public sealed class AttachmentDto
    {
        /// <summary>"currency" | "character" | "item" | "gear" | "account_xp"</summary>
        public string type = string.Empty;
        public string? currency;
        public int amount;
        public string? itemId;
        public int quantity;
        public string? gearId;
    }

    [Serializable, Preserve]
    public sealed class SoftPityDto
    {
        public int startPull;
        public double increment;
    }

    [Serializable, Preserve]
    public sealed class FeaturedRuleDto
    {
        public double chance;
        public int lossesToGuarantee;
        public string targetMode = "fixed";
    }

    [Serializable, Preserve]
    public sealed class BannerCostDto
    {
        public string currency = "eclipse_token";
        public int perPull;
        public int amount;
    }

    [Serializable, Preserve]
    public sealed class BannerPoolsDto
    {
        public string[] fiveFeatured = Array.Empty<string>();
        public string[] fiveOther = Array.Empty<string>();
        public string[] four = Array.Empty<string>();
        public string[] three = Array.Empty<string>();
    }

    [Serializable, Preserve]
    public sealed class BannerInfoDto
    {
        public string id = string.Empty;
        public string title = string.Empty;
        public string kind = "character";
        public string? artKey;
        public string pityGroup = string.Empty;
        public string? startsAt;
        public string? endsAt;
        public int hardPity = 80;
        public double baseFiveStarRate;
        public SoftPityDto? softPity;
        public FeaturedRuleDto? featured;
        public BannerCostDto cost = new BannerCostDto();
        public int minFourStarEvery = 10;
        public BannerPoolsDto pools = new BannerPoolsDto();
    }

    [Serializable, Preserve]
    public sealed class BannersEnvelopeDto
    {
        public BannerInfoDto[] banners = Array.Empty<BannerInfoDto>();
    }

    [Serializable, Preserve]
    public sealed class PullRecordDto
    {
        public int seq;
        public int pullNumber;
        public int rarity;
        public string itemId = string.Empty;
        public string outcome = string.Empty;
        public bool duplicate;
        public int shards;
        public bool upgraded;
    }

    [Serializable, Preserve]
    public sealed class PityCounterDto
    {
        public string? pity_group;
        public int pity5;
        public int pity4;
        public int lost;
        public int hardPity;
    }

    [Serializable, Preserve]
    public sealed class PullRequestDto
    {
        public string bannerId = string.Empty;
        public int count;
        public string? target;
        public string? releaseId;
        public string? requestId;
    }

    [Serializable, Preserve]
    public sealed class PullResponseDto
    {
        public string? requestId;
        public string? releaseId;
        public string? catalogSha256;
        public PullRecordDto[] pulls = Array.Empty<PullRecordDto>();
        public int balance;
        public PityCounterDto pity = new PityCounterDto();
        public BannerCostDto cost = new BannerCostDto();
        public bool replayed;
    }

    // ============================================================================
    // 3. Roster, Character Growth, Gear & Teams
    // ============================================================================

    [Serializable, Preserve]
    public sealed class ItemStackCostDto
    {
        public string itemId = string.Empty;
        public int quantity;
    }

    [Serializable, Preserve]
    public sealed class SkillNextUpgradeDto
    {
        public int rank;
        public int unlockLevel;
        public string itemId = string.Empty;
        public int quantity;
        public int fee;
    }

    [Serializable, Preserve]
    public sealed class SkillViewDto
    {
        public string skillId = string.Empty;
        public string type = string.Empty;
        public string name = string.Empty;
        public int rank;
        public int maxRank;
        public SkillNextUpgradeDto? next;
    }

    [Serializable, Preserve]
    public sealed class ResonanceViewDto
    {
        public int tier;
        public int maxTier;
        public int nextShardCost;
        public double bonusPct;
        public int excessShards;
        public string excessItemId = string.Empty;
    }

    [Serializable, Preserve]
    public sealed class NextAscensionDto
    {
        public int cap;
        public int accountLevel;
        public ItemStackCostDto[] items = Array.Empty<ItemStackCostDto>();
        public int fee;
        public string? requiresNode;
    }

    [Serializable, Preserve]
    public sealed class CharacterViewDto
    {
        public string id = string.Empty;
        public int level = 1;
        public int xp;
        public int xpToNext;
        public int ascension;
        public int cap = 20;
        public int copies = 1;
        public int shards;
        public ResonanceViewDto? resonance;
        public NextAscensionDto? nextAscension;
        public SkillViewDto[] skills = Array.Empty<SkillViewDto>();
    }

    [Serializable, Preserve]
    public sealed class AccountLevelDto
    {
        public int level = 1;
        public int xp;
    }

    [Serializable, Preserve]
    public sealed class MyCharactersResponseDto
    {
        public AccountLevelDto account = new AccountLevelDto();
        public CharacterViewDto[] characters = Array.Empty<CharacterViewDto>();
    }

    [Serializable, Preserve]
    public sealed class GearStatEntryDto
    {
        public string stat = string.Empty;
        public double value;
    }

    [Serializable, Preserve]
    public sealed class GearStatsBlockDto
    {
        public GearStatEntryDto main = new GearStatEntryDto();
        public GearStatEntryDto[] subs = Array.Empty<GearStatEntryDto>();
    }

    [Serializable, Preserve]
    public sealed class GearPassiveDto
    {
        public string name = string.Empty;
        public string? text;
        public bool supported;
    }

    [Serializable, Preserve]
    public sealed class GearViewDto
    {
        public string? unavailableReason;
        public int id;
        public string gearId = string.Empty;
        public string slot = "weapon";
        public string name = string.Empty;
        public int rarity = 3;
        public int level = 1;
        public int levelCap = 10;
        public string? equippedBy;
        public bool locked;
        public GearStatsBlockDto? stats;
        public GearPassiveDto? passive;
    }

    [Serializable, Preserve]
    public sealed class GearListEnvelopeDto
    {
        public GearViewDto[] gear = Array.Empty<GearViewDto>();
    }

    [Serializable, Preserve]
    public sealed class TeamMemberDto
    {
        public string characterId = string.Empty;
        public int slot;
        public string row = "front";
    }

    [Serializable, Preserve]
    public sealed class TeamPresetDto
    {
        public int slot;
        public string name = string.Empty;
        public bool active;
        public TeamMemberDto[] members = Array.Empty<TeamMemberDto>();
    }

    [Serializable, Preserve]
    public sealed class TeamsEnvelopeDto
    {
        public TeamPresetDto[] teams = Array.Empty<TeamPresetDto>();
    }

    // ============================================================================
    // 4. Story Entry, Campaign Progress, Battle Verification & Mail
    // ============================================================================

    [Serializable, Preserve]
    public sealed class EntryCheckpointDto
    {
        public string? requestId;
        public string phase = "not_started";
        public bool prologue;
        public int tutorials;
        public string? updatedAt;
        public string playerId = string.Empty;
    }

    [Serializable, Preserve]
    public sealed class EntryUpdateRequestDto
    {
        public bool prologue;
        public int tutorials;
        public bool completed;
        public string? requestId;
    }

    [Serializable, Preserve]
    public sealed class StoryProgressRequestDto
    {
        public string releaseId = string.Empty;
        public string nodeId = string.Empty;
        public string? requestId;
    }

    [Serializable, Preserve]
    public sealed class StoryProgressResponseDto
    {
        public string requestId = string.Empty;
        public string releaseId = string.Empty;
        public string nodeId = string.Empty;
        public bool completed;
        public bool replayed;
    }

    [Serializable, Preserve]
    public sealed class BattleActionInputDto
    {
        public string skillId = string.Empty;
        public string? targetId;
    }

    [Serializable, Preserve]
    public sealed class BattleSubmitRequestDto
    {
        public string releaseId = string.Empty;
        public string nodeId = string.Empty;
        public BattleActionInputDto[] actions = Array.Empty<BattleActionInputDto>();
        public string? sessionId;
        public string? requestId;
    }

    [Serializable, Preserve]
    public sealed class RationSpendDto
    {
        public int spent;
        public int value;
    }

    [Serializable, Preserve]
    public sealed class BattleSubmitResponseDto
    {
        public string? requestId;
        public string? nodeId;
        public int stars;
        public bool firstClear;
        public AttachmentDto[] rewards = Array.Empty<AttachmentDto>();
        public bool repeatRewardsAllowed;
        public RationSpendDto ration = new RationSpendDto();
    }

    [Serializable, Preserve]
    public sealed class MailItemDto
    {
        public int id;
        public string kind = string.Empty;
        public string title = string.Empty;
        public string body = string.Empty;
        public AttachmentDto[] attachments = Array.Empty<AttachmentDto>();
        public string created_at = string.Empty;
        public string expires_at = string.Empty;
        public string? claimed_at;
    }

    [Serializable, Preserve]
    public sealed class MailEnvelopeDto
    {
        public MailItemDto[] mail = Array.Empty<MailItemDto>();
    }

    // ============================================================================
    // 5. Unity Sprite Slice & Art Metadata (Mirrors tools/export_unity_bundle.ts)
    // ============================================================================

    [Serializable, Preserve]
    public struct UnityRectDto
    {
        public float x;
        public float y;
        public float width;
        public float height;
    }

    [Serializable, Preserve]
    public struct UnityPivotDto
    {
        public float x;
        public float y;
    }

    [Serializable, Preserve]
    public sealed class UnitySpriteSliceDto
    {
        public string name = string.Empty;
        public UnityRectDto rect;
        public float[] topLeftRect = Array.Empty<float>();
        public UnityPivotDto pivot;
    }

    [Serializable, Preserve]
    public sealed class UnityUnitAnimClipDto
    {
        public string state = "idle";
        public string stillFrame = string.Empty;
        public float scale = 1.0f;
        public float pivotX = 0.5f;
        public float footY = 0.92f;
        public float unityPivotY = 0.08f;
        public float fps = 10f;
        public bool loop = true;
        public string[] frames = Array.Empty<string>();
    }

    [Serializable, Preserve]
    public sealed class UnityAtlasDescriptorDto
    {
        public string atlasId = string.Empty;
        public string imagePath = string.Empty;
        public int width;
        public int height;
        public UnitySpriteSliceDto[] slices = Array.Empty<UnitySpriteSliceDto>();
    }

    [Serializable, Preserve]
    public sealed class UnityUnitDescriptorDto
    {
        public string unitArtKey = string.Empty;
        public string atlasId = string.Empty;
        public string facing = "right";
        public int heightPx = 220;
        public UnityUnitAnimClipDto[] clips = Array.Empty<UnityUnitAnimClipDto>();
    }

    [Serializable, Preserve]
    public sealed class UnityArtExportDto
    {
        public int schema = 1;
        public string coordinateSystem = "unity_bottom_left";
        public Dictionary<string, UnityAtlasDescriptorDto> atlases = new Dictionary<string, UnityAtlasDescriptorDto>();
        public Dictionary<string, UnityUnitDescriptorDto> units = new Dictionary<string, UnityUnitDescriptorDto>();
    }

    // ============================================================================
    // 6. Data-Driven VFX Schema (Mirrors packages/content-schema/src/vfx.ts)
    // ============================================================================

    [Serializable, Preserve]
    public struct VfxPaletteDto
    {
        public int primary;
        public int secondary;
        public int core;
    }

    [Serializable, Preserve]
    public sealed class VfxPropsDto
    {
        public float x;
        public float y;
        public float scale = 1f;
        public float scale_x = -1f;
        public float scale_y = -1f;
        public float alpha = 1f;
        public float angle;
    }

    [Serializable, Preserve]
    public sealed class VfxFadeDto
    {
        public int delay_ms;
        public int duration_ms = 200;
        public string ease = "quad.in";
    }

    [Serializable, Preserve]
    public sealed class VfxRepeatDto
    {
        public int count = 1;
        public int every_ms;
        public float scale_step;
        public bool mirror_angle;
        public string[]? tints;
    }

    [Serializable, Preserve]
    public sealed class VfxRangeFloatDto
    {
        public float min;
        public float max;

        public VfxRangeFloatDto() { }
        public VfxRangeFloatDto(float min, float max) { this.min = min; this.max = max; }
    }

    [Serializable, Preserve]
    public sealed class VfxStartEndDto
    {
        public float start = 1f;
        public float end;
    }

    [Serializable, Preserve]
    public sealed class VfxTrailDto
    {
        public string texture = "spark";
        public int every_ms = 24;
        public int lifespan_ms = 240;
        public float scale = 0.5f;
        public string[] tints = new[] { "core" };
    }

    [Serializable, Preserve]
    public sealed class VfxElementDto
    {
        /// <summary>"sprite" | "shape" | "burst" | "projectile" | "cue"</summary>
        public string kind = "sprite";

        // Common / Sprite / Shape
        public string texture = "spark";
        public string shape = "crescent";
        public float size = 120f;
        public int count = 8;
        public float thickness = 4f;
        public float bow = -50f;
        public string tint = "primary";
        public string tint2 = "core";
        public float fill_alpha = 0.92f;
        public VfxPropsDto from = new VfxPropsDto();
        public VfxPropsDto to = new VfxPropsDto();
        public string ease = "cubic.out";
        public int delay_ms;
        public int duration_ms = 300;
        public VfxFadeDto? fade;
        public VfxRepeatDto? repeat;
        public string layer = "fx";
        public int depth;
        public string blend = "normal";

        // Burst
        public float[] speed = new[] { 100f, 400f };
        public float[] angle = new[] { 0f, 360f };
        public float[] offset_x = new[] { 0f, 0f };
        public float[] offset_y = new[] { 0f, 0f };
        public VfxStartEndDto scale_range = new VfxStartEndDto { start = 1f, end = 0f };
        public VfxStartEndDto alpha_range = new VfxStartEndDto { start = 1f, end = 0f };
        public bool spin;
        public int lifespan_ms = 400;
        public float gravity_y;
        public string[] tints = new[] { "primary", "core" };

        // Projectile
        public string? halo;
        public string halo_tint = "primary";
        public float projectile_scale = 0.65f;
        public float arc_height = 65f;
        public float spin_turns = 1.5f;
        public VfxTrailDto? trail;

        // Cue ("hit_stop" | "shake" | "flash")
        public string cue = "shake";
        public float intensity = 0.5f;
    }

    [Serializable, Preserve]
    public sealed class VfxPresetDto
    {
        public List<VfxElementDto> elements = new List<VfxElementDto>();
    }

    [Serializable, Preserve]
    public sealed class VfxPackDto
    {
        public int schema_version = 1;
        public Dictionary<string, VfxPaletteDto> palettes = new Dictionary<string, VfxPaletteDto>();
        public Dictionary<string, VfxPresetDto> presets = new Dictionary<string, VfxPresetDto>();
        public Dictionary<string, string> skills = new Dictionary<string, string>();
    }
}
