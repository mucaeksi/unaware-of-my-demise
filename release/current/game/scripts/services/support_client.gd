class_name SupportClient
extends RefCounted
## Public support channel uses the existing HTTP transport, independently of account mutations.
const CATEGORIES: Array[String] = ["sign_in", "update", "account", "gameplay", "performance", "other"]
var base_url: String
var transport: OnlineBackend.Transport

func _init(url: String, sender: OnlineBackend.Transport = null) -> void:
	base_url = url.trim_suffix("/")
	transport = sender if sender != null else OnlineBackend.HttpTransport.new()

static func validation_error(payload: Dictionary) -> String:
	var email: String = str(payload.get("reply_email", "")).strip_edges()
	if email.length() > 254 or RegEx.create_from_string("^[^\\s@\\x00-\\x1f\\x7f]+@[^\\s@\\x00-\\x1f\\x7f]+\\.[^\\s@\\x00-\\x1f\\x7f]+$").search(email) == null:
		return "Enter a valid contact email."
	var subject: String = str(payload.get("subject", "")).strip_edges()
	if subject.length() < 3 or subject.length() > 80 or subject.contains("\n") or subject.contains("\r"):
		return "Enter a subject between 3 and 80 characters."
	var message: String = str(payload.get("message", "")).strip_edges()
	if message.length() < 20 or message.length() > 3000:
		return "Describe the problem in 20 to 3,000 characters."
	if not CATEGORIES.has(str(payload.get("category", ""))): return "Choose a topic."
	if payload.get("consent", false) != true: return "Allow us to use your contact email to reply."
	return ""

func submit(payload: Dictionary) -> Outcome:
	var error: String = validation_error(payload)
	if not error.is_empty(): return Outcome.fail("invalid_request", error)
	if base_url.is_empty(): return Outcome.fail("support_unavailable", "Support is temporarily unavailable. Your message has not been submitted.")
	var reply: Dictionary = await transport.request(HTTPClient.METHOD_POST, base_url + "/v1/support", PackedStringArray(["Content-Type: application/json"]), JSON.stringify(payload))
	var status: int = int(reply.get("status", 0))
	if status == 0:
		return Outcome.fail("delivery_unknown", "We could not confirm submission. Your draft is kept. Check your connection and any reply before sending again.")
	var parsed: Variant = JSON.parse_string(str(reply.get("body", "")))
	if status == 202 and parsed is Dictionary and (parsed as Dictionary).get("accepted", false) == true and (parsed as Dictionary).get("reference", "") is String and not str((parsed as Dictionary).get("reference", "")).is_empty():
		return Outcome.ok(parsed)
	if status == 429: return Outcome.fail("rate_limited", "Too many messages. Please wait a minute before trying again.")
	if status == 503: return Outcome.fail("support_unavailable", "Support is temporarily unavailable. Your draft is kept; try again later.")
	if status == 400: return Outcome.fail("invalid_request", "Check your contact email, subject and message, then try again.")
	return Outcome.fail("delivery_unknown", "We could not confirm submission. Your draft is kept. Check for a reply before sending again.")
