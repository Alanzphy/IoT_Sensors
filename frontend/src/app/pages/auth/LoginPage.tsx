import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthSplitLayout } from "../../components/auth/AuthSplitLayout";
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
      <AuthSplitLayout
        heading="Bienvenido de vuelta"
        description="Ingresa tus credenciales para acceder al panel de monitoreo."
      >
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-[16px] border border-[#DC2626]/25 bg-[#DC2626]/10 p-4 text-center text-sm text-[#DC2626]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
              Correo Electrónico
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.mx"
              autoComplete="email"
              className="w-full rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
              required
              disabled={isLoading}
              aria-invalid={!!error}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
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
                className="w-full rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 pr-12 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-subtle)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/recuperar-contrasena"
              className="text-sm text-[var(--text-subtle)] transition-colors hover:text-[var(--accent-primary)] focus:outline-none focus-visible:underline"
            >
              ¿Olvidé mi contraseña?
            </Link>
          </div>

          <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
            {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </PillButton>
        </form>
      </AuthSplitLayout>
    </PageTransition>
  );
}
