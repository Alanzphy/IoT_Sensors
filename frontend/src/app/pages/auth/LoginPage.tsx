import { jwtDecode } from "jwt-decode";
import { Leaf, Lock, Mail, Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      const decoded: any = jwtDecode(access_token);
      navigate(decoded.rol === "admin" ? "/admin" : "/cliente");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Credenciales incorrectas. Verifica tu email y contraseña.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* ── Left panel — Branding ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(150deg, rgba(22,30,16,0.95) 0%, rgba(13,13,12,0.98) 100%)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* Decorative orb */}
        <div
          className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(109,126,94,0.25) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(166,138,97,0.15) 0%, transparent 65%)",
            filter: "blur(80px)",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--accent-green) 0%, var(--accent-gold) 100%)",
            }}
          >
            <Sprout className="w-5 h-5" style={{ color: "#0D0D0C" }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>
              Sensores Agrícolas
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sistema IoT de Riego
            </p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1
              className="font-bold leading-tight mb-4"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "2.6rem",
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}
            >
              Monitoreo de{" "}
              <span className="text-gradient">Riego Agrícola</span>
              {" "}en Tiempo Real
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.7 }}>
              Visualiza humedad del suelo, flujo de agua y evapotranspiración desde cualquier lugar. Decisiones más inteligentes, cultivos más prósperos.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["Humedad del suelo", "Flujo de agua", "E.T.O.", "Histórico"].map((feat) => (
              <span
                key={feat}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(143,175,122,0.1)",
                  border: "1px solid rgba(143,175,122,0.2)",
                  color: "var(--accent-green)",
                }}
              >
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { label: "Lecturas/día", value: "144+" },
            { label: "Sensores", value: "3 cat." },
            { label: "Uptime", value: "99.9%" },
          ].map((stat) => (
            <div key={stat.label}>
              <p
                className="font-data font-bold text-xl mb-0.5"
                style={{ color: "var(--accent-green)" }}
              >
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px] animate-fade-in-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--accent-green) 0%, var(--accent-gold) 100%)" }}
            >
              <Sprout className="w-4 h-4" style={{ color: "#0D0D0C" }} />
            </div>
            <p className="font-semibold" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>
              Sensores Agrícolas
            </p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="font-bold mb-2"
              style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Bienvenido de vuelta
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 p-3.5 rounded-xl text-sm"
              style={{
                background: "var(--status-danger-bg)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "var(--status-danger)",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.mx"
                  className="w-full pl-10 pr-4 py-3 rounded-xl transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border-glass)",
                    color: "var(--text-primary)",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = "var(--border-accent)";
                    e.target.style.background = "rgba(255,255,255,0.07)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(143,175,122,0.1)";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "var(--border-glass)";
                    e.target.style.background = "rgba(255,255,255,0.05)";
                    e.target.style.boxShadow = "none";
                  }}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border-glass)",
                    color: "var(--text-primary)",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = "var(--border-accent)";
                    e.target.style.background = "rgba(255,255,255,0.07)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(143,175,122,0.1)";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "var(--border-glass)";
                    e.target.style.background = "rgba(255,255,255,0.05)";
                    e.target.style.boxShadow = "none";
                  }}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs transition-colors duration-200"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-green)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                onClick={() => alert("Comuníquese con el administrador para restablecer su contraseña.")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 mt-2"
              style={{
                background: isLoading
                  ? "rgba(143,175,122,0.5)"
                  : "linear-gradient(135deg, var(--accent-green) 0%, rgba(143,175,122,0.85) 100%)",
                color: "#0D0D0C",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: isLoading ? "none" : "0 4px 20px rgba(143,175,122,0.25)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : "Iniciar Sesión"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Sensores Agrícolas IoT · Sistema de Monitoreo de Riego
          </p>
        </div>
      </div>
    </div>
  );
}
