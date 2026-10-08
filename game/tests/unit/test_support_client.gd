extends GutTest

class Sender extends OnlineBackend.Transport:
	var status: int = 202
	var body: String = '{"accepted":true,"reference":"receipt-123"}'
	var sent: Array[Dictionary] = []
	func request(method: int, url: String, headers: PackedStringArray, data: String) -> Dictionary:
		sent.append({"method": method, "url": url, "headers": headers, "body": JSON.parse_string(data)})
		return {"status": status, "body": body}

func _payload() -> Dictionary:
	return {"reply_email": "player@example.test", "subject": "Cannot open chooser", "message": "The Google account chooser does not open when I select the button.", "category": "sign_in", "consent": true, "client_version": "versionCode 1"}

func test_support_is_public_and_never_uses_game_mutation_auth_or_retries() -> void:
	var sender: Sender = Sender.new()
	var client: SupportClient = SupportClient.new("https://api.test/", sender)
	var result: Outcome = await client.submit(_payload())
	assert_true(result.is_ok())
	assert_eq(sender.sent.size(), 1)
	assert_eq(sender.sent[0]["url"], "https://api.test/v1/support")
	assert_eq(sender.sent[0]["headers"], PackedStringArray(["Content-Type: application/json"]))
	assert_eq(sender.sent[0]["body"], _payload())
	sender.status = 0
	result = await client.submit(_payload())
	assert_eq(result.error_kind, "delivery_unknown")
	assert_eq(sender.sent.size(), 2, "uncertain submission never automatically sends twice")

func test_validation_prevents_requests_and_requires_permission_to_reply() -> void:
	var sender: Sender = Sender.new()
	var client: SupportClient = SupportClient.new("https://api.test", sender)
	for change: Dictionary in [{"reply_email": "bad"}, {"subject": "a\nBcc: bad"}, {"message": "tiny"}, {"message": "a".repeat(3001)}, {"consent": false}, {"category": "unknown"}]:
		var payload: Dictionary = _payload()
		payload.merge(change, true)
		assert_false((await client.submit(payload)).is_ok())
	assert_eq(sender.sent.size(), 0)

func test_unavailable_rate_limit_and_malformed_acceptance_do_not_claim_success() -> void:
	var sender: Sender = Sender.new()
	var client: SupportClient = SupportClient.new("https://api.test", sender)
	sender.status = 503
	assert_eq((await client.submit(_payload())).error_kind, "support_unavailable")
	sender.status = 429
	assert_eq((await client.submit(_payload())).error_kind, "rate_limited")
	sender.status = 202
	sender.body = '{"accepted":true}'
	assert_false((await client.submit(_payload())).is_ok())
