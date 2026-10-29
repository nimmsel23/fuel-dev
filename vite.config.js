import { vosChangelog } from './scripts/vos-changelog/vos-changelog-vite.mjs'
import { noDynamicChunks } from './scripts/vite-no-dynamic-chunks.mjs'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const requireFromHere = createRequire(import.meta.url);

function resolvePackageEntry(specifier) {
  return requireFromHere.resolve(specifier);
}

// Local channel (build:local → /opt/fuel via deploy.sh). Fuel ist eigenständig:
// keine Imports aus Nachbar-Repos (fitness/journal/habits/relax), der Build läuft
// aus einem nackten Checkout. deploy.sh baut vor dem rsync nach /opt/fuel.
export default defineConfig(async () => {
  const appMode = "coach";
  const outDir = "./dist";

  console.log(`🚀 Building for local channel (APP_MODE: ${appMode}) -> outDir: ${outDir}`);

  return {
    base: "./",
    define: {
      "import.meta.env.VITE_APP_MODE": JSON.stringify(appMode),
    },
    resolve: {
      alias: {
        "@api":     resolve(__dirname, "src/client/lib/api.local.js"),
        "@firebase-config": resolve(__dirname, "src/client/lib/firebase.config.vitalos.js"),
        "@fuel":    resolve(__dirname, "src/client"),
        "firebase/app": resolvePackageEntry("firebase/app"),
        "firebase/app-check": resolvePackageEntry("firebase/app-check"),
        "firebase/messaging": resolvePackageEntry("firebase/messaging"),
        "firebase/auth": resolvePackageEntry("firebase/auth"),
        "firebase/firestore": resolvePackageEntry("firebase/firestore"),
        "firebase/functions": resolvePackageEntry("firebase/functions"),
        "firebase/storage": resolvePackageEntry("firebase/storage"),
        "firebase/vertexai": resolvePackageEntry("firebase/vertexai"),
        "firebase/ai": resolvePackageEntry("firebase/ai"),
      },
      dedupe: [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "firebase",
        "firebase/app",
        "firebase/app-check",
        "firebase/messaging",
        "firebase/auth",
        "firebase/firestore",
        "firebase/functions",
        "firebase/storage",
        "firebase/vertexai",
        "firebase/ai",
      ],
    },
    plugins: [vosChangelog({ appId: 'fuel', appName: 'Fuel', accent: '#fb923c' }),
      react(),
      noDynamicChunks(),
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
        clientPort: 9001,
        protocol: "ws",
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
