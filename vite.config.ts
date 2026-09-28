import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "OVGuesser",
        short_name: "OVGuesser",
        description: "Raad waar Nederlandse treinstations liggen.",
        lang: "nl",
        start_url: "/",
        display: "standalone",
        background_color: "#e8ecef",
        theme_color: "#002d72",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json,webmanifest}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://tiles.openfreemap.org" && url.pathname.startsWith("/styles/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "basemap-style" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://tiles.openfreemap.org",
            handler: "CacheFirst",
            options: {
              cacheName: "basemap-tiles",
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("maplibre-gl") ? "maplibre" : undefined),
      },
    },
  },
  worker: { format: "es" },
  server: { proxy: { "/api": "http://localhost:8080", "/healthz": "http://localhost:8080" } },
});
