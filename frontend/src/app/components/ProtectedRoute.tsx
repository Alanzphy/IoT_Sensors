import { Navigate, Outlet, useLocation } from "react-router";
import { Leaf } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ allowedRole }: { allowedRole?: "admin" | "cliente" }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
          <Leaf className="w-8 h-8 text-[var(--text-inverted)]" />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
            style={{ animationDelay: "320ms" }}
          />
        </div>
        <p className="text-sm text-[var(--text-muted)]">Verificando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />;
  }

  if (allowedRole && user.rol !== allowedRole) {
    return <Navigate to={user.rol === "admin" ? "/admin" : "/cliente"} replace />;
  }

  return <Outlet />;
}
