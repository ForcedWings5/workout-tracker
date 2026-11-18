import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { db } from "./storage/db";
import { seedIfEmpty } from "./storage/seed";
import "./ui/global.css";
import "./screens/screens.css";

async function boot() {
  try {
    await seedIfEmpty(db);
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
