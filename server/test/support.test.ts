import { describe, expect, it, vi } from "vitest";
import { createApp, type LogEntry } from "../src/app";
import { CloudflareSupportMailer, type SupportMailer } from "../src/support";
import { SUPPORT_EMAIL } from "../src/web";

const payload = { reply_email: "player@example.test", subject: "Google chooser unavailable", message: "The account chooser does not open when I select Continue with Google.", category: "sign_in", consent: true, client_version: "versionCode 1" };
const request = (body: unknown = payload) => new Request("https://api.test/v1/support", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "192.0.2.4" }, body: JSON.stringify(body) });
function fixture(mailer: SupportMailer | null = { send: vi.fn(async () => "provider-receipt") }) {
  const entries: LogEntry[] = [];
  const connect = vi.fn(async () => { throw new Error("Database offline"); });
  const limiter = { limit: vi.fn(async () => ({ success: true })) } as unknown as RateLimit;
  const app = createApp({ connect, verifier: null, supportMailer: mailer, supportLimiter: limiter, log: (entry) => entries.push(entry), release: { sourceSha: null, minClientVersionCode: 99, maintenanceMessage: "Maintenance" } });
  return { app, connect, entries, limiter, mailer };
}
describe("public support form", () => {
  it("accepts a report during maintenance/sign-out/database outage only after the mail provider accepts it", async () => {
    const { app, connect, entries, mailer, limiter } = fixture();
    const response = await app(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, reference: "provider-receipt" });
    expect(connect).not.toHaveBeenCalled();
    expect(limiter.limit).toHaveBeenCalledWith({ key: "192.0.2.4" });
    expect(mailer!.send).toHaveBeenCalledWith({ replyEmail: payload.reply_email, subject: payload.subject, message: payload.message, category: payload.category, clientVersion: payload.client_version });
    expect(JSON.stringify(entries)).not.toContain(payload.reply_email);
    expect(JSON.stringify(entries)).not.toContain(payload.message);
  });
  it.each([
    { ...payload, reply_email: "bad-address" }, { ...payload, reply_email: "a@b.test\r\nBcc: attacker@bad.test" },
    { ...payload, subject: "title\nBcc: injected" }, { ...payload, message: "too short" },
    { ...payload, message: "a".repeat(3001) }, { ...payload, message: "bad\u0000".repeat(20) },
    { ...payload, consent: false }, { ...payload, category: "unknown" }, { ...payload, to: "attacker@bad.test" },
  ])("rejects invalid input before sending", async (body) => {
    const { app, mailer } = fixture();
    expect((await app(request(body))).status).toBe(400);
    expect(mailer!.send).not.toHaveBeenCalled();
  });
  it("bounds a streamed oversized body", async () => {
    const { app, mailer } = fixture();
    expect((await app(request({ ...payload, message: "z".repeat(17000) }))).status).toBe(400);
    expect(mailer!.send).not.toHaveBeenCalled();
  });
  it("refuses unavailable configuration and never exposes provider errors or contact data", async () => {
    expect((await fixture(null).app(request())).status).toBe(503);
    const failed = fixture({ send: async () => { throw new Error(payload.reply_email + payload.message); } });
    const response = await failed.app(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(payload.reply_email);
    expect(JSON.stringify(failed.entries)).not.toContain(payload.message);
  });
  it("enforces a separate rate limit and fails closed if the budget is absent", async () => {
    const { app, limiter, mailer } = fixture();
    vi.mocked(limiter.limit).mockResolvedValue({ success: false });
    const response = await app(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mailer!.send).not.toHaveBeenCalled();
    const unconfigured = createApp({ connect: async () => { throw new Error("Must not connect"); }, verifier: null, supportMailer: mailer });
    expect((await unconfigured(request())).status).toBe(503);
  });
  it("fixes the owner recipient and uses the player's address only for replies", async () => {
    const send = vi.fn(async (_builder: EmailMessageBuilder) => ({ messageId: "receipt" }));
    const mailer = new CloudflareSupportMailer({ send } as unknown as SendEmail, "support@owned-domain.test");
    expect(await mailer.send({ replyEmail: payload.reply_email, subject: payload.subject, message: payload.message, category: payload.category, clientVersion: payload.client_version })).toBe("receipt");
    expect(send.mock.calls[0]![0]).toMatchObject({ to: SUPPORT_EMAIL, from: { email: "support@owned-domain.test" }, replyTo: payload.reply_email, text: expect.stringContaining(payload.message) });
  });
});
