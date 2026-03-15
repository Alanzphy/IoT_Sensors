import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ allowedRole }: { allowedRole?: "admin" | "cliente" }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user.rol !== allowedRole) {
    return <Navigate to={user.rol === "admin" ? "/admin" : "/cliente"} replace />;
  }

  return <Outlet />;
}
