import { Loader2, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { UserProfile } from "../../types/api";

const inputClass = `
  w-full px-4 py-2.5 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[24px]
  text-[var(--text-main)] transition-shadow
  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1
  disabled:opacity-60 disabled:cursor-default
`;

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UserProfile>("/users/me");
      setProfile(res.data);
      setFormName(res.data.full_name);
    } catch (err: any) {
      setError(err.response?.data?.detail || "No fue posible cargar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch<UserProfile>("/users/me", {
        full_name: formName,
      });
      setProfile(res.data);
      setFormName(res.data.full_name);
      setIsEditing(false);
      showToast("Perfil actualizado correctamente.", "success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "No fue posible guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex justify-center items-center min-h-screen p-4 text-[var(--text-subtle)]">
          Cargando perfil...
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-main)] mb-2">Mi Perfil</h1>
              <p className="text-[var(--text-muted)]">Administra tu información personal</p>
            </div>
            {profile && (
              <PillButton
                variant={isEditing ? "primary" : "secondary"}
                disabled={saving}
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              >
                {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Editar Perfil"}
              </PillButton>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]">
              {error}
            </div>
          )}

          {/* Profile Card */}
          <BentoCard>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--chart-1)] flex items-center justify-center">
                  <User className="w-14 h-14 text-[var(--text-inverted)]" />
                </div>
              </div>

              {/* Fields */}
              {profile && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="profile-name" className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
                      <User className="w-4 h-4" />
                      Nombre Completo
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      disabled={!isEditing}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="profile-email" className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
                      <Mail className="w-4 h-4" />
                      Correo Electrónico
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={profile.email}
                      disabled
                      readOnly
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>
          </BentoCard>

          {/* Subscription Info */}
          <BentoCard>
            <h3 className="text-[var(--text-main)] mb-4">Plan de Suscripción</h3>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="inline-block px-4 py-1.5 bg-[var(--accent-primary)] text-[var(--text-inverted)] text-sm rounded-full mb-2">
                  Plan Profesional
                </span>
                <p className="text-sm text-[var(--text-muted)]">
                  Hasta 20 sensores activos • Acceso completo al histórico
                </p>
              </div>
              <PillButton variant="secondary">Ver Planes</PillButton>
            </div>
          </BentoCard>

          {/* Security */}
          <BentoCard>
            <h3 className="text-[var(--text-main)] mb-4">Seguridad</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <PillButton variant="secondary">Cambiar Contraseña</PillButton>
              <p className="text-sm text-[var(--text-muted)]">
                {profile
                  ? `Última actualización: ${formatUpdatedAt(profile.updated_at)}`
                  : "Última actualización: —"}
              </p>
            </div>
          </BentoCard>
        </div>
      </div>
    </PageTransition>
  );
}