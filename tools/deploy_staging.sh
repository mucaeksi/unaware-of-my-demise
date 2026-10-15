#!/usr/bin/env bash
# Deploy step run by Cloudflare Workers Builds (the "deploy command" of each Worker): bash tools/deploy_staging.sh game|admin|ops
# Authentication comes from the Workers Builds build token. No GitHub Actions involved.
# IMPORTANT: Workers Builds forces the Worker name of the build it runs in onto EVERY `wrangler deploy` of that build. One build must
# therefore deploy exactly ONE Worker (a second deploy in the same build would overwrite the first one with other code).
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
W="npx wrangler"
VERSION_TAG="$(git rev-parse --short=12 HEAD)"
case "${1:?usage: deploy_staging.sh game|admin|ops}" in
  game)
    $W d1 migrations apply DB --remote -c wrangler.game.jsonc --env staging
    for f in characters catalog banners assets; do $W d1 execute DB --remote -c wrangler.game.jsonc --env staging --file "seed/$f.sql"; done
    $W deploy -c wrangler.game.jsonc --env staging --keep-vars --tag "$VERSION_TAG"
    ;;
  admin)
    $W deploy -c wrangler.admin.jsonc --env staging --keep-vars --tag "$VERSION_TAG"
    ;;
  ops)
    # cron Worker: nightly encrypted backup + health probes
    $W deploy -c wrangler.ops.jsonc --env staging --tag "$VERSION_TAG"
    ;;
  *) echo "unknown target" >&2; exit 2 ;;
esac
