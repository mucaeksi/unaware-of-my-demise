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
}
export interface SystemStatus {
  environment: string;
  time: string;
  d1: { ok: boolean; latency_ms: number; size_bytes: number; counts: Record<string, number>; migrations: { name: string; applied_at: string }[] };
  r2: { ok: boolean; objects_listed?: number; bytes_listed?: number; error?: string };
  pointers: { channel: string; release_id: string; version: number; updated_at: string; updated_by: string }[];
  limits: { d1_rows_read_per_day: number; d1_rows_written_per_day: number; d1_storage_bytes_total: number; d1_bytes_per_database: number };
  usage_source: string;
  auth: { access_configured: boolean; signing_configured: boolean };
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
}
export interface Release {
  id: string;
  generation: number;
  channel: 'dev' | 'staging' | 'production';
  state: 'draft' | 'published' | 'retired';
  depends_on: string | null;
  notes: string;
  created_by: string;
  created_at: string;
  published_at: string | null;
  files: number;
  is_current?: number | null;
}
export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string;
}
