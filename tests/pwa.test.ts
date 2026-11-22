import { pwaOptions } from "../vite.config";

test("the manifest installs as a standalone app under /workout-tracker/", () => {
  const manifest = pwaOptions.manifest;
  if (!manifest) throw new Error("no manifest");
  expect(manifest).toMatchObject({
    name: "Workout Tracker",
    short_name: "Workouts",
    display: "standalone",
    start_url: "/workout-tracker/",
    scope: "/workout-tracker/",
    theme_color: "#2a241f",
    background_color: "#2a241f",
  });
  expect(manifest.icons?.map((i) => [i.src, i.sizes, i.purpose ?? "any"])).toEqual([
    ["icons/icon-192.png", "192x192", "any"],
    ["icons/icon-512.png", "512x512", "any"],
    ["icons/icon-maskable-512.png", "512x512", "maskable"],
  ]);
});

test("everything the app needs offline is precached, the title font included", () => {
  const patterns = pwaOptions.workbox?.globPatterns ?? [];
  expect(patterns.join(",")).toContain("woff2");
  expect(patterns).toEqual(["**/*.{js,css,html,woff2,png,svg}"]);
  expect(pwaOptions.registerType).toBe("autoUpdate");
});
