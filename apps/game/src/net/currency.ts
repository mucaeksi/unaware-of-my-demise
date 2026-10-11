/** The single main currency (D-17). The name is served by the API (`GET /api/v1/currency`) so it can change without a client release. */
export const currency = { id: 'eclipse_token', name: "Bell's Remains" };

export async function loadCurrencyName(base: string): Promise<void> {
  try {
    const r = await fetch(`${base}/api/v1/currency`);
    if (!r.ok) return;
    const j = (await r.json()) as { id?: string; name?: string };
    if (typeof j.name === 'string' && j.name.length > 0 && j.name.length <= 40) currency.name = j.name;
  } catch {
    /* offline: the built-in name is fine */
  }
}
