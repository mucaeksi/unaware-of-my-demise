// Release identity and the client bootstrap contract (INF-003/004, docs/INFRASTRUCTURE_ROADMAP.md). `GET /v1/bootstrap`
// tells a client, before it signs in, whether it may play against this deployment: the API and snapshot versions it
// must speak, the lowest app versionCode still served, the hash of the rules content both sides must share, the source
// commit of this deployment and whether the game is in maintenance. The client's mirror is game/scripts/app/client_release.gd.
import manifest from "../../game/data/content/MANIFEST.json";
import { sha256Hex } from "./crypto";
import { ApiError, invalid, isoUtc } from "./http";
import { SNAPSHOT_SCHEMA_VERSION } from "./state";

/** The wire contract version of the /v1 routes; a client built for another one must update. */
export const API_VERSION = 1;

/**
 * The content packs the server rules are built from (the files server/src/rules.ts bundles). Client and server must hold
 * byte-identical copies, or the server re-simulates a different battle than the client fought. Sorted by name.
 */
export const RULES_FILES: readonly string[] = [
  "accessories_part1.json",
  "armors_part1.json",
  "battle_effects_part1.json",
  "battle_rules_part1.json",
  "characters_part1.json",
  "drop_tables_part1.json",
  "economy_part1.json",
  "enemies_part1.json",
  "items_part1.json",
  "stages_part1.json",
  "story_script_part1_manifest.json",
  "weapons_part1.json",
];

type Manifest = { files?: Record<string, { sha256?: unknown }> };

/**
 * SHA-256 (hex) of the lines "<file> <sha256 of the file>\n" for `files` in name order, the file hashes taken from a
 * content MANIFEST.json. The client computes the same from its shipped manifest (shared test vector in both test suites).
 */
export async function rulesHash(content: Manifest, files: readonly string[] = RULES_FILES): Promise<string> {
  const lines = [...files].sort().map((file) => {
    const digest = content.files?.[file]?.sha256;
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) throw new Error(`content manifest has no sha256 for ${file}`);
    return `${file} ${digest}\n`;
  });
  return sha256Hex(lines.join(""));
}

let bundledRulesHash: Promise<string> | null = null;

/** The rules hash of the content bundled into this Worker (computed once per isolate). */
export const serverRulesHash = (): Promise<string> => (bundledRulesHash ??= rulesHash(manifest as Manifest));

export interface ReleaseConfig {
  /** The git commit this Worker was built from; null = not recorded (a local or test run). */
  sourceSha: string | null;
  /** Clients below this Android versionCode must update before they may call the API. */
  minClientVersionCode: number;
  /** Non-empty = maintenance: every game route answers 503 MAINTENANCE with this message. */
  maintenanceMessage: string;
}

export const DEVELOPMENT_RELEASE: ReleaseConfig = { sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "" };

/** Reads the Worker variables; a malformed value is a deployment error and throws (the deploy health check fails). */
export function parseReleaseConfig(vars: { RELEASE_SOURCE_SHA?: string; MIN_CLIENT_VERSION_CODE?: string; MAINTENANCE_MESSAGE?: string }): ReleaseConfig {
  const sha = (vars.RELEASE_SOURCE_SHA ?? "").trim().toLowerCase();
  if (sha && !/^[0-9a-f]{40}$/.test(sha)) throw new Error("RELEASE_SOURCE_SHA must be a 40-character git commit id");
  const minimum = (vars.MIN_CLIENT_VERSION_CODE ?? "").trim() || "1";
  if (!/^[1-9][0-9]{0,9}$/.test(minimum)) throw new Error("MIN_CLIENT_VERSION_CODE must be a positive integer");
  return { sourceSha: sha || null, minClientVersionCode: Number(minimum), maintenanceMessage: (vars.MAINTENANCE_MESSAGE ?? "").trim() };
}

export async function bootstrap(config: ReleaseConfig, now: Date): Promise<Record<string, unknown>> {
  return {
    api_version: API_VERSION,
    snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
    min_client_version_code: config.minClientVersionCode,
    rules_hash: await serverRulesHash(),
    source_sha: config.sourceSha,
    maintenance: { active: config.maintenanceMessage !== "", message: config.maintenanceMessage },
    server_time_utc: isoUtc(now),
  };
}

export const CLIENT_VERSION_HEADER = "x-client-version-code";

/**
 * Refuses a request the deployment does not serve: 426 UPDATE_REQUIRED for an app below the minimum versionCode (the
 * header is optional, so tools and tests without it pass; every shipped client sends it), then 503 MAINTENANCE.
 */
export function admit(request: Request, config: ReleaseConfig): void {
  const header = request.headers.get(CLIENT_VERSION_HEADER);
  if (header !== null) {
    if (!/^[1-9][0-9]{0,9}$/.test(header.trim())) throw invalid("X-Client-Version-Code must be a positive integer");
    if (Number(header.trim()) < config.minClientVersionCode) {
      throw new ApiError(426, "UPDATE_REQUIRED", "This version of the game is no longer supported; please update it");
    }
  }
  if (config.maintenanceMessage) throw new ApiError(503, "MAINTENANCE", config.maintenanceMessage);
}
