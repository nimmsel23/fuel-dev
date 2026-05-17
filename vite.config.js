import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const outDir = process.env.FUEL_BUILD_DIR || "/opt/fuel";

export default defineConfig({
  base: "/v2/",
  plugins: [
    react(),
    VitePWA({
      base: "/v2/",
      scope: "/v2/",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Fuel Centre",
        short_name: "Fuel",
        description: "Nutrition Journal",
        theme_color: "#080b12",
        background_color: "#080b12",
        display: "standalone",
        start_url: "/v2/",
        scope: "/v2/",
        icons: [
          { src: "/v2/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/v2/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/v2/index.html",
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
        // Background sync für offline POSTs
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/nutrition": "http://127.0.0.1:9000",
      "/supplements": "http://127.0.0.1:9000",
      "/fuel": "http://127.0.0.1:9000",
      "/health": "http://127.0.0.1:9000",
    },
  },
});
