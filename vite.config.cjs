const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");
const { resolve } = require("path");
const { existsSync } = require("fs");

function resolveSibling(candidates, label) {
  for (const rel of candidates) {
    const abs = resolve(__dirname, rel);
    if (existsSync(abs)) return abs;
  }
  throw new Error(`[vite.config.cjs] Kein Sibling-Pfad gefunden für ${label}: ${candidates.join(", ")}`);
}

function resolvePackageEntry(specifier) {
  return require.resolve(specifier, { paths: [__dirname] });
}

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appMode = process.env.VITE_APP_MODE || env.VITE_APP_MODE || "coach";

  // coach builds to dist/ (local server), client builds to dist-firebase/ (for firebase deploy)
  const outDir = appMode === "client" ? "./dist-firebase" : "./dist";

  console.log(`🚀 Building for mode: ${mode}, APP_MODE: ${appMode} -> outDir: ${outDir}`);

  return {
    base: "/",
    define: {
      "import.meta.env.VITE_APP_MODE": JSON.stringify(appMode),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        "@api":    resolve(__dirname, appMode === "client" ? "src/client/lib/api.cloud.js" : "src/client/lib/api.local.js"),
        "@db":     resolve(__dirname, "src/client/lib/db/index.js"),
        "@utils":  resolve(__dirname, "src/client/lib/db/index.js"),
        // fuel selbst hat keinen Habits-Tab mehr (entfernt 2026-08-23), aber
        // journal-dev/JournalTimeline.jsx importiert @habits für Habit-Icons
        // in der Journal-Timeline — Alias bleibt nötig, solange @journal
        // journal-devs Source direkt mitbündelt.
        "@habits": resolveSibling(["../habit-app/src", "../habits-dev/src"], "@habits"),
        "@habits-db": resolveSibling(["../habit-app/src/db", "../habits-dev/src/db"], "@habits-db"),
        "@journal": resolveSibling(["../journal-app/src", "../journal-dev/src"], "@journal"),
        "@journal-db": resolveSibling(["../journal-app/src/db/index.js", "../journal-dev/src/db/index.js"], "@journal-db"),
        "@relax": resolveSibling(["../relax-app/src", "../relax-dev/src"], "@relax"),
        "@fitness/constants": resolveSibling(["../fitness-app/src/constants", "../fitness-dev/src/constants"], "@fitness/constants"),
        // Cloud-Build (Client) → fitness' Firestore-db-Variante. Beide Keys zeigen auf
        // dieselbe Datei: bare "@fitness-db" (fuel selbst) und der explizite Subpath
        // "@fitness-db/index.firestore.js" (journal-app importiert ihn direkt).
        // Der spezifischere Key muss zuerst stehen, da Vite Alias-Keys als Prefix matcht.
        "@fitness-db/index.firestore.js": resolveSibling(["../fitness-app/src/lib/db/index.firestore.js", "../fitness-dev/src/lib/db/index.firestore.js"], "@fitness-db/index.firestore.js"),
        "@fitness-db/shared/utils.js": resolveSibling(["../fitness-app/src/lib/db/shared/utils.js", "../fitness-dev/src/lib/db/shared/utils.js"], "@fitness-db/shared/utils.js"),
        "@fitness-db": resolveSibling(["../fitness-app/src/lib/db/index.firestore.js", "../fitness-dev/src/lib/db/index.firestore.js"], "@fitness-db"),
        "@fuel": resolve(__dirname, "src/client"),
        // Sibling repos import bare packages from outside this package root.
        // Pin them to fuel's installed copies so Rollup resolves one shared instance.
        "react/jsx-runtime": resolvePackageEntry("react/jsx-runtime"),
        "react/jsx-dev-runtime": resolvePackageEntry("react/jsx-dev-runtime"),
        "react-dom/client": resolvePackageEntry("react-dom/client"),
        "react-dom": resolvePackageEntry("react-dom"),
        "react": resolvePackageEntry("react"),
        "firebase/app": resolvePackageEntry("firebase/app"),
        "firebase/auth": resolvePackageEntry("firebase/auth"),
        "firebase/firestore": resolvePackageEntry("firebase/firestore"),
        "firebase/functions": resolvePackageEntry("firebase/functions"),
        "firebase/storage": resolvePackageEntry("firebase/storage"),
        "firebase/vertexai": resolvePackageEntry("firebase/vertexai"),
        "firebase/ai": resolvePackageEntry("firebase/ai"),
        "lucide-react": resolvePackageEntry("lucide-react"),
        "@tanstack/react-query": resolvePackageEntry("@tanstack/react-query"),
      },
      dedupe: [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "firebase",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/functions",
        "firebase/storage",
        "firebase/vertexai",
        "firebase/ai",
      ],
    },
    plugins: [
      react(),
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-firebase": ["firebase/app", "firebase/firestore", "firebase/auth"],
            "vendor-calendar": ["@fullcalendar/react", "@fullcalendar/daygrid", "@fullcalendar/timegrid", "@fullcalendar/interaction"],
            "vendor-charts": ["recharts"],
          },
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: 9001,
      strictPort: true,
      hmr: {
        host: "127.0.0.1",
        port: 9001,
      },
      proxy: {
        "/nutrition": "http://127.0.0.1:9000",
        "/supplements": "http://127.0.0.1:9000",
        "/fuel": "http://127.0.0.1:9000",
        "/health": "http://127.0.0.1:9000",
        "/api": "http://127.0.0.1:9080",
      },
    },
  };
});
