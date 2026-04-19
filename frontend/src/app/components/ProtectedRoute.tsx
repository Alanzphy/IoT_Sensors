import { Navigate, Outlet } from "react-router";
import { Leaf } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ allowedRole }: { allowedRole?: "admin" | "cliente" }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F1EB] flex flex-col items-center justify-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[#6D7E5E] flex items-center justify-center">
          <Leaf className="w-8 h-8 text-[#F4F1EB]" />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="block w-2 h-2 rounded-full bg-[#6D7E5E] animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="block w-2 h-2 rounded-full bg-[#6D7E5E] animate-bounce"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="block w-2 h-2 rounded-full bg-[#6D7E5E] animate-bounce"
            style={{ animationDelay: "320ms" }}
          />
        </div>
        <p className="text-sm text-[#6E6359]">Verificando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user.rol !== allowedRole) {
    return <Navigate to={user.rol === "admin" ? "/admin" : "/cliente"} replace />;
  }

  return <Outlet />;
}
