import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const response = await api.post("/auth/login", { email, password });
      const { access_token, refresh_token } = response.data;

      login(access_token, refresh_token);

      // Decode locally to navigate immediately without waiting for context refresh cycle
      const decoded: any = jwtDecode(access_token);
      navigate(decoded.rol === "admin" ? "/admin" : "/cliente");

    } catch (err: any) {
      setError(err.response?.data?.detail || "Credenciales inválidas. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F4F1EB] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#F9F8F4] rounded-[32px] p-8 md:p-10 border border-[#2C2621]/5">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-full bg-[#6D7E5E] flex items-center justify-center">
                <Leaf className="w-10 h-10 text-[#F4F1EB]" />
              </div>
            </div>

            <h1 className="text-center mb-2 text-3xl font-serif font-medium tracking-tight text-[#2C2621]">
              Sensores Agrícolas
            </h1>
            <p className="text-center text-[#6E6359] mb-8">
              Sistema de Monitoreo de Riego IoT
            </p>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 p-4 bg-[#DC2626]/8 text-[#DC2626] rounded-[16px] text-sm text-center border border-[#DC2626]/15"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[#2C2621] mb-2">
                  Correo Electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.mx"
                  autoComplete="email"
                  className="w-full px-5 py-3 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-1
                    transition-shadow"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-[#2C2621] mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-5 py-3 pr-12 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-1
                      transition-shadow"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6E6359] hover:text-[#2C2621] transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] rounded-full p-0.5"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  to="/recuperar-contrasena"
                  className="text-sm text-[#6E6359] hover:text-[#6D7E5E] transition-colors
                    focus:outline-none focus-visible:underline"
                >
                  ¿Olvidé mi contraseña?
                </Link>
              </div>

              <PillButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading}
                loading={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </PillButton>
            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
