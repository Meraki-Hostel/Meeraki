import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Operations modules register themselves: any src/modules/<name>/<name>.module.js
// that exports `{ path, routes }` is mounted under /api/v1<path>. Adding a module
// therefore never needs an edit here.
const modulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../modules");

export const moduleRoutes = [];
for (const dir of fs.readdirSync(modulesDir).sort()) {
  const file = path.join(modulesDir, dir, `${dir}.module.js`);
  if (!fs.existsSync(file)) continue;
  const mod = await import(pathToFileURL(file).href);
  if (!mod.path || !mod.routes) throw new Error(`${dir}.module.js must export { path, routes }`);
  moduleRoutes.push([mod.path, mod.routes]);
}
