// Server-only: validate a Supabase access token from the client and return user id.
import { createClient } from "@supabase/supabase-js";

export async function getUserIdFromToken(token: string): Promise<string> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supa = createClient(url, key);
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}
