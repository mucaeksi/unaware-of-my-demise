# Authorized Chirp 3 HD sample access

The owner-confirmed audio project is `gen-lang-client-0955955681`.
Google credentials are restricted to sound/music work; images use the image-generation tool.

The existing GitHub `GOOGLE_PLAY_SERVICE_ACCOUNT` authenticates successfully.
Its public IAM principal is `uomd-play-billing@unaware-of-my-demise.iam.gserviceaccount.com`
from project `unaware-of-my-demise`. The authoring workflow explicitly sends
`x-goog-user-project: gen-lang-client-0955955681` for OAuth requests.

## Verified blocker and exact setup

[Actions run 37910361637](https://github.com/mucaeksi/unaware-of-my-demise/actions/runs/37910361637)
verified `403 USER_PROJECT_DENIED` for that OAuth route. The existing `GEMINI_API`
key route returned `401 CREDENTIALS_MISSING`. Real sample WAVs and synthesis
attempts remain **0**. Reported API activation is not verified through a successful
voices-list request while project usage is denied.

A project administrator can open [IAM for the audio project](https://console.cloud.google.com/iam-admin/iam?project=gen-lang-client-0955955681),
choose **Grant access**, add the public service-account email above, and grant
**Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`). This grants
`serviceusage.services.use`, the permission Google documents for an OAuth quota
project. No Owner/Editor role, extra key copy, billing change, or unrelated API
is requested. Additional provider errors, if any, must be checked after this
specific access blocker is removed; successful synthesis is not assumed.

For a project administrator who already uses authenticated gcloud, the equivalent
reviewable command is:

```sh
gcloud projects add-iam-policy-binding gen-lang-client-0955955681 \
  --member='serviceAccount:uomd-play-billing@unaware-of-my-demise.iam.gserviceaccount.com' \
  --role='roles/serviceusage.serviceUsageConsumer'
```

This command is provided for the owner; it was **not executed**. No IAM/billing
configuration was modified by this task.

[Official quota-project permission reference](https://docs.cloud.google.com/docs/quotas/set-quota-project).
The retrieved public excerpts are in the shared audition `provider_reference.json`.
Only public project/account IDs and safe error enums are stored; private keys,
credential JSON, API key values and access tokens are never written to outputs.

## Resume

After the administrator grants project usage, rerun the authoring workflow.
Its normal plan uses all live Japanese female/male Chirp 3 HD voices and identical
SSML word/settings. Existing verified WAVs are reused; ambiguous synthesis is
never automatically retried. The separate 241-line final Fadyme batch remains
unauthorized by the shared-sample request. There is no game integration.

The current cloud runtime reports no ready Google secret binding; adding a secret
elsewhere in ChatGPT does not establish an injected variable in this running
executor. The existing Actions OAuth route needs no second secret copy.
