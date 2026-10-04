"use client";

// The operator panel (INF-033, DEC-0033). A static page served by the admin Worker behind Cloudflare Access; it talks
// only to the same-origin admin API (/admin/api/*). There is no login form: Access signs the operator in, the API
// checks the Access token and the operator's role on every request. Every change asks for a reason and carries a fresh
// Idempotency-Key, and the API writes the audit row in the same transaction as the change.
import { FormEvent, useEffect, useState } from "react";

type Tab = "service" | "player" | "liveops" | "audit";
type Me = { email: string; role: "viewer" | "support" | "operator"; permissions: string[] };
type Row = Record<string, unknown>;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: `HTTP ${response.status}` } };
  }
  if (!response.ok) throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`);
  return body as T;
}

function change<T>(path: string, reason: string, fields: Record<string, unknown> = {}): Promise<T> {
  return api<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ ...fields, reason }),
  });
}

function Table({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (rows.length === 0) return <p className="muted">Nothing recorded.</p>;
  return (
    <div className="scrollTable">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>
                  <code>{typeof row[column] === "object" && row[column] !== null ? JSON.stringify(row[column]) : String(row[column] ?? "")}</code>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("service");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [service, setService] = useState<Row | null>(null);
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("");
  const [state, setState] = useState<Row | null>(null);
  const [journal, setJournal] = useState<Row[]>([]);
  const [pulls, setPulls] = useState<Row[]>([]);
  const [claims, setClaims] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [audit, setAudit] = useState<Row[]>([]);
  const [liveops, setLiveops] = useState<Row | null>(null);
  const [configText, setConfigText] = useState('{\n  "flags": {},\n  "notices": []\n}');
  const [mailText, setMailText] = useState(
    '{\n  "title_en": "",\n  "body_en": "",\n  "rewards": {},\n  "starts_at_utc": "2026-01-01T00:00:00Z",\n  "expires_at_utc": "2026-01-08T00:00:00Z"\n}',
  );
  const [liveopsReason, setLiveopsReason] = useState("");

  const run = async (work: () => Promise<void>) => {
    setError("");
    setNotice("");
    try {
      await work();
    } catch (failure) {
      setError((failure as Error).message);
    }
  };

  useEffect(() => {
    void run(async () => {
      setMe(await api<Me>("/admin/api/me"));
      setService(await api<Row>("/admin/api/service"));
    });
  }, []);

  const can = (permission: string) => me?.permissions.includes(permission) ?? false;

  const search = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const found = await api<{ players: Row[] }>(`/admin/api/players?query=${encodeURIComponent(query.trim())}`);
      const account = found.players[0]?.account_id as string | undefined;
      if (!account) throw new Error("No player with that account id or friend code.");
      setAccountId(account);
      setState((await api<{ state: Row }>(`/admin/api/players/${account}/state`)).state);
      setJournal((await api<{ entries: Row[] }>(`/admin/api/players/${account}/journal`)).entries);
      setPulls((await api<{ pulls: Row[] }>(`/admin/api/players/${account}/pulls`)).pulls);
      setClaims(await api<Row>(`/admin/api/players/${account}/claims`));
    });
  };

  const revokeSessions = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const done = await change<{ revoked_sessions: number }>(`/admin/api/players/${accountId}/revoke-sessions`, reason);
      setNotice(`Signed out of ${done.revoked_sessions} session(s).`);
      setReason("");
    });
  };

  const loadLiveops = () =>
    void run(async () => {
      setLiveops(await api<Row>("/admin/api/liveops"));
    });

  const publishConfig = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const done = await change<{ revision: number }>("/admin/api/liveops/config", liveopsReason, { config: JSON.parse(configText) });
      setNotice(`Published config revision ${done.revision}.`);
      setLiveopsReason("");
      setLiveops(await api<Row>("/admin/api/liveops"));
    });
  };

  const sendMail = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const done = await change<{ mail_id: string }>("/admin/api/mail", liveopsReason, JSON.parse(mailText));
      setNotice(`Sent ${done.mail_id}.`);
      setLiveopsReason("");
      setLiveops(await api<Row>("/admin/api/liveops"));
    });
  };

  const loadAudit = () =>
    void run(async () => {
      const target = accountId ? `?target=${accountId}` : "";
      setAudit((await api<{ entries: Row[] }>(`/admin/api/audit${target}`)).entries);
    });

  if (!me) {
    return (
      <main className="login">
        <div className="loginCard">
          <div className="brand centered"><div className="brandMark">U</div></div>
          <h1>Unaware of My Demise — Operations</h1>
          <p>{error || "Checking your Cloudflare Access sign-in..."}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">U</div>
          <div><strong>Operations</strong><small>{me.email} · {me.role}</small></div>
        </div>
        <nav>
          <button className={`navItem ${tab === "service" ? "active" : ""}`} onClick={() => setTab("service")}>Service</button>
          <button className={`navItem ${tab === "player" ? "active" : ""}`} onClick={() => setTab("player")}>Player</button>
          <button className={`navItem ${tab === "liveops" ? "active" : ""}`} onClick={() => { setTab("liveops"); loadLiveops(); }}>Live ops</button>
          {can("audit.read") && <button className={`navItem ${tab === "audit" ? "active" : ""}`} onClick={() => { setTab("audit"); loadAudit(); }}>Audit</button>}
        </nav>
      </aside>
      <main className="content">
        {error && <p className="alert error">{error}</p>}
        {notice && <p className="alert success">{notice}</p>}
        {tab === "service" && service && (
          <section className="panel full">
            <h2>Service</h2>
            <pre className="manifest">{JSON.stringify(service, null, 2)}</pre>
          </section>
        )}
        {tab === "player" && (
          <div className="panelGrid">
            <section className="panel">
              <h2>Find a player</h2>
              <form className="form" onSubmit={search}>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="acct_... or friend code XXXX-XXXX" />
                <button type="submit">Search</button>
              </form>
              <p className="muted">Every lookup is recorded in the audit trail.</p>
              {accountId && can("player.support") && (
                <form className="form" onSubmit={revokeSessions}>
                  <h2>Sign the player out everywhere</h2>
                  <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (ticket, what happened)" />
                  <button className="danger ghost" type="submit" disabled={reason.trim().length < 5}>Revoke sessions</button>
                </form>
              )}
            </section>
            {accountId && (
              <section className="panel">
                <h2>{accountId}</h2>
                <pre className="manifest">{JSON.stringify(state, null, 2)}</pre>
              </section>
            )}
            {accountId && (
              <section className="panel full">
                <h2>Economic journal (newest first)</h2>
                <Table rows={journal} columns={["entry_id", "created_at", "endpoint", "resource_kind", "resource_id", "delta", "balance_after", "operation_key"]} />
              </section>
            )}
            {accountId && (
              <section className="panel full">
                <h2>Pulls</h2>
                <Table rows={pulls} columns={["seq", "created_at", "banner_id", "rarity", "reward_id", "is_featured", "hard_pity_triggered"]} />
              </section>
            )}
            {accountId && claims && (
              <section className="panel full">
                <h2>Claims</h2>
                <pre className="manifest">{JSON.stringify(claims, null, 2)}</pre>
              </section>
            )}
          </div>
        )}
        {tab === "liveops" && (
          <div className="panelGrid">
            <section className="panel full">
              <h2>Running now</h2>
              <pre className="manifest">{JSON.stringify(liveops, null, 2)}</pre>
            </section>
            {can("liveops.write") && (
              <section className="panel full">
                <h2>Publish (every change needs a reason and is audited)</h2>
                <input value={liveopsReason} onChange={(event) => setLiveopsReason(event.target.value)} placeholder="Reason" />
                <div className="two">
                  <form className="form" onSubmit={publishConfig}>
                    <label className="muted">New config revision (flags, notices with UTC times)</label>
                    <textarea rows={12} value={configText} onChange={(event) => setConfigText(event.target.value)} />
                    <button type="submit" disabled={liveopsReason.trim().length < 5}>Publish config</button>
                  </form>
                  <form className="form" onSubmit={sendMail}>
                    <label className="muted">Mail (add "account_id" for one player; rewards: silver_crowns, eclipse_tokens, items)</label>
                    <textarea rows={12} value={mailText} onChange={(event) => setMailText(event.target.value)} />
                    <button type="submit" disabled={liveopsReason.trim().length < 5}>Send mail</button>
                  </form>
                </div>
              </section>
            )}
          </div>
        )}
        {tab === "audit" && (
          <section className="panel full">
            <div className="panelHead">
              <h2>Audit trail{accountId ? ` of ${accountId}` : ""}</h2>
              <button className="ghost" onClick={loadAudit}>Refresh</button>
            </div>
            <Table rows={audit} columns={["audit_id", "at", "actor_email", "actor_role", "action", "reason", "target_account_id", "environment", "config_revision"]} />
          </section>
        )}
      </main>
    </div>
  );
}
