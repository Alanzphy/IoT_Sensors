import { Leaf } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDetail("");

    if (!token) {
      setError("El token de recuperacion no esta presente en el enlace.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });
      setDetail(response.data?.detail || "Contrasena actualizada exitosamente.");
      setTimeout(() => navigate("/"), 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || "No se pudo actualizar la contrasena");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-surface)] rounded-[32px] p-8 md:p-10 shadow-sm border border-[var(--border-subtle)]">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[var(--accent-primary)] flex items-center justify-center shadow-inner">
              <Leaf className="w-10 h-10 text-[var(--text-inverted)]" />
            </div>
          </div>

          <h1 className="text-center mb-2 text-3xl font-medium tracking-tight text-[var(--text-main)]">
            Restablecer contrasena
          </h1>
          <p className="text-center text-[var(--text-muted)] mb-8">
            Define una nueva contrasena para tu cuenta.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-[16px] text-sm text-center">
              {error}
            </div>
          )}

          {detail && (
            <div className="mb-6 p-4 bg-[var(--status-active)]/10 text-[var(--status-active)] rounded-[16px] text-sm text-center">
              {detail}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Nueva contrasena
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimo 8 caracteres"
                className="w-full px-5 py-3 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                minLength={8}
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Confirmar contrasena
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contrasena"
                className="w-full px-5 py-3 rounded-[24px] bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                minLength={8}
                required
                disabled={isLoading}
              />
            </div>

            <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? "Actualizando..." : "Actualizar contrasena"}
            </PillButton>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors">
              Volver a inicio de sesion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
