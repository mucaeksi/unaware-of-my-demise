/** Typed client for /admin/api. Credentials are the Cloudflare Access cookie; nothing is stored in the page. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/admin/api${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    credentials: 'same-origin'
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page (e.g. Access login) */
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, b.error ?? 'http_error', b.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export interface Health {
  ok: boolean;
  environment: string;
  auth_configured: boolean;
  signing_configured: boolean;
}
export interface Me {
  identity: string;
  role: 'viewer' | 'operator' | 'owner';
  mfaVerified?: boolean;
}
export interface SystemStatus {
  environment: string;
  time: string;
  d1: { ok: boolean; latency_ms: number; size_bytes: number; counts: Record<string, number>; migrations: { name: string; applied_at: string }[] };
  r2: { ok: boolean; objects_listed?: number; bytes_listed?: number; error?: string };
  pointers: { channel: string; release_id: string; version: number; updated_at: string; updated_by: string }[];
  limits: { d1_rows_read_per_day: number; d1_rows_written_per_day: number; d1_storage_bytes_total: number; d1_bytes_per_database: number };
  usage_source: string;
  auth: { access_configured: boolean; signing_configured: boolean; mfa_enforced?: boolean };
}
export interface Character {
  id: string;
  name_en: string;
  rarity: number;
  element: string;
  role: string;
  age: number;
  acquisition: string;
  base_hp: number;
  base_atk: number;
  base_def: number;
  base_spd: number;
  status: 'active' | 'hidden' | 'retired';
  version: number;
  updated_at: string;
  updated_by: string;
}
export interface Asset {
  id: number;
  path: string;
  sha256: string;
  bytes: number;
  media_type: string;
  kind: string;
  source: string;
  license: string;
  status: string;
  created_by: string;
  created_at?: string;
  object_stored?: number;
}
export interface Release {
  id: string;
  generation: number;
  channel: 'dev' | 'staging' | 'production';
  state: 'draft' | 'published' | 'retired';
  depends_on: string | null;
  min_client: string;
  max_client: string | null;
  content_schema: number;
  notes: string;
  created_by: string;
  created_at: string;
  published_at: string | null;
  files: number;
  is_current?: number | null;
}
export interface ReleaseDetail extends Release {
  manifest: {
    release: { id: string; generation: number; channel: string; notes: string };
    compat: { min_client: string; max_client?: string; content_schema: number; required_capabilities?: string[] };
    rollout: { percent: number; kill_switch?: boolean };
    files: { path: string; sha256: string; bytes: number }[];
  };
  mediaProvenance?: { approved: string[]; pendingPreviewMedia: string[] };
}
export interface ReleaseDiff {
  releaseId: string;
  channel: string;
  againstId: string | null;
  added: { path: string; sha256: string }[];
  changed: { path: string; beforeSha256: string; afterSha256: string }[];
  removed: { path: string; sha256: string }[];
  unchangedCount: number;
  mediaProvenance: { approved: string[]; pendingPreviewMedia: string[] };
}
export interface EconomicPolicyInfo {
  releaseId: string;
  channel: string;
  policy: { release_id: string; mode: 'allowlisted' | 'grace' | 'revoked'; version: number; valid_until: string | null; cutover_at: string | null; reason: string; updated_by: string; updated_at: string } | null;
  pointer: { release_id: string; economic_floor: number } | null;
}
export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string;
}
export interface ApprovalEntry extends AuditEntry {
  actor_role: 'owner' | 'operator' | 'viewer';
}
export interface CatalogSnapshot {
  path: string;
  sha256: string;
  bytes: number;
  json: string;
  counts: Record<string, number>;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sha256HexBrowser(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const EXT_MEDIA_TYPES: Record<string, string> = {
  json: 'application/json',
  webp: 'image/webp',
  png: 'image/png',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  txt: 'text/plain',
  atlas: 'text/plain'
};

export function mediaTypeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MEDIA_TYPES[ext] ?? 'application/octet-stream';
}

export function newRequestId(prefix = 'req'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
