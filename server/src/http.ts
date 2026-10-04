// The LEGACY wire contract (server/app.py): JSON bodies, errors as {"error": {"code", "message"}}.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Request bodies above this are rejected before parsing (every endpoint takes a small JSON object). */
export const MAX_BODY_BYTES = 16 * 1024;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(error: ApiError, headers: Record<string, string> = {}): Response {
  return json({ error: { code: error.code, message: error.message } }, error.status, headers);
}

export const invalid = (message: string): ApiError => new ApiError(400, "INVALID_REQUEST", message);
export const unauthorized = (message: string): ApiError => new ApiError(401, "UNAUTHORIZED", message);

/** The request's JSON object body (size-capped); anything else is a 400. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw invalid("Request body is too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw invalid("Request body is too large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalid("Request body must be JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw invalid("Request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, field: string, maxLength: number): string {
  const value = body[field];
  if (typeof value !== "string" || value.length === 0) throw invalid(`${field} is required`);
  if (value.length > maxLength) throw invalid(`${field} is too long`);
  return value;
}

/** ISO-8601 UTC with a "Z" suffix, the LEGACY timestamp format. */
export const isoUtc = (value: Date): string => value.toISOString();
