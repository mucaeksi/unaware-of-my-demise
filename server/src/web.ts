// Public web pages of the game Worker (outside /v1, readable in any browser). The account-deletion page (INF-020, OQ-016,
// owner decision D-01) is the link Google Play's Data safety form asks for: a player who no longer has the app can
// delete the account here by choosing the same Google account; the page also explains the in-app path and the support
// address. The deletion itself is the same as in the app: a fresh Google ID token for a fresh server nonce, then
// deleteAccount (every row cascades, an anonymous record stays).

/** The support address players and stores see (owner decision D-01). */
export const SUPPORT_EMAIL = "unawareofmydemise@gmail.com";

/** How long the database keeps history a deleted row can still be found in (Neon point-in-time restore, D-05). */
export const BACKUP_HISTORY = "6 hours";

const base64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

/** A value placed inside an inline script: JSON, with "<" escaped so it can never close the script element. */
const scriptValue = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * The deletion page. `webClientId` is the Web OAuth client the Worker accepts ID tokens for (GOOGLE_CLIENT_IDS); null
 * means sign-in is not configured, and the page then offers the app and the support address only.
 */
export function accountDeletionPage(webClientId: string | null): Response {
  const nonce = base64(crypto.getRandomValues(new Uint8Array(16)));
  const gis = "https://accounts.google.com/gsi/";
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${gis}client`,
    `style-src 'nonce-${nonce}' ${gis}style`,
    `frame-src ${gis}`,
    `connect-src 'self' ${gis}`,
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Delete your account — Unaware of My Demise</title>
<style nonce="${nonce}">
  :root { color-scheme: dark; --bg: #121014; --panel: #1d1a21; --text: #e9e4ee; --muted: #a79fb0; --line: #352f3c; --danger: #d0454c; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 8px; }
  h2 { font-size: 1.1rem; margin: 28px 0 8px; }
  p, li { color: var(--text); }
  .muted { color: var(--muted); }
  section.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-top: 16px; }
  ul { padding-left: 20px; }
  a { color: #c9a6ff; }
  button { font: inherit; padding: 10px 16px; border-radius: 8px; border: 0; cursor: pointer; }
  button.danger { background: var(--danger); color: #fff; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  label { display: flex; gap: 8px; align-items: flex-start; margin: 12px 0; }
  [hidden] { display: none !important; }
  #status { margin-top: 12px; }
</style>
</head>
<body>
<main>
  <h1>Delete your Unaware of My Demise account</h1>
  <p class="muted">Deleting your account is permanent and cannot be undone.</p>

  <h2>What is deleted</h2>
  <ul>
    <li>Your game account and everything in it: characters, items, currencies, story and stage progress, quest and mail
      claims, pull history, and your signed-in sessions on every device.</li>
    <li>The link between your Google account and the game. The game never stores your Google e-mail address or name.</li>
  </ul>
  <h2>What is kept</h2>
  <ul>
    <li>An anonymous record that a deletion happened: the random account id, when the account was created and deleted,
      and how the deletion was confirmed. Nothing in it identifies you.</li>
    <li>Records of support actions our operators took on the account, which refer only to that random account id.</li>
    <li>The database's own recovery history keeps changes for ${BACKUP_HISTORY}; after that the deleted data is gone
      from it as well.</li>
  </ul>

  <h2>How to delete</h2>
  <section class="panel">
    <strong>In the game</strong>
    <p>Open <em>Settings</em>, choose <em>Delete account</em>, and confirm with the same Google account.</p>
  </section>

  <section class="panel" id="web-delete"${webClientId ? "" : " hidden"}>
    <strong>Here, without the app</strong>
    <p>Choose the Google account you play with. Nothing is deleted until you confirm in the next step.</p>
    <div id="google-button"></div>
    <div id="confirm" hidden>
      <label><input type="checkbox" id="understand"> I understand that my account and all of its game data will be
        deleted permanently.</label>
      <button class="danger" id="delete" disabled>Delete my account permanently</button>
    </div>
    <p id="status" role="status" aria-live="polite"></p>
  </section>

  <section class="panel">
    <strong>Need help?</strong>
    <p>Write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. If you still have the game, use <em>Settings →
      Contact support</em>: the message it opens names your account, so we can find it.</p>
  </section>
</main>
${webClientId ? `<script src="${gis}client" async defer nonce="${nonce}"></script>
<script nonce="${nonce}">
(() => {
  const clientId = ${scriptValue(webClientId)};
  const status = document.getElementById("status");
  const confirmBox = document.getElementById("confirm");
  const understand = document.getElementById("understand");
  const deleteButton = document.getElementById("delete");
  let credential = null;

  const say = (text) => { status.textContent = text; };

  async function start() {
    credential = null;
    confirmBox.hidden = true;
    understand.checked = false;
    deleteButton.disabled = true;
    let nonce;
    try {
      const response = await fetch("/v1/auth/nonce", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      nonce = (await response.json()).nonce;
    } catch {
      say("The service is not reachable right now. Please try again later, or write to us.");
      return;
    }
    google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      auto_select: false,
      callback: (answer) => {
        credential = answer.credential;
        confirmBox.hidden = false;
        say("Google account chosen. Confirm below to delete the game account linked to it.");
      },
    });
    google.accounts.id.renderButton(document.getElementById("google-button"), { theme: "filled_black", size: "large", text: "continue_with" });
  }

  understand.addEventListener("change", () => { deleteButton.disabled = !understand.checked || credential === null; });
  deleteButton.addEventListener("click", async () => {
    deleteButton.disabled = true;
    say("Deleting…");
    let response;
    try {
      response = await fetch("/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential }),
      });
    } catch {
      say("The service is not reachable right now. Nothing was deleted; please try again.");
      deleteButton.disabled = false;
      return;
    }
    if (response.ok) {
      document.getElementById("google-button").hidden = true;
      confirmBox.hidden = true;
      say("Your account and its game data have been deleted.");
      return;
    }
    const message = response.status === 404
      ? "No game account is linked to that Google account. Nothing was deleted."
      : response.status === 429 ? "Too many attempts. Please wait a minute and try again."
      : "The deletion could not be confirmed. Nothing was deleted; please choose your Google account again.";
    say(message);
    await start();
  });

  window.addEventListener("load", start);
})();
</script>` : ""}
</body>
</html>`;
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": csp,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    },
  });
}
