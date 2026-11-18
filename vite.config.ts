/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/workout-tracker/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    // A US time zone, so local-date tests cover the "evening is already tomorrow in UTC" case.
    env: { TZ: "America/New_York" },
  },
});
