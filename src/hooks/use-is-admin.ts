import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/admin.functions";
import { getAccessToken } from "@/lib/auth-helper";
import { useAuth } from "./use-auth";

export function useIsAdmin() {
  const { user } = useAuth();
  const fn = useServerFn(getMyRoles);
  const q = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return fn({ data: { accessToken } });
    },
  });
  return { isAdmin: !!q.data?.roles.includes("admin"), isLoading: q.isLoading };

}
