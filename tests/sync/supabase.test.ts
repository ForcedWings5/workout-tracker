import { createSupabaseRemote, initialAuth, signOutWith } from "../../src/sync/supabase";
import type { RemoteRow } from "../../src/sync/remote";

/** A fake Supabase query builder that serves fixed pages and records what was asked. */
function fakeClient(pages: RemoteRow[][]) {
  const orders: string[] = [];
  const ranges: [number, number][] = [];
  let call = 0;
  const builder = {
    select: () => builder,
    order: (col: string) => (orders.push(col), builder),
    gt: () => builder,
    range: (from: number, to: number) => {
      ranges.push([from, to]);
      return Promise.resolve({ data: pages[call++] ?? [], error: null });
    },
  };
  const client = { from: () => builder } as never;
  return { client, orders, ranges };
}

const row = (id: string): RemoteRow => ({ kind: "session", id, data: {}, updated_at: "2026-11-20T10:00:00Z", deleted: false, synced_at: "2026-11-20T10:00:00+00:00" });

test("Final: pull orders by server time, then kind and id, so ties can't shuffle across pages", async () => {
  const { client, orders } = fakeClient([[row("a")], []]);
  await createSupabaseRemote(client).pull();
  expect(orders.slice(0, 3)).toEqual(["synced_at", "kind", "id"]);
});

test("Final: pull keeps reading until a page comes back empty, even if a page is short", async () => {
  // A project whose max rows is below the page size returns short pages.
  const { client, ranges } = fakeClient([[row("a"), row("b")], [row("c")], []]);
  const rows = await createSupabaseRemote(client).pull();
  expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(ranges).toEqual([
    [0, 999],
    [2, 1001],
    [3, 1002],
  ]);
});

test("Final: opening offline with an expired token still counts as signed in", () => {
  const stored = JSON.stringify({ access_token: "x", user: { email: "a@b.co" } });
  expect(initialAuth(null, stored)).toEqual({ status: "signed-in", email: "a@b.co" });
  expect(initialAuth(null, null)).toEqual({ status: "signed-out" });
  expect(initialAuth({ user: { email: "a@b.co" } }, null)).toEqual({ status: "signed-in", email: "a@b.co" });
  expect(initialAuth(null, "not json")).toEqual({ status: "signed-out" });
});

test("Final: sign out clears the session on the phone first, so it works offline", async () => {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  await signOutWith({ auth: { signOut } } as never);
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  signOut.mockResolvedValueOnce({ error: new Error("nope") });
  await expect(signOutWith({ auth: { signOut } } as never)).rejects.toThrow("nope");
});
