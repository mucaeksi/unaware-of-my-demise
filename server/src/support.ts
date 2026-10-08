import { ApiError, invalid, json, readJsonObject } from "./http";
import { SUPPORT_EMAIL } from "./web";

export interface SupportMessage {
  replyEmail: string;
  subject: string;
  message: string;
  category: string;
  clientVersion: string;
}
export interface SupportMailer { send(message: SupportMessage): Promise<string> }
const categories = new Set(["sign_in", "update", "account", "gameplay", "performance", "other"]);
const address = /^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/;

function field(body: Record<string, unknown>, key: string, min: number, max: number, multiline = false): string {
  const value = body[key];
  if (typeof value !== "string") throw invalid(`Invalid ${key}`);
  const text = value.trim();
  if ([...text].length < min || [...text].length > max || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(text)) throw invalid(`Invalid ${key}`);
  return text;
}

/** Anonymous so failed sign-in, maintenance and database outages cannot prevent a report. No body is logged. */
export async function submitSupport(request: Request, mailer?: SupportMailer | null): Promise<Response> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") throw invalid("Expected application/json");
  const body = await readJsonObject(request);
  const keys = new Set(["reply_email", "subject", "message", "category", "consent", "client_version"]);
  if (Object.keys(body).some((key) => !keys.has(key))) throw invalid("Unexpected field");
  const replyEmail = field(body, "reply_email", 3, 254);
  if (!address.test(replyEmail)) throw invalid("Invalid reply_email");
  const subject = field(body, "subject", 3, 80);
  const message = field(body, "message", 20, 3000, true);
  const category = field(body, "category", 1, 24);
  if (!categories.has(category) || body.consent !== true) throw invalid("Choose a topic and allow a reply");
  const clientVersion = field(body, "client_version", 1, 48);
  if (!mailer) throw new ApiError(503, "SUPPORT_UNAVAILABLE", "Support is temporarily unavailable");
  try {
    const reference = await mailer.send({ replyEmail, subject, message, category, clientVersion });
    if (!reference) throw new Error("No provider receipt");
    // Accepted by the provider; this does not claim receipt in the destination inbox.
    return json({ accepted: true, reference }, 202);
  } catch {
    // Provider errors can contain message/contact data. They must never reach logs or a client response.
    throw new ApiError(503, "SUPPORT_UNAVAILABLE", "Support submission could not be confirmed");
  }
}

/** Recipient is owner-controlled and never accepted from a client. Structured API avoids MIME header interpolation. */
export class CloudflareSupportMailer implements SupportMailer {
  constructor(private readonly binding: SendEmail, private readonly sender: string) {}
  async send(message: SupportMessage): Promise<string> {
    if (!address.test(this.sender) || this.sender.length > 254) throw new Error("Support sender is not configured");
    const result = await this.binding.send({
      from: { email: this.sender, name: "Unaware of My Demise Support" },
      to: SUPPORT_EMAIL,
      replyTo: message.replyEmail,
      subject: `[UOMD · ${message.category}] ${message.subject}`,
      text: `Topic: ${message.category}\nClient: ${message.clientVersion}\n\n${message.message}`,
    });
    return result.messageId;
  }
}
