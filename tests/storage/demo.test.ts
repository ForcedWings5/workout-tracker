import { createDb } from "../../src/storage/db";
import { seedDemoHistory } from "../../src/storage/demo";
import { seedIfEmpty } from "../../src/storage/seed";

test("demo history (dev only) is written clean, so sync has nothing to push", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 22, 15));
  const db = createDb(crypto.randomUUID());
  await seedIfEmpty(db);
  await seedDemoHistory(db);
  const sessions = await db.sessions.toArray();
  expect(sessions.length).toBeGreaterThan(0);
  expect(sessions.every((s) => s.id.startsWith("demo-") && s.dirty === 0)).toBe(true);
  db.close();
  vi.useRealTimers();
});
