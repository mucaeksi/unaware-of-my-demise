// Random tokens and digests (WebCrypto: the same code runs in workerd and Node).

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export function randomBytes(count: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(count));
}

export const randomHex = (count: number): string => toHex(randomBytes(count));

/** Python `secrets.token_urlsafe(count)`: base64url without padding. */
export function randomUrlSafe(count: number): string {
  let binary = "";
  for (const byte of randomBytes(count)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

/** A uniformly random character of `alphabet` (rejection sampling, no modulo bias). */
export function randomChoice(alphabet: string): string {
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    const byte = randomBytes(1)[0]!;
    if (byte < limit) return alphabet[byte % alphabet.length]!;
  }
}
