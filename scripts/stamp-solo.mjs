// Nach `vite build` mit VITE_SOLO=<app>: macht aus dist-solo-<app>/ eine eigene installierbare Mini-App.
// Aufruf: node scripts/stamp-solo.mjs <app>   (app = Schlüssel in mini-app.json: log|supplements|micros|report)
//  1. mini-app-shell sw — Haupt-SW (apps.fuel) erzeugen, Cache-Version in sw.js/manifest.json (damit der Splash "Update wird geladen …" zeigen kann)
//  2. mini-app-shell    — Icons, Manifest, Titel, Splash (@vos/mini-app-shell, vendored unter scripts/mini-app-shell/)
//  3. Aufräumen         — index.html zeigt noch auf die Icons der Haupt-App (favicon, /icons/…) → auf die App-Icons umbiegen;
//                         *.bak und icons/ (Haupt-App-Icons) aus dem Output entfernen, damit sie nicht mitdeployed werden
// Die Quelle (public/, index.html) bleibt unberührt.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = process.argv[2];
const cfg = JSON.parse(readFileSync(resolve(root, "mini-app.json"), "utf8"));
if (!app || !cfg.apps?.[app]) {
  console.error(`Aufruf: node scripts/stamp-solo.mjs <${Object.keys(cfg.apps).join("|")}>`);
  process.exit(1);
}
const out = resolve(root, `dist-solo-${app}`);
if (!existsSync(resolve(out, "index.html"))) {
  console.error(`❌ ${out}/index.html fehlt — erst "pnpm run build:solo:${app}"`);
  process.exit(1);
}

const run = (...args) => execFileSync("node", args, { cwd: root, stdio: "inherit" });
run("scripts/mini-app-shell/cli.mjs", "sw", `dist-solo-${app}`, "--app", "fuel"); // Haupt-SW (apps.fuel), Version in sw.js + manifest.json
run("scripts/mini-app-shell/cli.mjs", "stamp", `dist-solo-${app}`, "--app", app);

const htmlPath = resolve(out, "index.html");
let html = readFileSync(htmlPath, "utf8");
html = html
  .replace(/\s*<link rel="icon" href="\/favicon\.ico"[^>]*\/>/, "")
  .replace(/<link rel="icon" type="image\/svg\+xml" href="[^"]*" \/>/, '<link rel="icon" type="image/svg+xml" href="./favicon.svg" />')
  .replace(/<link rel="icon" type="image\/png" sizes="192x192" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png" />');
writeFileSync(htmlPath, html);

for (const f of readdirSync(out)) if (/\.bak/.test(f) || f === "favicon.ico") rmSync(resolve(out, f), { force: true });
rmSync(resolve(out, "icons"), { recursive: true, force: true });
console.log(`🧹 dist-solo-${app}: Icon-Links auf App-Icons, Haupt-App-Icons und *.bak entfernt`);
