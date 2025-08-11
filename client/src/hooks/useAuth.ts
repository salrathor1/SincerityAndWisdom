import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn<User>({ on401: "returnNull" }),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // User is authenticated if data exists and is not null
  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    isViewer: user?.role === "viewer",
    isEditor: user?.role === "editor" || user?.role === "admin",
    isAdmin: user?.role === "admin",
  };
}
