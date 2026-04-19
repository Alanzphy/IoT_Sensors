import { Mail, MapPin, Phone, User } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";

const inputClass = `
  w-full px-4 py-2.5 bg-[#F4F1EB] border border-[#2C2621]/10 rounded-[24px]
  text-[#2C2621] transition-shadow
  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-1
  disabled:opacity-60 disabled:cursor-default
`;

export function ProfilePage() {
  const { showToast } = useToast();
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
    showToast("Perfil actualizado correctamente.", "success");
  };

  const fields = [
    { id: "profile-name",     label: "Nombre Completo",   key: "name"     as const, type: "text",  icon: User },
    { id: "profile-company",  label: "Empresa / Hacienda", key: "company" as const, type: "text",  icon: null },
    { id: "profile-email",    label: "Correo Electrónico", key: "email"   as const, type: "email", icon: Mail },
    { id: "profile-phone",    label: "Teléfono",           key: "phone"   as const, type: "tel",   icon: Phone },
    { id: "profile-location", label: "Ubicación",          key: "location" as const, type: "text", icon: MapPin },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif text-[#2C2621] mb-2">Mi Perfil</h1>
              <p className="text-[#6E6359]">Administra tu información personal</p>
            </div>
            <PillButton
              variant={isEditing ? "primary" : "secondary"}
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
            >
              {isEditing ? "Guardar Cambios" : "Editar Perfil"}
            </PillButton>
          </div>

          {/* Profile Card */}
          <BentoCard>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#6D7E5E] to-[#4D6040] flex items-center justify-center">
                  <User className="w-14 h-14 text-[#F4F1EB]" />
                </div>
                {isEditing && (
                  <PillButton variant="secondary" className="text-sm">
                    Cambiar Foto
                  </PillButton>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(({ id, label, key, type, icon: Icon }) => (
                  <div key={id} className={key === "name" || key === "company" ? "md:col-span-2" : ""}>
                    <label htmlFor={id} className="flex items-center gap-2 text-sm text-[#6E6359] mb-2">
                      {Icon && <Icon className="w-4 h-4" />}
                      {label}
                    </label>
                    <input
                      id={id}
                      type={type}
                      value={formData[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      disabled={!isEditing}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Subscription Info */}
          <BentoCard>
            <h3 className="text-[#2C2621] mb-4">Plan de Suscripción</h3>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="inline-block px-4 py-1.5 bg-[#6D7E5E] text-[#F4F1EB] text-sm rounded-full mb-2">
                  Plan Profesional
                </span>
                <p className="text-sm text-[#6E6359]">
                  Hasta 20 sensores activos • Acceso completo al histórico
                </p>
              </div>
              <PillButton variant="secondary">Ver Planes</PillButton>
            </div>
          </BentoCard>

          {/* Security */}
          <BentoCard>
            <h3 className="text-[#2C2621] mb-4">Seguridad</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <PillButton variant="secondary">Cambiar Contraseña</PillButton>
              <p className="text-sm text-[#6E6359]">
                Última actualización: 15 de febrero, 2026
              </p>
            </div>
          </BentoCard>
        </div>
      </div>
    </PageTransition>
  );
}