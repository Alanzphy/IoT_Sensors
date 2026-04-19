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
      <div className="min-h-screen bg-[#F4F1EB] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#F9F8F4] rounded-[32px] p-8 md:p-10 border border-[#2C2621]/5">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-full bg-[#6D7E5E] flex items-center justify-center">
                <Leaf className="w-10 h-10 text-[#F4F1EB]" />
              </div>
            </div>

            <h1 className="text-center mb-2 text-3xl font-serif font-medium tracking-tight text-[#2C2621]">
              Recuperar contraseña
            </h1>
            <p className="text-center text-[#6E6359] mb-8">
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
                className="mb-6 p-4 bg-[#6D7E5E]/10 text-[#6D7E5E] rounded-[16px] text-sm text-center border border-[#6D7E5E]/20"
              >
                {detail}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-[#2C2621] mb-2">
                  Correo electrónico
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.mx"
                  autoComplete="email"
                  className="w-full px-5 py-3 rounded-[24px] bg-[#F4F1EB] border border-[#2C2621]/10 text-[#2C2621] placeholder:text-[#6E6359]/50
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-1 transition-shadow"
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
                className="text-sm text-[#6E6359] hover:text-[#6D7E5E] transition-colors focus:outline-none focus-visible:underline"
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
