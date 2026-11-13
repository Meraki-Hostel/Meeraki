// Copies the API contract from the web app into mobile/src/contract/.
//
//   node scripts/sync-contract.mjs          write the copies
//   node scripts/sync-contract.mjs --check  exit 1 if the copies are out of date
//
// The web app owns the contract (staypookie-frontend/src/types/domain.ts and
// src/services/interfaces.ts, matched 1:1 by the backend). There is no shared
// package in this repo, so mobile keeps generated copies and CI-style checks
// them. Never edit the copies by hand; mobile-only types go in contract/mobile.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../staypookie-frontend/src");
const OUT = path.resolve(here, "../src/contract");

const FILES = [
  { from: "types/domain.ts", to: "domain.ts" },
  { from: "services/interfaces.ts", to: "interfaces.ts" },
];

const header = (from) =>
  `// GENERATED from staypookie-frontend/src/${from} by scripts/sync-contract.mjs.\n` +
  `// Do not edit. Change the web app's file, then run \`npm run sync:contract\`.\n\n`;

function render({ from }) {
  const source = fs.readFileSync(path.join(SRC, from), "utf8");
  return header(from) + source.replace(/from '@\/types\/domain'/g, "from './domain'");
}

const check = process.argv.includes("--check");
let stale = 0;
fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const want = render(f);
  const target = path.join(OUT, f.to);
  const have = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (have === want) continue;
  if (check) {
    console.error(`contract out of date: src/contract/${f.to} (run npm run sync:contract)`);
    stale++;
  } else {
    fs.writeFileSync(target, want);
    console.log(`wrote src/contract/${f.to}`);
  }
}
if (check && stale) process.exit(1);
if (check) console.log("contract up to date");
