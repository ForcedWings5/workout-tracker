import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { db } from "./storage/db";
import { seedIfEmpty } from "./storage/seed";
import "./ui/global.css";
import "./screens/screens.css";

async function boot() {
  // Ask Safari not to evict the database when storage runs low. Harmless if refused or unsupported.
  navigator.storage?.persist?.().catch(() => {});

  try {
    await seedIfEmpty(db);
    // Dev-only synthetic history for checking Progress (`?demo`). Never in production builds.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
      const { seedDemoHistory } = await import("./storage/demo");
      await seedDemoHistory(db);
    }
  } catch (err) {
    // The app still opens; Today shows the empty state.
    console.error("Seeding failed", err);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
