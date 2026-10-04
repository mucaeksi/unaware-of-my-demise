// Part I gacha rules: pull resolution, pity, the 55/45 featured and Fate Knot guarantees, banner odds and status,
// duplicate grants (port of LEGACY backend/gacha_service.py, plus the pure parts of server/gacha_transaction.py,
// server/gacha_grants.py and server/banner_status.py).
//
// Nothing here touches a database or charges currency. `GachaRules.resolvePulls` is the body of the reference's pull
// transaction without its writes: the caller (one DB transaction) reads the pity row of the banner type, calls it (every
// validation error surfaces before anything is written), debits `fate_threads`, grants each result, records one history
// row per pull and upserts `pityStatePayload(plan.final_state)`.
//
// The order of `random.Random` draws is the contract, per pull: one `random()` for the rarity roll (skipped at hard pity),
// one `random()` for the 55/45 featured or target roll (only on an unprotected 5★ of a character or weapon banner), then
// one `randrange(len(pool))` for the reward (skipped when the reward is the featured unit or target). The minimum-4★
// upgrade draws nothing. A seed therefore yields the reference's results pull for pull (test/engine/gacha.test.ts pins a
// 180,600-pull fingerprint generated from the reference).
//
// Content is the raw parsed JSON of economy_part1.json, characters_part1.json and weapons_part1.json, read the way the
// reference reads it (row order matters for every pool). Failures throw GachaError carrying the reference's exception class
// in `kind`; only "GachaError" and "GachaConfigurationError" are client errors (HTTP 400 INVALID_REQUEST) there.
import { pyRepr } from "./content";
import { isoUtc, openBannerWindows, type BannerWindow } from "./gacha-rotation";
import type { CpythonRandom } from "./random";

export type BannerType = "character" | "weapon" | "standard_character";
export type Rarity = 3 | 4 | 5;

export type GachaErrorKind =
  | "GachaError"
  | "GachaConfigurationError"
  | "TypeError"
  | "ValueError"
  | "KeyError"
  | "AttributeError"
  | "AssertionError";

export class GachaError extends Error {
  constructor(
    message: string,
    readonly kind: GachaErrorKind = "GachaError",
  ) {
    super(message);
  }

  /** The reference's GachaError family (GachaConfigurationError included): HTTP 400 INVALID_REQUEST. Others are 500s. */
  get isRequestError(): boolean {
    return this.kind === "GachaError" || this.kind === "GachaConfigurationError";
  }
}

/**
 * Immutable pity snapshot, one per (account, banner type). `*_five_star_pity` counts consecutive non-5★ pulls since the
 * last 5★ (the next pull number is counter + 1); the 4★ counters count consecutive pulls below 4★. Pity is shared across
 * rotations of the same banner type. Field order is the reference dataclass's (its `asdict` is the persisted payload).
 */
export interface AccountPityState {
  character_five_star_pity: number;
  character_four_star_pity: number;
  lost_featured_next_five_star_guaranteed: boolean;
  weapon_five_star_pity: number;
  weapon_four_star_pity: number;
  weapon_fate_knots: number;
  selected_character_id: string | null;
  selected_weapon_target_id: string | null;
  standard_five_star_pity: number;
  standard_four_star_pity: number;
}

export const PITY_STATE_FIELDS = [
  "character_five_star_pity",
  "character_four_star_pity",
  "lost_featured_next_five_star_guaranteed",
  "weapon_five_star_pity",
  "weapon_four_star_pity",
  "weapon_fate_knots",
  "selected_character_id",
  "selected_weapon_target_id",
  "standard_five_star_pity",
  "standard_four_star_pity",
] as const satisfies readonly (keyof AccountPityState)[];

const DEFAULT_PITY_STATE: AccountPityState = {
  character_five_star_pity: 0,
  character_four_star_pity: 0,
  lost_featured_next_five_star_guaranteed: false,
  weapon_five_star_pity: 0,
  weapon_four_star_pity: 0,
  weapon_fate_knots: 0,
  selected_character_id: null,
  selected_weapon_target_id: null,
  standard_five_star_pity: 0,
  standard_four_star_pity: 0,
};

type Row = Record<string, unknown>;
const isObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

/** `AccountPityState(**fields)`: defaults for missing fields; an unknown field is the reference's TypeError. Values are
 * taken as given and checked by every rule entry point (`_validate_state`). */
export function pityState(fields: Partial<AccountPityState> | Row = {}): AccountPityState {
  if (!isObject(fields)) throw new GachaError(`argument after ** must be a mapping, not ${pyTypeName(fields)}`, "TypeError");
  const state: Row = { ...DEFAULT_PITY_STATE };
  for (const [key, value] of Object.entries(fields)) {
    if (!(PITY_STATE_FIELDS as readonly string[]).includes(key)) {
      throw new GachaError(`AccountPityState.__init__() got an unexpected keyword argument ${pyRepr(key)}`, "TypeError");
    }
    state[key] = value;
  }
  return state as unknown as AccountPityState;
}

/** `_pity_state_for`: the stored payload of one banner type (null when the account never pulled on it). */
export function pityStateFromPayload(payload: unknown): AccountPityState {
  return payload === null || payload === undefined ? pityState() : pityState(payload as Row);
}

/** `asdict(state)`: the `gacha_pity` payload and the `GET /v1/gacha/pity` shape, in dataclass field order. */
export function pityStatePayload(state: AccountPityState): AccountPityState {
  const payload: Row = {};
  for (const field of PITY_STATE_FIELDS) payload[field] = state[field];
  return payload as unknown as AccountPityState;
}

const replace = (state: AccountPityState, changes: Partial<AccountPityState>): AccountPityState => pityState({ ...state, ...changes });

