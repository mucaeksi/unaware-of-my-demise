# Entry support form — local implementation, 2026-10-07

`POST /v1/support` accepts `reply_email`, `subject` (3–80 characters), `message` (20–3000), `category`, `consent: true`, and `client_version`. Categories: `sign_in`, `update`, `account`, `gameplay`, `performance`, `other`.

It works without a session, database connection, or release admission. The separate `SUPPORT_LIMITER` permits 3 requests per IP per minute; an absent limiter fails closed. Bodies are bounded at 16 KiB, unexpected fields and header/control injection are rejected. The recipient is fixed by the existing owner address in `src/web.ts`; the client cannot choose it. Request logs exclude contact/message data. A provider failure returns a generic error without logging its potentially private message.

`202 {accepted:true,reference}` is returned only after `SupportMailer.send` resolves with a provider receipt. It means submission accepted, not guaranteed arrival in the destination inbox. No automatic retry occurs in the game. Validation/network/provider errors preserve the form draft. No real email was sent during tests.

## Activation still required

Local scope forbids deployment. There is currently no `SUPPORT_MAIL` binding or verified `SUPPORT_FROM` in the project. The local route truthfully answers `503 SUPPORT_UNAVAILABLE` until configured. The currently deployed Worker has not received this new route.

After the owner supplies a verified sender, add the binding to the target environment and set `SUPPORT_FROM` to that sender. The existing rate-limit bindings are already in `wrangler.jsonc`. An example for review (replace the sender placeholder):

```json
"send_email": [{
  "name": "SUPPORT_MAIL",
  "destination_address": "unawareofmydemise@gmail.com",
  "allowed_sender_addresses": ["support@OWNER_VERIFIED_DOMAIN"]
}]
```

Set `vars.SUPPORT_FROM` to the same sender. Staging bindings/vars must be configured separately. Validate the sender domain and destination in the account before an authorized deployment and controlled inbox delivery check.

The native structured sending API and address restrictions follow [Cloudflare Workers email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/) and [send binding configuration](https://developers.cloudflare.com/email-service/configuration/send-bindings/). If the owner has no sending domain, an authenticated mail provider can implement the same `SupportMailer` interface; the game/form contract stays the same.

## Verification

- `test/support.test.ts`: 14 tests; successful provider acceptance, maintenance/DB outage/sign-out, invalid data, oversized body, unavailable configuration, provider privacy, rate limit, fixed recipient and reply-to mapping.
- Complete server suite: **517/517**, 41 files. Disposable PostgreSQL cluster on loopback port 54319, stopped after testing.
- TypeScript strict check passed; Wrangler dry-run build passed. No deployment occurred.
- Godot tests verify the public wire payload, no account authorization headers, no automatic retries, malformed replies, validation, busy state, keyboard reachability and retained draft.
