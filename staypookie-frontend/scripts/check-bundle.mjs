// Proves the production build of the real app carries no mock/demo layer.
// Run after `npm run build`:  npm run check:bundle
//
// 1. Static: no source outside the mock layer imports it.
// 2. Built output: none of the strings that only exist in the mock layer or in
//    demo authentication made it into dist/.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const problems = [];

// The mock layer was deleted (it lives on in the tag archive/frontend-mock); it must not come back.
for (const p of ['src/services/mock', 'src/data/fixtures', 'src/services/repository.ts', 'src/services/http/mockSessionBridge.ts']) {
  if (existsSync(join(root, p))) problems.push(`${p} exists: the real app must not contain the mock layer`);
}
for (const file of walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const rel = relative(root, file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (/services\/mock|data\/fixtures|\/repository$|mockSessionBridge/.test(m[1])) problems.push(`${rel} imports mock code (${m[1]})`);
  }
}

const FORBIDDEN = [
  'staypookie-demo-v1',          // mock repository's localStorage key
  'meraki@123',              // shared demo password
  'Aarav Sharma', 'Crown Residency', // seed fixtures
  '/auth/personas', '/auth/login-as', // demo authentication endpoints
  'demo-invite-2026', 'demo-reset-token',
  'Switch demo persona', 'Reset demo data',
];
const dist = join(root, 'dist');
let files;
try { files = walk(dist).filter((f) => /\.(js|html|css)$/.test(f)); } catch { files = []; }
if (!files.length) problems.push('dist/ is empty: run `npm run build` first');
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN) if (text.includes(needle)) problems.push(`${relative(root, file)} contains "${needle}"`);
}

if (problems.length) {
  console.error(`Bundle check FAILED:\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(`Bundle check passed: ${files.length} built files scanned, no mock imports, no demo markers.`);