/**
 * One resolved pull and its replacement pity state. `rarity_probabilities` is the weighted roll before the minimum-4★
 * upgrade. `reward_id` is null only when a character 5★ 55/45 is lost and the rules define no `lost_featured_pool`;
 * `outcome_pool_id` then names the unresolved pool.
 */
export interface PullResult {
  banner_id: string;
  banner_type: BannerType;
  rarity: Rarity;
  reward_id: string | null;
  outcome_pool_id: string | null;
  is_featured: boolean | null;
  hard_pity_triggered: boolean;
  featured_guarantee_triggered: boolean;
  target_guarantee_triggered: boolean;
  minimum_four_star_triggered: boolean;
  rarity_probabilities: [[5, number], [4, number], [3, number]];
  account_state: AccountPityState;
}

/** `PullResult.probability_total` (Python `sum`, left to right from 0). */
export const probabilityTotal = (result: PullResult): number =>
  result.rarity_probabilities.reduce((sum, [, probability]) => sum + probability, 0);

export type RarityProbabilities = Record<Rarity, number>;

/** What the very next pull does, before any RNG is drawn; `four_star`/`three_star` already include the minimum-4★ rule. */
export interface NextPullOdds {
  banner_id: string;
  banner_type: BannerType;
  five_star_pity: number;
  hard_pity: number;
  four_star_pity: number;
  four_star_every: number;
  four_star_guaranteed: boolean;
  five_star: number;
  four_star: number;
  three_star: number;
  /** Pulls left up to and including the guaranteed 5★ (1 when it is next). */
  pulls_until_hard_pity: number;
}

/** `server.gacha_grants.Grant.to_dict()` (and the `GachaGrant` response model). */
export interface Grant {
  kind: "character" | "weapon";
  item_id: string;
  duplicate: boolean;
  copies: number | null;
  instance_id: string | null;
  memory_shards: number;
}

/** The `roster` columns `_grant_character` reads for (account, character); null when there is no row. */
export interface RosterCopies {
  copies: number;
  memory_shards: number;
}

/** `_grant_character` without the SQL: the grant plus the row to INSERT (level 1) or UPDATE. */
export interface CharacterGrantPlan {
  grant: Grant;
  roster: { insert: boolean; copies: number; memory_shards: number };
}

/** The pure part of `_resolve_and_persist_pulls`. */
export interface PullPlan {
  banner_id: string;
  banner_type: BannerType;
  pull_count: number;
  /** `pull_cost() * pull_count`, debited from `wallet.fate_threads` (PULL_CURRENCY_COLUMN). */
  total_cost: number;
  /** The state the first pull used (the stored row, with the Hall of Armaments target applied). */
  starting_state: AccountPityState;
  results: PullResult[];
  /** `results[-1].account_state`: what the transaction saves for `banner_type`. */
  final_state: AccountPityState;
}

/** `banner_status.banner_state`: the per-account fields of `BannerInfo`. */
export interface BannerState {
  pity: number;
  hard_pity: number;
  pulls_until_hard_pity: number;
  four_star_pity: number;
  four_star_guarantee_every: number;
  four_star_guaranteed_next: boolean;
  next_pull: { five_star: number; four_star: number; three_star: number };
  guarantee: {
    kind: "none" | "featured_character" | "weapon_target";
    active: boolean;
    fate_knots: number | null;
    fate_knots_needed: number | null;
    text: string;
  };
  selected_target_id: string | null;
}

/** One `GET /v1/gacha/banners` entry (`BannerInfo`, field order of the reference model). */
export interface BannerInfo {
  banner_id: string;
  banner_type: BannerType;
  pull_cost: number;
  closes_at: string | null;
  target_ids: string[] | null;
  pity: number;
  hard_pity: number;
  pulls_until_hard_pity: number;
  four_star_pity: number;
  four_star_guarantee_every: number;
  four_star_guaranteed_next: boolean;
  next_pull: BannerState["next_pull"];
  guarantee: BannerState["guarantee"];
  selected_target_id: string | null;
}

/** `pull_result_to_dict`: the JSON-safe per-pull shape. */
export interface PullResultDict {
  banner_id: string;
  banner_type: BannerType;
  rarity: Rarity;
  reward_id: string | null;
  outcome_pool_id: string | null;
  is_featured: boolean | null;
  hard_pity_triggered: boolean;
  featured_guarantee_triggered: boolean;
  target_guarantee_triggered: boolean;
  minimum_four_star_triggered: boolean;
}

export interface PullOutcome {
  pull_id: string;
  result: PullResult;
  grant: Grant | null;
}

export type GachaPullOutcome = { pull_id: string } & PullResultDict & { grant: Grant | null };

/** `POST /v1/gacha/pull` response: every pull in `results`, top-level fields mirror the last pull. */
export type GachaPullResponse = PullResultDict & { pull_count: number; results: GachaPullOutcome[] };

export const ALLOWED_PULL_COUNTS = [1, 10] as const;
/** The wallet column a pull debits (economy_part1.json names the currency `fates_thread`). */
export const PULL_CURRENCY_COLUMN = "fate_threads";

const WEAPON_COMMON_SOURCE = "weapon_banner_common_pool";
const CHARACTER_GACHA_SOURCES: readonly string[] = ["gacha", "free_story_recruit_and_banner", "standard_banner_pool"];
const HALL = "hall_of_armaments";
const COUNTER_FIELDS = [
  "character_five_star_pity",
  "character_four_star_pity",
  "weapon_five_star_pity",
  "weapon_four_star_pity",
  "weapon_fate_knots",
  "standard_five_star_pity",
  "standard_four_star_pity",
] as const;

// -- Python value semantics for the JSON the rules read ------------------------------------------------------------

function pyTypeName(value: unknown): string {
  if (value === null || value === undefined) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  return "dict";
}

