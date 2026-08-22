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

// SSOT für Cross-App-Aliase ist @vos/cross-app-aliases (~/vitalos/packages/
// cross-app-aliases) — nur erreichbar, wenn dieses Repo als vitalos-Submodule
// genestet ist (npm Workspace-Symlink). Standalone-Checkout (~/fuel-dev ohne
// vitalos-Parent) fällt auf die alte resolveSibling()-Auflösung zurück.
async function resolveCrossAppAliases() {
  try {
    const { crossAppAliases } = await import("@vos/cross-app-aliases");
    return crossAppAliases();
  } catch {
    return {
      "@habits":  resolveSibling(["../habit-app/src", "../habits-dev/src"], "@habits"),
      "@habits-db": resolveSibling(["../habit-app/src/db", "../habits-dev/src/db"], "@habits-db"),
      "@journal": resolveSibling(["../journal-app/src", "../journal-dev/src"], "@journal"),
      "@journal-db": resolveSibling(["../journal-app/src/db/index.js", "../journal-dev/src/db/index.js"], "@journal-db"),
      "@relax":   resolveSibling(["../relax-app/src", "../relax-dev/src"], "@relax"),
      "@fitness/constants": resolveSibling(["../fitness-app/src/constants", "../fitness-dev/src/constants"], "@fitness/constants"),
      // Bare "@fitness-db" löst über Directory-Resolution weiter auf index.js (LOKALE Variante).
      // habits-dev/journal-dev importieren zusätzlich den Subpath "@fitness-db/index.firestore.js" explizit —
      // dafür muss der Alias auf das Verzeichnis zeigen, nicht direkt auf eine Datei.
      "@fitness-db": resolveSibling(["../fitness-app/src/lib/db", "../fitness-dev/src/lib/db"], "@fitness-db"),
    };
  }
}

// Local channel (build:local → /opt/fuel via deploy.sh). Muss im Quell-Checkout
// gebaut werden, wo die Sibling-Repos tatsächlich neben fuel-dev/fuel-app liegen
// — deploy.sh baut deshalb VOR dem rsync nach /opt/fuel, nicht mehr darin. Nach
// dem Build ist dist/ vollständig gebündelt, /opt/fuel braucht die Sibling-Repos
// danach nicht mehr.
export default defineConfig(async () => {
  const appMode = "coach";
  const outDir = "./dist";
  const crossAppAliases = await resolveCrossAppAliases();

  console.log(`🚀 Building for local channel (APP_MODE: ${appMode}) -> outDir: ${outDir}`);

  return {
    base: "./",
    define: {
      "import.meta.env.VITE_APP_MODE": JSON.stringify(appMode),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        ...crossAppAliases,

        "@api":     resolve(__dirname, "src/client/lib/api.local.js"),
        "@db":      resolve(__dirname, "src/client/lib/db/index.js"),
        "@firebase-config": resolve(__dirname, "src/client/lib/firebase.config.vitalos.js"),
        "@utils":   resolve(__dirname, "src/client/lib/db/index.js"),
        "@fuel":    resolve(__dirname, "src/client"),
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
      port: 5901,
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
