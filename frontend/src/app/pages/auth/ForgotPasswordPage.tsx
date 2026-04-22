import { Leaf } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setDetail("");

    try {
      const response = await api.post("/auth/forgot-password", { email });
      setDetail(response.data?.detail || "Si el correo existe, se envió el enlace de recuperación.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "No se pudo procesar la solicitud.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[var(--bg-surface)] rounded-[32px] p-8 md:p-10 border border-[var(--border-subtle)]">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
                <Leaf className="w-10 h-10 text-[var(--text-inverted)]" />
              </div>
            </div>

            <h1 className="text-center mb-2 text-3xl font-serif font-medium tracking-tight text-[var(--text-main)]">
              Recuperar contraseña
            </h1>
            <p className="text-center text-[var(--text-muted)] mb-8">
              Ingresa tu correo para recibir un enlace de restablecimiento.
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

            {detail && (
              <div
                role="status"
                aria-live="polite"
                className="mb-6 p-4 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-[16px] text-sm text-center border border-[var(--accent-primary)]/20"
              >
                {detail}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-[var(--text-main)] mb-2">
                  Correo electrónico
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.mx"
                  autoComplete="email"
                  className="w-full px-5 py-3 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1 transition-shadow"
                  required
                  disabled={isLoading}
                />
              </div>

              <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
                {isLoading ? "Enviando..." : "Enviar enlace"}
              </PillButton>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/"
                className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors focus:outline-none focus-visible:underline"
              >
                ← Volver a inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