const keyRepr = (key: string | number): string => (typeof key === "number" ? String(key) : pyRepr(key));

/** `container[key]`. */
function item(container: unknown, key: string | number): unknown {
  if (Array.isArray(container) && typeof key === "number") {
    if (key < 0 || key >= container.length) throw new GachaError("list index out of range", "KeyError");
    return container[key];
  }
  if (isObject(container)) {
    if (!Object.hasOwn(container, String(key))) throw new GachaError(keyRepr(key), "KeyError");
    return container[String(key)];
  }
  throw new GachaError(`'${pyTypeName(container)}' object is not subscriptable`, "TypeError");
}

/** `mapping.get(key, fallback)`. */
function get(container: unknown, key: string, fallback: unknown = null): unknown {
  if (!isObject(container)) throw new GachaError(`'${pyTypeName(container)}' object has no attribute 'get'`, "AttributeError");
  return Object.hasOwn(container, key) ? container[key] : fallback;
}

/** `list(value)` of a JSON array (the content's pools and id lists). */
function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [...value];
  if (isObject(value)) return Object.keys(value);
  throw new GachaError(`'${pyTypeName(value)}' object is not iterable`, "TypeError");
}

const isNumberLike = (value: unknown): value is number | boolean => typeof value === "number" || typeof value === "boolean";

/** `a == b` for JSON scalars (bool is an int in Python). */
function eq(a: unknown, b: unknown): boolean {
  if (isNumberLike(a) && isNumberLike(b)) return Number(a) === Number(b);
  return (a ?? null) === (b ?? null);
}

function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value) || typeof value === "string") return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return true;
}

/** `value in frozenset(strings)`: a list or dict value is unhashable. */
function inStringSet(value: unknown, members: readonly string[]): boolean {
  if (Array.isArray(value) || isObject(value)) throw new GachaError(`unhashable type: '${pyTypeName(value)}'`, "TypeError");
  return typeof value === "string" && members.includes(value);
}

/** `needle in container` for a JSON container (substring for a string). */
function contains(container: unknown, needle: string): boolean {
  if (Array.isArray(container)) return container.some((entry) => eq(entry, needle));
  if (typeof container === "string") return container.includes(needle);
  if (isObject(container)) return Object.hasOwn(container, needle);
  throw new GachaError(`argument of type '${pyTypeName(container)}' is not iterable`, "TypeError");
}

/** Python `int(value)`. */
function pyInt(value: unknown): number {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new GachaError("cannot convert float to integer", "ValueError");
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\s*[+-]?\d+(?:_\d+)*\s*$/.test(value)) return Number(value.replace(/_/g, "").trim());
  if (typeof value === "string") throw new GachaError(`invalid literal for int() with base 10: ${pyRepr(value)}`, "ValueError");
  throw new GachaError(`int() argument must be a string, a bytes-like object or a real number, not '${pyTypeName(value)}'`, "TypeError");
}

/** Python `float(value)`. */
function pyFloat(value: unknown): number {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const text = value.trim().replace(/_/g, "");
    if (/^[+-]?(?:\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)$/i.test(text)) return Number(text);
    if (/^[+-]?(?:inf|infinity)$/i.test(text)) return text.startsWith("-") ? -Infinity : Infinity;
    if (/^[+-]?nan$/i.test(text)) return Number.NaN;
    throw new GachaError(`could not convert string to float: ${pyRepr(value)}`, "ValueError");
  }
  throw new GachaError(`float() argument must be a string or a real number, not '${pyTypeName(value)}'`, "TypeError");
}

/** `value - 1` on a JSON number (the `_validate_state` bounds). */
function minusOne(value: unknown): number {
  if (isNumberLike(value)) return Number(value) - 1;
  throw new GachaError(`unsupported operand type(s) for -: '${pyTypeName(value)}' and 'int'`, "TypeError");
}

function rows(pack: unknown, field: string): unknown[] {
  return list(item(pack, field));
}

interface Banner {
  banner_id: string;
  banner_type: BannerType;
  rules: unknown;
  target_id: string;
}

export class GachaRules {
  private readonly cache = new Map<string, unknown>();

  /** The raw parsed packs, read lazily like the reference (a malformed pack fails the call that needs it). */
  constructor(
    private readonly economy: unknown,
    private readonly characters: unknown,
    private readonly weapons: unknown,
  ) {}

  private memo<T>(key: string, build: () => T): T {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    const value = build();
    this.cache.set(key, value);
    return value;
  }

  // -- content indexes (the reference's lru_cache'd helpers, same row order) ---------------------------------------

  /** economy_part1.json `banners`. */
  banners(): unknown {
    return item(this.economy, "banners");
  }

  private pairs(): Map<unknown, unknown> {
    return this.memo("pairs", () => {
      const map = new Map<unknown, unknown>();
      for (const row of list(item(this.banners(), "signature_pairs"))) map.set(item(row, "banner_id"), row);
      return map;
    });
  }

  /** `{row.get(id): row for row in reversed(rows)}`: the first row of a duplicated id wins. */
  private rowsById(key: string, pack: unknown, field: string, idField: string): Map<unknown, unknown> {
    return this.memo(key, () => {
      const map = new Map<unknown, unknown>();
      for (const row of rows(pack, field)) {
        const id = get(row, idField);
        if (!map.has(id)) map.set(id, row);
      }
      return map;
    });
  }

  private characterRowsById(): Map<unknown, unknown> {
    return this.rowsById("characterRows", this.characters, "characters", "character_id");
  }

  private weaponRowsById(): Map<unknown, unknown> {
    return this.rowsById("weaponRows", this.weapons, "weapons", "weapon_id");
  }

