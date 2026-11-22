// Supabase: email-code sign-in and the cloud `records` table. Only the public URL and anon key
// are used (row level security limits each user to their own rows). Without them the app runs
// with sync off.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import type { RemoteRow, RemoteStore } from "./remote";

let client: SupabaseClient | null | undefined;

/** The client, or null when this build has no Supabase keys. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
  return client;
}

const PAGE = 1000;
const COLUMNS = "kind,id,data,updated_at,deleted,synced_at";

export function createSupabaseRemote(supabase: SupabaseClient): RemoteStore {
  return {
    async pull(since) {
      const rows: RemoteRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = supabase.from("records").select(COLUMNS).order("synced_at", { ascending: true }).range(from, from + PAGE - 1);
        if (since) query = query.gt("synced_at", since);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data as RemoteRow[]));
        if (data.length < PAGE) return rows;
      }
    },
    async push(rows) {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500).map((r) => ({ ...r, user_id: userId }));
        const { error } = await supabase.from("records").upsert(batch, { onConflict: "user_id,kind,id" });
        if (error) throw error;
      }
    },
  };
}

export async function sendCode(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cloud backup isn't set up");
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cloud backup isn't set up");
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

// ---------- Who's signed in, as a React hook ----------

export type AuthState = { status: "off" | "signed-out" | "signed-in"; email?: string };

let auth: AuthState = { status: "off" };
const listeners = new Set<() => void>();
let watching = false;

function setAuth(next: AuthState) {
  auth = next;
  listeners.forEach((l) => l());
}

function watch() {
  if (watching) return;
  watching = true;
  const supabase = getSupabase();
  if (!supabase) return;
  auth = { status: "signed-out" };
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session ? { status: "signed-in", email: session.user.email ?? undefined } : { status: "signed-out" });
  });
}

/** Whether cloud backup is off in this build, signed out, or signed in (and as whom). */
export function useAuth(): AuthState {
  watch();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => auth,
  );
}

/** For the sync starter: called on every sign-in and sign-out. Returns a function that stops listening. */
export function onAuthChange(callback: (signedIn: boolean) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(Boolean(session)));
  return () => data.subscription.unsubscribe();
}
