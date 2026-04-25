import { createClient } from "./client";

export async function createRealtimeClient() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    supabase.realtime.setAuth(session.access_token);
  }

  return supabase;
}