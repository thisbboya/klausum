import { supabase } from "@/integrations/supabase/client";

export async function getAccessToken(): Promise<string> {
  let { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token) {
    // One refresh attempt — handles transient mid-refresh state
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token;
  }
  if (!token) throw new Error("Your session expired. Please sign in again.");
  return token;
}
