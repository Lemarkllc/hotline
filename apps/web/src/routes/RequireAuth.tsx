import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";

export function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
