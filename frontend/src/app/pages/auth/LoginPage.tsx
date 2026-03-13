import { useState } from "react";
import { useNavigate } from "react-router";
import { PillButton } from "../../components/PillButton";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login - check if admin or client
    if (email.includes("admin")) {
      navigate("/admin");
    } else {
      navigate("/cliente");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#F9F8F4] rounded-[32px] p-8 md:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[#6D7E5E] flex items-center justify-center">
              <svg className="w-10 h-10 text-[#F4F1EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M8 6c0-2 1.5-4 4-4s4 2 4 4M6 10c-2 0-4 1.5-4 4s2 4 4 4M18 10c2 0 4 1.5 4 4s-2 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <h1 className="text-center mb-2 text-3xl text-[#2C2621]">Sensores Agrícolas</h1>
          <p className="text-center text-[#6E6359] mb-8">
            Sistema de Monitoreo de Riego IoT
          </p>

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
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-[#6E6359] hover:text-[#6D7E5E] transition-colors"
              >
                Olvidé mi contraseña
              </button>
            </div>

            <PillButton type="submit" variant="primary" className="w-full">
              Iniciar Sesión
            </PillButton>
          </form>

          <div className="mt-8 pt-6 border-t border-[#2C2621]/10 text-center">
            <p className="text-sm text-[#6E6359]">
              Demo: use "admin@ejemplo.mx" o "cliente@ejemplo.mx"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
