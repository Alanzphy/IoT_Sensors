import { Mail, MapPin, Phone, User, Shield } from "lucide-react";
import { useState } from "react";
import { PillButton } from "../../components/PillButton";
import { BentoCard } from "../../components/BentoCard";

export function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "Juan Pérez García",
    email: "juan.perez@ejemplo.com",
    phone: "+52 999 123 4567",
    location: "Mérida, Yucatán",
    company: "Hacienda San José",
  });

  const handleSave = () => {
    setIsEditing(false);
    alert("Perfil actualizado correctamente");
  };

  return (
    <div className="page-wrapper p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="page-title text-gradient">Mi Perfil</h1>
            <p className="page-subtitle">Administra tu información personal</p>
          </div>
          <PillButton
            variant={isEditing ? "primary" : "secondary"}
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          >
            {isEditing ? "Guardar Cambios" : "Editar Perfil"}
          </PillButton>
        </div>

        {/* Profile Card */}
        <BentoCard variant="glass" className="animate-fade-in-up">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-[32px] bg-gradient-to-br from-[var(--accent-green)] to-[var(--accent-gold)] flex items-center justify-center p-1" style={{ boxShadow: "0 0 30px rgba(143,175,122,0.2)" }}>
                <div className="w-full h-full bg-[#141413] rounded-[28px] flex items-center justify-center">
                  <User className="w-12 h-12 text-[var(--accent-green)] opacity-80" />
                </div>
              </div>
              {isEditing && (
                <PillButton variant="secondary" className="text-xs">
                  Cambiar Foto
                </PillButton>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full input-glass px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Empresa / Hacienda
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    disabled={!isEditing}
                    className="w-full input-glass px-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    <Mail className="w-3.5 h-3.5 text-[var(--accent-green)]" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!isEditing}
                    className="w-full input-glass px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    <Phone className="w-3.5 h-3.5 text-[var(--accent-green)]" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!isEditing}
                    className="w-full input-glass px-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent-green)]" />
                  Ubicación
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  disabled={!isEditing}
                  className="w-full input-glass px-4 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        </BentoCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          {/* Subscription Info */}
          <BentoCard variant="glass">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-gold)]/10 flex items-center justify-center border border-[var(--accent-gold)]/20">
                <Shield className="w-5 h-5 text-[var(--accent-gold)]" />
              </div>
              <h3 className="section-title mb-0">Plan de Suscripción</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="badge-active bg-[var(--accent-green)]/10 text-[var(--accent-green)] border-[var(--accent-green)]/20 px-3 py-1">
                  Plan Profesional
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                Hasta 20 sensores activos • Acceso completo al histórico
              </p>
              <PillButton variant="secondary" className="w-full mt-2">Administrar Plan</PillButton>
            </div>
          </BentoCard>

          {/* Security Settings */}
          <BentoCard variant="glass">
            <h3 className="section-title mb-4">Seguridad</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)]/30">
                <p className="text-sm text-[var(--text-primary)] mb-1">Contraseña</p>
                <p className="text-xs text-[var(--text-muted)] mb-3">Última actualización: 15 de febrero, 2026</p>
                <PillButton variant="secondary" className="w-full text-sm">
                  Cambiar Contraseña
                </PillButton>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}