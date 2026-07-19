import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

// Reads the caller's own user_roles rows via RLS ("Users read own roles"),
// so the admin check works without the service-role key on the server.
export function useIsAdmin() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return { roles: (data ?? []).map((r) => r.role as string) };
    },
  });
  return { isAdmin: !!q.data?.roles.includes("admin"), isLoading: q.isLoading };
}
