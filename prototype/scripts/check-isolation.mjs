// Proves the prototype is a closed, mock-only demo: it never talks to a server.
//   npm run build && npm run check:isolation
//
// 1. Source: no network APIs, no environment-based API config, no imports from
//    the real app or the backend.
// 2. Build output: no API paths or backend hosts.
// 3. Runtime: every route is opened in Chromium; any fetch/XHR/WebSocket/
//    EventSource request, or any request to another origin, fails the check.
//    The detector is self-tested first so a silent pass cannot hide a broken check.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const problems = [];

// 1. Source
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|\baxios\b|new\s+WebSocket|new\s+EventSource|sendBeacon|import\.meta\.env/;
for (const file of walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const rel = relative(root, file);
  const src = readFileSync(file, 'utf8');
  if (NETWORK.test(src)) problems.push(`${rel} uses a network API or env-based config`);
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (/meraki-frontend|backend|\.\.\/\.\.\/\.\./.test(m[1])) problems.push(`${rel} imports from outside the prototype (${m[1]})`);
  }
}

// 2. Build output
const dist = join(root, 'dist');
if (!existsSync(dist)) { console.error('dist/ missing: run `npm run build` first'); process.exit(1); }
for (const file of walk(dist).filter((f) => /\.(js|html)$/.test(f))) {
  const text = readFileSync(file, 'utf8');
  for (const needle of ['/api/v1', 'localhost:4000', 'VITE_API_BASE_URL']) {
    if (text.includes(needle)) problems.push(`${relative(root, file)} contains "${needle}"`);
  }
}

// 3. Runtime
const ROUTES = [
  '/', '/student', '/student/rent', '/student/complaints', '/student/leave', '/student/visitors', '/student/notices',
  '/student/documents', '/student/feedback', '/student/profile', '/student/emergency',
  '/manager', '/manager/students', '/manager/rooms', '/manager/payments', '/manager/complaints', '/manager/leave',
  '/manager/visitors', '/manager/staff', '/manager/maintenance', '/manager/inventory', '/manager/announcements',
  '/manager/events', '/manager/feedback', '/manager/activity',
  '/owner', '/owner/properties', '/owner/students', '/owner/finance', '/owner/analytics', '/owner/complaints',
  '/owner/staff', '/owner/inventory', '/owner/events', '/owner/plans', '/owner/settings',
];

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), 'Library/Caches/ms-playwright'); // reuse an installed browser; never download one
  const linux = join(homedir(), '.cache/ms-playwright');
  for (const base of [cache, linux]) {
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome', 'chrome-linux64/chrome']) {
        if (existsSync(join(base, dir, rel))) return join(base, dir, rel);
      }
    }
  }
  return undefined; // let Playwright use its own default
}

const server = await preview({ root, preview: { port: 4175, strictPort: true }, logLevel: 'silent' });
const origin = 'http://localhost:4175';
const browser = await chromium.launch({ executablePath: findChromium() });
let visited = 0;
try {
  const page = await browser.newPage();
  const leaks = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  // The one known third-party request is the Google Fonts stylesheet/font files in
  // index.html: static typography, never data. It is allowed for those resource types only.
  const FONT_CDN = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
  const isFont = (r) => FONT_CDN.test(r.url()) && ['stylesheet', 'font'].includes(r.resourceType());
  page.on('request', (r) => {
    const sameOrigin = r.url().startsWith(origin) || /^(data|blob):/.test(r.url());
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(r.resourceType()) || (!sameOrigin && !isFont(r))) leaks.push(`${r.resourceType()} ${r.url()}`);
  });
  // Nothing but the page itself may be loaded; even fonts are blocked here (the page renders with fallback fonts).
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));

  // Self-test: the detector must notice a real request.
  await page.goto(origin + '/');
  await page.evaluate(() => fetch('/api/v1/self-test').catch(() => {}));
  await page.waitForTimeout(300);
  if (!leaks.some((l) => l.includes('/api/v1/self-test'))) problems.push('detector self-test failed: a fetch went unnoticed');
  leaks.length = 0;

  for (const r of ROUTES) {
    await page.goto(origin + r);
    await page.waitForTimeout(400);
    visited++;
  }
  for (const l of leaks) problems.push(`network request: ${l}`);
  for (const e of errors) problems.push(`page error: ${e}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

if (problems.length) {
  console.error(`Isolation check FAILED:\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(`Isolation check passed: source clean, build clean, ${visited} routes opened with zero network requests.`);
