import { useQuery } from "@tanstack/react-query";
import { fetchRolePermissions, DEFAULT_PERMISSIONS, type PermissionsConfig, type RoleKey } from "@/lib/role-permissions";

export function useRolePermissions() {
  const q = useQuery({
    queryKey: ["role_permissions"],
    queryFn: fetchRolePermissions,
    staleTime: 30_000,
  });
  const config: PermissionsConfig = q.data ?? DEFAULT_PERMISSIONS;
  const getForRole = (role: "admin" | "member" | "visitor" | null | undefined) => {
    if (role === "admin") return null; // admin has no restrictions
    const key: RoleKey = role === "visitor" ? "visitor" : "member";
    return config[key];
  };
  return { config, getForRole, isLoading: q.isLoading, refetch: q.refetch };
}
