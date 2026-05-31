import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appMode = process.env.VITE_APP_MODE || env.VITE_APP_MODE || "coach";
  
  // Split output directories: coach builds to dist/ (local server default), client builds to dist-client/
  const outDir = appMode === "client" ? "./dist-client" : "./dist";

  console.log(`🚀 Building for mode: ${mode}, APP_MODE: ${appMode} -> outDir: ${outDir}`);

  return {
    base: "/",
    define: {
      "import.meta.env.VITE_APP_MODE": JSON.stringify(appMode),
    },
    plugins: [
      react(),
      VitePWA({
        base: "/",
        scope: "/",
        registerType: "autoUpdate",
        injectRegister: "auto",
        manifest: {
          name: appMode === "coach" ? "Fuel Coach V3" : "Fuel Centre",
          short_name: appMode === "coach" ? "Coach" : "Fuel",
          description: appMode === "coach" ? "Coach Control Deck" : "Nutrition Journal",
          theme_color: "#080b12",
          background_color: "#080b12",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /^\/nutrition/, /^\/supplements/, /^\/fuel/, /^\/health/],
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
            "vendor-calendar": ["@fullcalendar/react", "@fullcalendar/daygrid", "@fullcalendar/timegrid", "@fullcalendar/interaction"],
            "vendor-charts": ["recharts"],
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      hmr: {
        host: "localhost",
        port: 5173,
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
