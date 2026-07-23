import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sibling-Repos existieren unter zwei Namensschemata, je nach Checkout:
// ~/fuel-dev (dev-Branch, Home-Root)     → Siblings heißen *-dev (habits-dev, journal-dev, fitness-dev)
// ~/vitalos/fuel-app (master, Submodule) → Siblings heißen *-app (habit-app, journal-app, fitness-app)
// Der lokale Build muss aus BEIDEN Checkouts funktionieren, also wird pro
// Alias die erste tatsächlich existierende Kandidaten-Variante genommen.
function resolveSibling(candidates, label) {
  for (const rel of candidates) {
    const abs = resolve(__dirname, rel);
    if (existsSync(abs)) return abs;
  }
  throw new Error(`[vite.config.js] Kein Sibling-Pfad gefunden für ${label}: ${candidates.join(", ")}`);
}

// Local channel (build:local → /opt/fuel via deploy.sh). Muss im Quell-Checkout
// gebaut werden, wo die Sibling-Repos tatsächlich neben fuel-dev/fuel-app liegen
// — deploy.sh baut deshalb VOR dem rsync nach /opt/fuel, nicht mehr darin. Nach
// dem Build ist dist/ vollständig gebündelt, /opt/fuel braucht die Sibling-Repos
// danach nicht mehr.
export default defineConfig(() => {
  const appMode = "coach";
  const outDir = "./dist";

  console.log(`🚀 Building for local channel (APP_MODE: ${appMode}) -> outDir: ${outDir}`);

  return {
    base: "/",
    define: {
      "import.meta.env.VITE_APP_MODE": JSON.stringify(appMode),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        "@api":     resolve(__dirname, "src/client/lib/api.local.js"),
        "@db":      resolve(__dirname, "src/client/lib/db/index.js"),
        "@utils":   resolve(__dirname, "src/client/lib/db/index.js"),
        "@fuel":    resolve(__dirname, "src/client"),
        "@habits":  resolveSibling(["../habit-app/src", "../habits-dev/src"], "@habits"),
        "@journal": resolveSibling(["../journal-app/src", "../journal-dev/src"], "@journal"),
        "@fitness/constants": resolveSibling(["../fitness-app/src/constants", "../fitness-dev/src/constants"], "@fitness/constants"),
        // Lokaler Build (Coach) → fitness' LOKALE db-Variante, nicht Firestore.
        "@fitness-db": resolveSibling(["../fitness-app/src/lib/db/index.js", "../fitness-dev/src/lib/db/index.js"], "@fitness-db"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
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
      hmr: false,
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
