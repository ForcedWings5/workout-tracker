import { createMemoryRemote } from "../../src/sync/remote";

const row = (id: string, updated_at = "2026-11-20T10:00:00.000Z") => ({ kind: "session" as const, id, data: { id }, updated_at, deleted: false });

test("pushed rows come back on pull, stamped by the server", async () => {
  const remote = createMemoryRemote();
  await remote.push([row("a"), row("b")]);
  const pulled = await remote.pull();
  expect(pulled.map((r) => r.id)).toEqual(["a", "b"]);
  expect(pulled.every((r) => typeof r.synced_at === "string")).toBe(true);
});

test("pull(since) returns only rows written after that server time", async () => {
  const remote = createMemoryRemote();
  await remote.push([row("a")]);
  const [first] = await remote.pull();
  await remote.push([row("b")]);
  expect((await remote.pull(first.synced_at)).map((r) => r.id)).toEqual(["b"]);
});

test("pushing the same kind and id again replaces it and moves its server time forward", async () => {
  const remote = createMemoryRemote();
  await remote.push([row("a", "2026-11-20T10:00:00.000Z")]);
  const [before] = await remote.pull();
  await remote.push([{ ...row("a", "2026-11-21T10:00:00.000Z"), deleted: true }]);
  const all = await remote.pull();
  expect(all).toHaveLength(1);
  expect(all[0]).toMatchObject({ id: "a", deleted: true, updated_at: "2026-11-21T10:00:00.000Z" });
  expect(all[0].synced_at > before.synced_at).toBe(true);
});

test("the same id under different kinds are different rows", async () => {
  const remote = createMemoryRemote();
  await remote.push([row("x"), { ...row("x"), kind: "workout" }]);
  expect(await remote.pull()).toHaveLength(2);
});
