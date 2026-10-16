// Erzeugt den Service Worker einer Mini-App aus sw-template.js + Konfiguration.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), "sw-template.js");

// Default-Konfiguration einer Mini-App; alles per mini-app.json (Block "sw") überschreibbar.
export function swConfig(appId, sw = {}, version) {
  const prefix = sw.prefix || `vos-${appId}-`;
  return {
    prefix,
    cache: `${prefix}v${version}`,
    shell: ["./", "./index.html", "./manifest.json", "./icon-192.png"],
    navTimeoutMs: 4000,
    assetsPath: "/assets/",
    cacheAllSameOrigin: false,
    api: { swr: [], networkFirst: [] },
    imageCaches: [],
    keepCaches: [],
    notificationLink: "./",
    ...sw,
    // prefix/cache stehen oben bereits aufgelöst; "extra"/"extraFile" gehören nicht in die Laufzeit-Config
    extra: undefined,
    extraFile: undefined,
  };
}

// version: Build-Stempel (Date.now().toString(36)) — macht jeden Build byte-verschieden,
// damit der Browser den neuen SW erkennt und der Splash "Update wird geladen …" zeigen kann.
export function buildSw({ appId, sw = {}, version, extra = "" }) {
  if (!appId) throw new Error("buildSw: appId fehlt");
  const cfg = swConfig(appId, sw, version);
  const tpl = readFileSync(TEMPLATE, "utf8");
  return tpl
    .replace("/*__VOS_CONFIG__*/ {}", () => JSON.stringify(cfg, null, 2))
    .replace("/*__VOS_EXTRA__*/", () => extra);
}

export const newVersion = () => Date.now().toString(36);