  private hallSelectableIds(): unknown[] {
    return this.memo("hallSelectable", () => list(item(item(this.banners(), "standard_signature_weapon"), "selected_signature_ids")));
  }

  private gachaCharacterIds(rarity: number): string[] {
    return this.memo(`gachaCharacters${rarity}`, () =>
      rows(this.characters, "characters")
        .filter((row) => eq(get(row, "rarity"), rarity) && inStringSet(get(row, "acquisition"), CHARACTER_GACHA_SOURCES))
        .map((row) => item(row, "character_id") as string),
    );
  }

  private commonWeaponIds(rarity: number): string[] {
    return this.memo(`commonWeapons${rarity}`, () =>
      rows(this.weapons, "weapons")
        .filter((row) => eq(get(row, "rarity"), rarity) && contains(get(row, "acquisition", []), WEAPON_COMMON_SOURCE))
        .map((row) => item(row, "weapon_id") as string),
    );
  }

  /** `banners.standard_character.five_star_character_ids`, validated (not cached when invalid, like lru_cache). */
  private standardFiveStarIds(): string[] {
    if (this.cache.has("standardFive")) return this.cache.get("standardFive") as string[];
    const ids = get(item(this.banners(), "standard_character"), "five_star_character_ids");
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new GachaError("standard_character.five_star_character_ids is not authored", "GachaConfigurationError");
    }
    const characters = this.characterRowsById();
    for (const characterId of ids) {
      const row = characters.get(characterId);
      if (row === undefined || !eq(get(row, "rarity"), 5) || eq(get(row, "acquisition"), "limited_banner")) {
        throw new GachaError(
          `Standard 5★ pool entry is not a non-limited 5★ character: ${pyRepr(characterId)}`,
          "GachaConfigurationError",
        );
      }
    }
    this.cache.set("standardFive", ids);
    return ids as string[];
  }

  private signatureWeaponIds(): string[] {
    return this.memo("signatureWeapons", () =>
      rows(this.weapons, "weapons")
        .filter((row) => eq(get(row, "rarity"), 5) && eq(get(row, "acquisition"), "weapon_banner_only"))
        .map((row) => item(row, "weapon_id") as string),
    );
  }

  // -- banner resolution ---------------------------------------------------------------------------------------

  private resolveBanner(state: AccountPityState, bannerId: string): Banner {
    const banners = this.banners();
    const pairs = this.pairs();
    const pairId = bannerId.slice(bannerId.indexOf(":") + 1);

    if (bannerId.startsWith("character:")) {
      if (!pairs.has(pairId)) throw new GachaError(`Unknown character banner ID: ${bannerId}`);
      return { banner_id: bannerId, banner_type: "character", rules: item(banners, "character"), target_id: item(pairs.get(pairId), "character_id") as string };
    }
    if (bannerId === "limited_character") {
      const target = state.selected_character_id;
      if (!truthy(target)) throw new GachaError("limited_character requires selected_character_id in AccountPityState");
      return { banner_id: bannerId, banner_type: "character", rules: item(banners, "character"), target_id: target as string };
    }
    if (bannerId.startsWith("weapon:")) {
      if (!pairs.has(pairId)) throw new GachaError(`Unknown weapon banner ID: ${bannerId}`);
      return { banner_id: bannerId, banner_type: "weapon", rules: item(banners, "weapon"), target_id: item(pairs.get(pairId), "weapon_id") as string };
    }
    if (bannerId === "limited_signature_weapon" || bannerId === HALL) {
      const target = state.selected_weapon_target_id;
      if (!truthy(target)) throw new GachaError(`${bannerId} requires selected_weapon_target_id`);
      return { banner_id: bannerId, banner_type: "weapon", rules: item(banners, "weapon"), target_id: target as string };
    }
    if (bannerId === "hall_of_ancestors") {
      return { banner_id: bannerId, banner_type: "standard_character", rules: item(banners, "standard_character"), target_id: "" };
    }
    throw new GachaError(`Unsupported banner ID: ${bannerId}`);
  }

  private validateTarget(banner: Banner): void {
    if (banner.banner_type === "standard_character") {
      this.standardFiveStarIds();
      return;
    }
    if (banner.banner_type === "character") {
      const target = this.characterRowsById().get(banner.target_id);
      if (target === undefined || !eq(get(target, "rarity"), 5) || !eq(get(target, "acquisition"), "limited_banner")) {
        throw new GachaError(`Featured character is not an eligible Part I 5★: ${banner.target_id}`, "GachaConfigurationError");
      }
      return;
    }
    const target = this.weaponRowsById().get(banner.target_id);
    if (target === undefined || !eq(get(target, "rarity"), 5) || !eq(get(target, "acquisition"), "weapon_banner_only")) {
      throw new GachaError(`Selected weapon is not an eligible Part I signature: ${banner.target_id}`, "GachaConfigurationError");
    }
    if (banner.banner_id === HALL && !this.hallSelectableIds().some((id) => eq(id, banner.target_id))) {
      throw new GachaError(`Weapon is not selectable in Hall of Armaments: ${banner.target_id}`, "GachaConfigurationError");
    }
  }

  private validateState(state: AccountPityState): void {
    if (!isObject(state)) throw new GachaError("account_state must be an AccountPityState", "TypeError");
    for (const field of COUNTER_FIELDS) {
      const value: unknown = state[field];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new GachaError(`${field} must be a non-negative integer`);
      }
    }
    const banners = this.banners();
    const character = item(banners, "character");
    const weapon = item(banners, "weapon");
    const standard = item(banners, "standard_character");
    const every = "minimum_four_star_or_better_every_n_pulls";
    const bounds: [keyof AccountPityState, number][] = [
      ["character_five_star_pity", minusOne(item(character, "hard_pity"))],
      ["character_four_star_pity", minusOne(item(character, every))],
      ["weapon_five_star_pity", minusOne(item(weapon, "hard_pity"))],
      ["weapon_four_star_pity", minusOne(item(weapon, every))],
      ["weapon_fate_knots", Number(item(weapon, "fate_knots_to_guarantee"))],
      ["standard_five_star_pity", minusOne(item(standard, "hard_pity"))],
      ["standard_four_star_pity", minusOne(item(standard, every))],
    ];
    for (const [field, maximum] of bounds) {
      if ((state[field] as number) > maximum) throw new GachaError(`${field} cannot exceed ${maximum} under current banner rules`);
    }
    if (typeof state.lost_featured_next_five_star_guaranteed !== "boolean") {
      throw new GachaError("lost_featured_next_five_star_guaranteed must be bool");
    }
    for (const field of ["selected_character_id", "selected_weapon_target_id"] as const) {
      const value: unknown = state[field];
      if (value !== null && value !== undefined && typeof value !== "string") throw new GachaError(`${field} must be a string or None`);
    }
  }

  private static counterFor(state: AccountPityState, bannerType: BannerType, rarity: 4 | 5): number {
    if (bannerType === "standard_character") return rarity === 5 ? state.standard_five_star_pity : state.standard_four_star_pity;
    if (bannerType === "character") return rarity === 5 ? state.character_five_star_pity : state.character_four_star_pity;
    return rarity === 5 ? state.weapon_five_star_pity : state.weapon_four_star_pity;
  }

  private rarityProbabilities(banner: Banner, state: AccountPityState): RarityProbabilities {
    const rules = banner.rules;
    const hardPity = pyInt(item(rules, "hard_pity"));
    const pullNumber = GachaRules.counterFor(state, banner.banner_type, 5) + 1;

    // The standard banner authors its base rate as "five_star_base_rate".
    let five = pyFloat(get(rules, "base_five_star_rate", get(rules, "five_star_base_rate")));
    if (banner.banner_type === "character") {
      if (pullNumber >= hardPity) {
        five = 1.0;
      } else if (pullNumber >= pyInt(item(rules, "soft_pity_start_pull"))) {
        const increment = pyFloat(item(rules, "soft_pity_increment_percentage_points")) / 100.0;
        const lastBasePull = pyInt(item(rules, "base_rate_through_pull"));
        five = Math.min(1.0, five + increment * (pullNumber - lastBasePull));
      }
    } else if (pullNumber >= hardPity) {
      five = 1.0;
    }

    let ratio = get(rules, "base_non_five_star_ratio");
    if (ratio === null || ratio === undefined) ratio = item(item(this.banners(), "rarity_resolution"), "base_non_five_star_ratio");
    const fourWeight = pyFloat(item(ratio, "four_star"));
    const threeWeight = pyFloat(item(ratio, "three_star"));
    const totalWeight = fourWeight + threeWeight;
    if (totalWeight <= 0.0 || !(five >= 0.0 && five <= 1.0)) {
      throw new GachaError("Invalid rarity rate or non-5★ ratio", "GachaConfigurationError");
    }
    const nonFive = 1.0 - five;
    const four = (nonFive * fourWeight) / totalWeight;
    const three = nonFive - four;
    if (!(Math.abs(five + four + three - 1.0) <= 1e-12)) throw new GachaError("", "AssertionError");
    return { 5: five, 4: four, 3: three };
  }

  private static weightedRarity(probabilities: RarityProbabilities, rng: CpythonRandom): Rarity {
    const roll = rng.random();
    let cumulative = 0.0;
    for (const rarity of [5, 4, 3] as const) {
      cumulative += probabilities[rarity];
      if (roll < cumulative) return rarity;
    }
    // random() is below 1.0, so only corrupt rates can escape the normalized sum.
    throw new GachaError("Weighted rarity roll escaped normalized rates", "GachaConfigurationError");
  }

  private static choose(ids: readonly string[], label: string, rng: CpythonRandom): string {
    if (ids.length === 0) throw new GachaError(`No eligible outcome exists for ${label}`, "GachaConfigurationError");
    return ids[rng.randbelow(ids.length)]!;
  }

  private resolveReward(banner: Banner, rarity: Rarity, isFeatured: boolean | null, rng: CpythonRandom): [string | null, string | null] {
    if (banner.banner_type === "standard_character") {
      if (rarity === 5) return [GachaRules.choose(this.standardFiveStarIds(), "character_id", rng), null];
      return [GachaRules.choose(this.gachaCharacterIds(rarity), "character_id", rng), null];
    }
    if (banner.banner_type === "character") {
      if (rarity === 5) {
        if (isFeatured) return [banner.target_id, null];
        // Owner decision 2026-09-28 (banners.character.lost_featured_pool = "standard_character"): a lost 55/45 grants a
        // standard 5★ (Mahmut/Fadyme). Without the flag the loss stays explicit and grants nothing.
        if (eq(get(banner.rules, "lost_featured_pool"), "standard_character")) {
          return [GachaRules.choose(this.standardFiveStarIds(), "character_id", rng), null];
        }
        return [null, "character_standard_five_star_pool"];
      }
      return [GachaRules.choose(this.gachaCharacterIds(rarity), "character_id", rng), null];
    }
    if (rarity === 5) {
      if (isFeatured) return [banner.target_id, null];
      const others = this.signatureWeaponIds().filter((id) => id !== banner.target_id);
      return [GachaRules.choose(others, "weapon_id", rng), null];
    }
    return [GachaRules.choose(this.commonWeaponIds(rarity), "weapon_id", rng), null];
  }

  // -- public rules ----------------------------------------------------------------------------------------------

  /** `get_rarity_probabilities`: the next raw weighted roll (before the minimum-4★ upgrade); consumes no RNG. */
  getRarityProbabilities(state: AccountPityState, bannerId: string): RarityProbabilities {
    this.validateState(state);
    const banner = this.resolveBanner(state, bannerId);
    this.validateTarget(banner);
    return this.rarityProbabilities(banner, state);
  }

  /** `describe_next_pull`: odds of the final rarity and the pity counters; consumes no RNG, changes no state. */
  describeNextPull(state: AccountPityState, bannerId: string): NextPullOdds {
    this.validateState(state);
    const banner = this.resolveBanner(state, bannerId);
    this.validateTarget(banner);
    const probabilities = this.rarityProbabilities(banner, state);
    const fourStarEvery = pyInt(item(banner.rules, "minimum_four_star_or_better_every_n_pulls"));
    const fourStarPity = GachaRules.counterFor(state, banner.banner_type, 4);
    const guaranteed = fourStarPity + 1 >= fourStarEvery;
    const fiveStarPity = GachaRules.counterFor(state, banner.banner_type, 5);
    const hardPity = pyInt(item(banner.rules, "hard_pity"));
    return {
      banner_id: bannerId,
      banner_type: banner.banner_type,
      five_star_pity: fiveStarPity,
      hard_pity: hardPity,
      four_star_pity: fourStarPity,
      four_star_every: fourStarEvery,
      four_star_guaranteed: guaranteed,
      five_star: probabilities[5],
      four_star: probabilities[4] + (guaranteed ? probabilities[3] : 0.0),
      three_star: guaranteed ? 0.0 : probabilities[3],
      pulls_until_hard_pity: hardPity - fiveStarPity,
    };
  }

  /** `pull`: resolve one pull and return a new snapshot; `state` is never mutated. */
  pull(state: AccountPityState, bannerId: string, rng: CpythonRandom): PullResult {
    this.validateState(state);
    const banner = this.resolveBanner(state, bannerId);
    this.validateTarget(banner);
    const rules = banner.rules;
    const probabilities = this.rarityProbabilities(banner, state);
    const previousFive = GachaRules.counterFor(state, banner.banner_type, 5);
    const hardPity = pyInt(item(rules, "hard_pity"));
    const hardPityTriggered = previousFive + 1 >= hardPity;
    let rarity: Rarity = hardPityTriggered ? 5 : GachaRules.weightedRarity(probabilities, rng);

    const fourCounter = GachaRules.counterFor(state, banner.banner_type, 4);
    const minimumFourEvery = pyInt(item(rules, "minimum_four_star_or_better_every_n_pulls"));
    const minimumFourTriggered = rarity === 3 && fourCounter + 1 >= minimumFourEvery;
    if (minimumFourTriggered) rarity = 4;

    let featured: boolean | null = null;
    let featuredGuarantee = false;
    let targetGuarantee = false;
    let updated = state;

    if (banner.banner_type === "standard_character") {
      // No featured unit, no 55/45: pity counters only.
      if (rarity === 5) updated = replace(updated, { standard_five_star_pity: 0, standard_four_star_pity: 0 });
      else if (rarity === 4) updated = replace(updated, { standard_five_star_pity: previousFive + 1, standard_four_star_pity: 0 });
      else updated = replace(updated, { standard_five_star_pity: previousFive + 1, standard_four_star_pity: fourCounter + 1 });
    } else if (banner.banner_type === "character") {
      if (rarity === 5) {
        featuredGuarantee = state.lost_featured_next_five_star_guaranteed;
        featured = featuredGuarantee ? true : rng.random() < pyFloat(item(rules, "featured_chance_on_five_star"));
        updated = replace(updated, {
          character_five_star_pity: 0,
          character_four_star_pity: 0,
          lost_featured_next_five_star_guaranteed: !featured,
        });
      } else if (rarity === 4) {
        updated = replace(updated, { character_five_star_pity: previousFive + 1, character_four_star_pity: 0 });
      } else {
        updated = replace(updated, { character_five_star_pity: previousFive + 1, character_four_star_pity: fourCounter + 1 });
      }
    } else {
      const knotsToGuarantee = pyInt(item(rules, "fate_knots_to_guarantee"));
      targetGuarantee = rarity === 5 && state.weapon_fate_knots >= knotsToGuarantee;
      if (rarity === 5) {
        let knots: number;
        if (targetGuarantee) {
          featured = true;
          knots = 0;
        } else {
          featured = rng.random() < pyFloat(item(rules, "selected_target_chance_on_unprotected_five_star"));
          knots = state.weapon_fate_knots;
          if (featured && truthy(get(rules, "fate_knots_reset_on_target_win", false))) knots = 0;
          if (!featured) knots = Math.min(knotsToGuarantee, knots + pyInt(item(rules, "fate_knot_per_non_target_five_star")));
        }
        updated = replace(updated, { weapon_five_star_pity: 0, weapon_four_star_pity: 0, weapon_fate_knots: knots });
      } else if (rarity === 4) {
        updated = replace(updated, { weapon_five_star_pity: previousFive + 1, weapon_four_star_pity: 0 });
      } else {
        updated = replace(updated, { weapon_five_star_pity: previousFive + 1, weapon_four_star_pity: fourCounter + 1 });
      }
    }

    const [rewardId, outcomePoolId] = this.resolveReward(banner, rarity, featured, rng);
    return {
      banner_id: bannerId,
      banner_type: banner.banner_type,
      rarity,
      reward_id: rewardId,
      outcome_pool_id: outcomePoolId,
      is_featured: featured,
      hard_pity_triggered: hardPityTriggered,
      featured_guarantee_triggered: featuredGuarantee,
      target_guarantee_triggered: targetGuarantee,
      minimum_four_star_triggered: minimumFourTriggered,
      rarity_probabilities: [
        [5, probabilities[5]],
        [4, probabilities[4]],
        [3, probabilities[3]],
      ],
      account_state: updated,
    };
  }

  // -- server/gacha_transaction.py (pure parts) -----------------------------------------------------------------

  /** `banners.pull_cost` (currently 1 Fate's Thread per pull). */
  pullCost(): number {
    return pyInt(item(this.banners(), "pull_cost"));
  }

  /** Signature weapons selectable in the Hall of Armaments, content order. */
  hallTargetIds(): string[] {
    return list(item(item(this.banners(), "standard_signature_weapon"), "selected_signature_ids")) as string[];
  }

  /** `open_banners(now, epoch)`: see gacha-rotation.ts. */
  openBanners(now: Date, epoch: Date | null): BannerWindow[] {
    return openBannerWindows(this.banners() as Row, now, epoch);
  }

  /** `banner_type_for`: the pity row a banner id uses. */
  static bannerTypeFor(bannerId: string): BannerType {
    if (bannerId.startsWith("character:") || bannerId === "limited_character") return "character";
    if (bannerId === "hall_of_ancestors") return "standard_character";
    if (bannerId.startsWith("weapon:") || bannerId === "limited_signature_weapon" || bannerId === HALL) return "weapon";
    throw new GachaError(`Unsupported banner ID: ${bannerId}`);
  }

  /**
   * `_resolve_and_persist_pulls` without the writes. `stored` is the `gacha_pity` payload of the banner's type (null when
   * absent), `openBannerIds` the ids of `openBanners(now, epoch)`. Pity is chained pull to pull from one RNG stream.
   */
  resolvePulls(input: {
    stored: unknown;
    banner_id: string;
    pull_count: number;
    open_banner_ids: readonly string[];
    target_id?: string | null;
    rng: CpythonRandom;
  }): PullPlan {
    const { banner_id: bannerId, pull_count: count, open_banner_ids: openIds, rng } = input;
    const targetId = input.target_id ?? null;
    if (!(ALLOWED_PULL_COUNTS as readonly number[]).includes(count)) {
      throw new GachaError(`pull_count must be one of (1, 10), got ${String(count)}`);
    }
    if (!(bannerId.startsWith("character:") || bannerId.startsWith("weapon:") || bannerId === "hall_of_ancestors" || bannerId === HALL)) {
      throw new GachaError(
        "This server only accepts explicit 'character:<pair_id>', 'weapon:<pair_id>', " +
          `'hall_of_ancestors' or 'hall_of_armaments' banner IDs: ${pyRepr(bannerId)}`,
      );
    }
    if (bannerId === HALL) {
      if (targetId === null || !this.hallTargetIds().includes(targetId)) {
        throw new GachaError(`hall_of_armaments needs a selectable target_id, got ${pyRepr(targetId)}`);
      }
    } else if (targetId !== null) {
      throw new GachaError("target_id only applies to hall_of_armaments");
    }
    if (!openIds.includes(bannerId)) throw new GachaError(`Banner ${pyRepr(bannerId)} is not open for pulls`);
    const bannerType = GachaRules.bannerTypeFor(bannerId);
    const totalCost = this.pullCost() * count;

    let state = pityStateFromPayload(input.stored);
    // Pity and Fate Knots are shared with the limited weapon banners; only the target changes (and is saved).
    if (bannerId === HALL) state = replace(state, { selected_weapon_target_id: targetId });
    const results: PullResult[] = [];
    let result = this.pull(state, bannerId, rng);
    for (let index = 0; index < count; index++) {
      if (index) result = this.pull(result.account_state, bannerId, rng);
      results.push(result);
    }
    return {
      banner_id: bannerId,
      banner_type: bannerType,
      pull_count: count,
      total_cost: totalCost,
      starting_state: state,
      results,
      final_state: result.account_state,
    };
  }

  // -- server/gacha_grants.py (pure parts) ----------------------------------------------------------------------

  private duplicatePolicy(): { shards: Map<number, number>; freeStart: Set<unknown>; rarity: Map<unknown, number> } {
    return this.memo("duplicatePolicy", () => {
      const policy = item(this.banners(), "duplicate_policy");
      const conversion = get(policy, "conversion");
      if (conversion !== "character_bound_memory_shards") {
        throw new GachaError(`Unsupported duplicate_policy.conversion: ${pyRepr(conversion)}`, "ValueError");
      }
      const byRarity = item(policy, "memory_shards_per_duplicate_by_rarity");
      if (!isObject(byRarity)) throw new GachaError(`'${pyTypeName(byRarity)}' object has no attribute 'items'`, "AttributeError");
      const shards = new Map<number, number>();
      for (const [rarity, amount] of Object.entries(byRarity)) shards.set(pyInt(rarity), pyInt(amount));
      const characters = rows(this.characters, "characters");
      const countFree = truthy(get(policy, "free_start_characters_count_as_owned"));
      const freeStart = new Set<unknown>();
      const rarity = new Map<unknown, number>();
      for (const row of characters) {
        if (countFree && eq(get(row, "acquisition"), "free_start")) freeStart.add(item(row, "character_id"));
      }
      for (const row of characters) rarity.set(item(row, "character_id"), pyInt(item(row, "rarity")));
      return { shards, freeStart, rarity };
    });
  }

  /**
   * `_grant_character`: a first copy inserts the roster row (level 1, copies 1); every duplicate increments `copies` and
   * adds the rarity's character-bound Memory Shards. Free starters (`acquisition == "free_start"`) count as owned, so their
   * first pull is already a duplicate.
   */
  characterGrant(characterId: string, existing: RosterCopies | null): CharacterGrantPlan {
    const { shards: byRarity, freeStart, rarity } = this.duplicatePolicy();
    let copies: number;
    let shardsBefore: number;
    if (existing === null) {
      copies = (freeStart.has(characterId) ? 1 : 0) + 1;
      shardsBefore = 0;
    } else {
      copies = pyInt(existing.copies) + 1;
      shardsBefore = pyInt(existing.memory_shards);
    }
    const duplicate = copies > 1;
    const shards = duplicate ? (byRarity.get(rarity.get(characterId) ?? 0) ?? 0) : 0;
    return {
      grant: { kind: "character", item_id: characterId, duplicate, copies, instance_id: null, memory_shards: shards },
      roster: { insert: existing === null, copies, memory_shards: shardsBefore + shards },
    };
  }

  // -- server/banner_status.py (pure part) ----------------------------------------------------------------------

  /**
   * `banner_state`: odds, pity and guarantee of `bannerId` for the stored state of its banner type. For the Hall of
   * Armaments the remembered target is used when still selectable, else the first selectable one.
   */
  bannerState(bannerId: string, stored: AccountPityState | null): BannerState {
    const bannerType = GachaRules.bannerTypeFor(bannerId);
    let state = stored ?? pityState();
    const rules = item(this.banners(), bannerType);
    let selected: string | null = null;
    if (bannerId === HALL) {
      const targets = this.hallTargetIds();
      const remembered = state.selected_weapon_target_id;
      selected = remembered !== null && targets.includes(remembered) ? remembered : (targets[0] ?? null);
      state = replace(state, { selected_weapon_target_id: selected });
    }
    const odds = this.describeNextPull(state, bannerId);

    let kind: BannerState["guarantee"]["kind"] = "none";
    let active = false;
    let text = "";
    let knots: number | null = null;
    let needed: number | null = null;
    if (bannerType === "character") {
      kind = "featured_character";
      active = state.lost_featured_next_five_star_guaranteed;
      if (active) text = "Next 5★ is guaranteed to be the featured hero";
    } else if (bannerType === "weapon") {
      kind = "weapon_target";
      knots = state.weapon_fate_knots;
      needed = pyInt(item(rules, "fate_knots_to_guarantee"));
      active = knots >= needed;
      if (active) {
        text = bannerId === HALL ? "Next 5★ is guaranteed to be your selected weapon" : "Next 5★ is guaranteed to be the featured weapon";
      } else if (knots) {
        text = `Fate Knots: ${knots}/${needed}`;
      }
    }
    return {
      pity: odds.five_star_pity,
      hard_pity: odds.hard_pity,
      pulls_until_hard_pity: odds.pulls_until_hard_pity,
      four_star_pity: odds.four_star_pity,
      four_star_guarantee_every: odds.four_star_every,
      four_star_guaranteed_next: odds.four_star_guaranteed,
      next_pull: { five_star: odds.five_star, four_star: odds.four_star, three_star: odds.three_star },
      guarantee: { kind, active, fate_knots: knots, fate_knots_needed: needed, text },
      selected_target_id: selected,
    };
  }

  /** One `GET /v1/gacha/banners` entry for an open window and the stored state of its banner type. */
  bannerInfo(window: BannerWindow, stored: AccountPityState | null): BannerInfo {
    const state = this.bannerState(window.banner_id, stored);
    return {
      banner_id: window.banner_id,
      banner_type: GachaRules.bannerTypeFor(window.banner_id),
      pull_cost: this.pullCost(),
      closes_at: window.closes_at ? isoUtc(window.closes_at) : null,
      target_ids: window.banner_id === HALL ? this.hallTargetIds() : null,
      ...state,
    };
  }
}

