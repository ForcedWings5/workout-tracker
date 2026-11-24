/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

const BOARD = "#2a241f";

/** The installable app: manifest, icons and the offline cache. Exported so tests can check it. */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "autoUpdate",
  // The precache glob below already has every icon; adding them again would cache them twice.
  includeManifestIcons: false,
  manifest: {
    id: "/workout-tracker/",
    name: "Workout Tracker",
    short_name: "Workouts",
    display: "standalone",
    start_url: "/workout-tracker/",
    scope: "/workout-tracker/",
    background_color: BOARD,
    theme_color: BOARD,
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    // Everything the app needs to open with no signal, the blackletter title font included.
    globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
  },
};

export default defineConfig({
  base: "/workout-tracker/",
  plugins: [react(), VitePWA(pwaOptions)],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    // A US time zone, so local-date tests cover the "evening is already tomorrow in UTC" case.
    env: { TZ: "America/New_York" },
  },
});
