import { render } from "@testing-library/react";
import App from "../../src/App";
import { DbProvider } from "../../src/storage/DbContext";
import { createDb, type WorkoutDB } from "../../src/storage/db";
import { seedIfEmpty } from "../../src/storage/seed";

export async function seededDb(): Promise<WorkoutDB> {
  const db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
  return db;
}

export function renderApp(db: WorkoutDB) {
  return render(
    <DbProvider db={db}>
      <App />
    </DbProvider>,
  );
}