/** A weapon grant: every weapon pull becomes a new `inventory_weapons` instance (LEGACY ids `wpn_<32 hex>`). */
export const weaponGrant = (weaponId: string, instanceId: string): Grant => ({
  kind: "weapon",
  item_id: weaponId,
  duplicate: false,
  copies: null,
  instance_id: instanceId,
  memory_shards: 0,
});

/** What `grant_pull_result` grants: nothing for an unresolved loss, characters on character banners, else weapons. */
export function grantKindFor(result: PullResult): "character" | "weapon" | null {
  if (result.reward_id === null) return null;
  return result.banner_type === "character" || result.banner_type === "standard_character" ? "character" : "weapon";
}

export function pullResultToDict(result: PullResult): PullResultDict {
  return {
    banner_id: result.banner_id,
    banner_type: result.banner_type,
    rarity: result.rarity,
    reward_id: result.reward_id,
    outcome_pool_id: result.outcome_pool_id,
    is_featured: result.is_featured,
    hard_pity_triggered: result.hard_pity_triggered,
    featured_guarantee_triggered: result.featured_guarantee_triggered,
    target_guarantee_triggered: result.target_guarantee_triggered,
    minimum_four_star_triggered: result.minimum_four_star_triggered,
  };
}

/** `pulls_to_response` as the `GachaPullResponse` model serializes it. */
export function pullsToResponse(outcomes: readonly PullOutcome[]): GachaPullResponse {
  if (outcomes.length === 0) throw new GachaError("list index out of range", "KeyError");
  return {
    ...pullResultToDict(outcomes[outcomes.length - 1]!.result),
    pull_count: outcomes.length,
    results: outcomes.map(({ pull_id, result, grant }) => ({ pull_id, ...pullResultToDict(result), grant })),
  };
}

/** The idempotency fingerprint of `POST /v1/gacha/pull` (a single pull keeps its historical form, the banner id). */
export function pullFingerprint(bannerId: string, pullCount: number, targetId: string | null = null): string {
  let fingerprint = pullCount === 1 ? bannerId : `${bannerId}|x${pullCount}`;
  if (targetId !== null) fingerprint += `|target=${targetId}`;
  return fingerprint;
}
