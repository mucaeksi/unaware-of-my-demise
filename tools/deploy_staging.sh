#!/usr/bin/env bash
# Deploy step run by Cloudflare Workers Builds (the "deploy command" of each Worker): bash tools/deploy_staging.sh game|admin
# Authentication comes from the Workers Builds build token. No GitHub Actions involved.
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
W="npx wrangler"
case "${1:?usage: deploy_staging.sh game|admin}" in
  game)
    $W d1 migrations apply DB --remote -c wrangler.game.jsonc --env staging
    for f in characters catalog banners; do $W d1 execute DB --remote -c wrangler.game.jsonc --env staging --file "seed/$f.sql"; done
    $W deploy -c wrangler.game.jsonc --env staging --keep-vars
    $W deploy -c wrangler.ops.jsonc --env staging # cron Worker: nightly encrypted backup + health probes
    ;;
  admin)
    $W deploy -c wrangler.admin.jsonc --env staging --keep-vars
    ;;
  *) echo "unknown target" >&2; exit 2 ;;
esac
