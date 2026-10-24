#!/usr/bin/env node
/**
 * Builds the lightweight Cloudflare Workers static gateway directory for `uomd-game` (`apps/unity/CloudflareGatewayDist`)
 * so `wrangler deploy -c wrangler.game.jsonc` serves the Unity 6 LTS gateway landing page, privacy/delete-request links,
 * and static `content/base` preview files alongside `/api/v1/*`.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'apps', 'unity', 'CloudflareGatewayDist');
const CONTENT_BASE = join(ROOT, 'content', 'base');

mkdirSync(OUT_DIR, { recursive: true });

if (existsSync(CONTENT_BASE)) {
  const dstContent = join(OUT_DIR, 'content', 'base');
  mkdirSync(dstContent, { recursive: true });
  cpSync(CONTENT_BASE, dstContent, { recursive: true });
}

const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unaware of My Demise — Unity 6 LTS API &amp; Content Gateway</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #07060b;
      color: #f3ece0;
      font-family: Georgia, "Cormorant Garamond", serif;
    }
    .panel {
      max-width: 680px;
      padding: 32px;
      background: #0f0d16;
      border: 2px solid #7a6034;
      border-radius: 6px;
    }
    h1 {
      margin: 0 0 8px;
      color: #f6e7c8;
      letter-spacing: 0.08em;
      font-size: 24px;
    }
    p {
      color: #b7ad9e;
      line-height: 1.6;
    }
    a {
      color: #d8b36a;
      text-decoration: none;
      margin-right: 16px;
    }
    code {
      color: #f0cf88;
    }
  </style>
</head>
<body>
  <main class="panel">
    <h1>UNAWARE OF MY DEMISE</h1>
    <p>Unity 6 LTS (C#, URP 2D) Native Client &amp; Cloudflare Worker API / R2 Content Gateway.</p>
    <p>Android Package: <code>io.github.mucaeksi.unawareofmydemise</code></p>
    <p>
      <a href="/api/v1/health">API Health (/api/v1/health)</a>
      <a href="/privacy">Privacy &amp; Data Safety</a>
      <a href="/account/delete-request">Account Deletion Request</a>
    </p>
  </main>
</body>
</html>
`;

writeFileSync(join(OUT_DIR, 'index.html'), indexHtml, 'utf8');
stdout.write('Cloudflare static gateway assets built at apps/unity/CloudflareGatewayDist\n');
