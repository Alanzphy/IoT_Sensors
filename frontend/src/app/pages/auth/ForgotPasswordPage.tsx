import { Leaf } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

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
      setDetail(response.data?.detail || "Si el correo existe, se envio el enlace de recuperacion.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "No se pudo procesar la solicitud");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#F9F8F4] rounded-[32px] p-8 md:p-10 shadow-sm border border-[#2C2621]/5">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[#6D7E5E] flex items-center justify-center shadow-inner">
              <Leaf className="w-10 h-10 text-[#F4F1EB]" />
            </div>
          </div>

          <h1 className="text-center mb-2 text-3xl font-medium tracking-tight text-[#2C2621]">
            Recuperar contrasena
          </h1>
          <p className="text-center text-[#6E6359] mb-8">
            Ingresa tu correo para recibir un enlace de restablecimiento.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-[16px] text-sm text-center">
              {error}
            </div>
          )}

          {detail && (
            <div className="mb-6 p-4 bg-[#EEF4E8] text-[#2F5D2A] rounded-[16px] text-sm text-center">
              {detail}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#2C2621] mb-2">
                Correo electronico
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

            <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar enlace"}
            </PillButton>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-[#6E6359] hover:text-[#6D7E5E] transition-colors">
              Volver a inicio de sesion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
