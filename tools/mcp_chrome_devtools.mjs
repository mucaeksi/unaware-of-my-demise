#!/usr/bin/env node
/* global process, console */
// Cross-platform launcher for the pinned Chrome DevTools MCP (replaces tools/mcp_chrome_devtools.sh, which needed a
// POSIX bash — on Windows `bash` can resolve to WSL without node — and only found Linux browsers).
// Browser lookup: CHROME_PATH, installed Chrome, then the Playwright Chromium the E2E suite already downloaded.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = '1.10.1';
const win = process.platform === 'win32';

function playwrightChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || (win ? join(process.env.LOCALAPPDATA || '', 'ms-playwright') : join(process.env.HOME || '', '.cache', 'ms-playwright'));
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    const exe = win ? join(base, d, 'chrome-win', 'chrome.exe') : join(base, d, 'chrome-linux', 'chrome');
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

function findBrowser() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = win
    ? [join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'), join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')]
    : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
  return candidates.find((p) => existsSync(p)) ?? playwrightChromium();
}

const args = ['-y', `chrome-devtools-mcp@${VERSION}`, '--headless', '--isolated', '--no-usage-statistics', '--no-performance-crux'];
const exe = findBrowser();
if (exe) args.push('--executablePath', exe);
else console.error('chrome-devtools launcher: no Chrome/Chromium found; set CHROME_PATH or run `npx playwright install chromium`');
// containers run as root: Chrome refuses to start without these flags there (never added for a normal user)
if (!win && typeof process.getuid === 'function' && process.getuid() === 0) args.push('--chrome-arg=--no-sandbox', '--chrome-arg=--disable-setuid-sandbox');

const child = spawn(win ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: win });
child.on('exit', (code) => process.exit(code ?? 0));
