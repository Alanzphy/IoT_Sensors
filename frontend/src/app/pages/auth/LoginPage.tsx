import { jwtDecode } from "jwt-decode";
import { Leaf } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PillButton } from "../../components/PillButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.rol === "admin" ? "/admin" : "/cliente");
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", {
        email,
        password
      });

      const { access_token, refresh_token } = response.data;

      // Save tokens in context/storage
      login(access_token, refresh_token);

      // Decode locally to navigate immediately without waiting for context refresh cycle
      const decoded: any = jwtDecode(access_token);
      navigate(decoded.rol === "admin" ? "/admin" : "/cliente");

    } catch (err: any) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#F9F8F4] rounded-[32px] p-8 md:p-10 shadow-sm border border-[#2C2621]/5">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[#6D7E5E] flex items-center justify-center shadow-inner">
              <Leaf className="w-10 h-10 text-[#F4F1EB]" />
            </div>
          </div>

          <h1 className="text-center mb-2 text-3xl font-medium tracking-tight text-[#2C2621]">Sensores Agrícolas</h1>
          <p className="text-center text-[#6E6359] mb-8">
            Sistema de Monitoreo de Riego IoT
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-[16px] text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#2C2621] mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.mx"
                className="w-full px-5 py-3 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2621] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-3 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50 focus:outline-none focus:ring-2 focus:ring-[#6D7E5E]"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-[#6E6359] hover:text-[#6D7E5E] transition-colors"
                onClick={() => alert("Comuníquese con el administrador para restablecer su contraseña.")}
              >
                Olvidé mi contraseña
              </button>
            </div>

            <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </PillButton>
          </form>
        </div>
      </div>
    </div>
  );
}
