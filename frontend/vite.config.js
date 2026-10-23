import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appMode = process.env.VITE_APP_MODE || env.VITE_APP_MODE || "coach";
  const base = process.env.FUEL_HUB_BUILD === "1" ? "/fuel/" : "/";

  // coach builds to dist/ (local server), client builds to dist-firebase/ (for firebase deploy)
  const outDir = appMode === "client" ? "./dist-firebase" : "./dist";

  console.log(`🚀 Building for mode: ${mode}, APP_MODE: ${appMode} -> outDir: ${outDir}`);

  return {
    base: process.env.FUEL_HUB_BUILD === "1" ? base : "./",
    define: {
      "import.meta.env.VITE_APP_MODE": JSON.stringify(appMode),
      "import.meta.env.VITE_FUEL_API_BASE": JSON.stringify(process.env.FUEL_HUB_BUILD === "1" ? "/fuel-api" : ""),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        "@api": resolve(__dirname, "src/client/lib/api.js"),
      },
    },
    plugins: [
      react(),
      VitePWA({
        base,
        scope: base,
        registerType: "autoUpdate",
        injectRegister: "auto",
        manifest: {
          name: appMode === "coach" ? "Fuel Coach" : "Fuel Centre",
          short_name: appMode === "coach" ? "Coach" : "Fuel",
          description: appMode === "coach" ? "Coach Control Deck" : "Nutrition Journal",
          theme_color: "#080b12",
          background_color: "#080b12",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api/, /^\/nutrition/, /^\/supplements/, /^\/health/],
          runtimeCaching: [
            {
              urlPattern: /^\/nutrition\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "nutrition-api",
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: /^\/supplements\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "supplements-api",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
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
      port: 4010,
      hmr: {
        host: "0.0.0.0",
      },
      proxy: {
        "/nutrition": "http://127.0.0.1:4000",
        "/supplements": "http://127.0.0.1:4000",
        "/fuel": "http://127.0.0.1:4000",
        "/health": "http://127.0.0.1:4000",
        "/api": "http://127.0.0.1:4000",
      },
    },
  };
});
