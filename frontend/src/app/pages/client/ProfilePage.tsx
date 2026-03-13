import { Mail, MapPin, Phone, User } from "lucide-react";
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
    <div className="min-h-screen bg-[#FAF7F2] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl text-[#2C2621] mb-2">
              Mi Perfil
            </h1>
            <p className="text-[#6B5E4C]">
              Administra tu información personal
            </p>
          </div>
          <PillButton
            variant={isEditing ? "primary" : "secondary"}
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          >
            {isEditing ? "Guardar Cambios" : "Editar Perfil"}
          </PillButton>
        </div>

        {/* Profile Card */}
        <BentoCard className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#7C8F5C] to-[#6B7A4F] flex items-center justify-center">
                <User className="w-16 h-16 text-white" />
              </div>
              {isEditing && (
                <PillButton variant="secondary" className="text-sm">
                  Cambiar Foto
                </PillButton>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm text-[#6B5E4C] mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={!isEditing}
                  className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C] disabled:bg-[#FAF7F2] disabled:text-[#6B5E4C]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6B5E4C] mb-2">
                  Empresa / Hacienda
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  disabled={!isEditing}
                  className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C] disabled:bg-[#FAF7F2] disabled:text-[#6B5E4C]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-[#6B5E4C] mb-2">
                    <Mail className="w-4 h-4" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={!isEditing}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C] disabled:bg-[#FAF7F2] disabled:text-[#6B5E4C]"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-[#6B5E4C] mb-2">
                    <Phone className="w-4 h-4" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={!isEditing}
                    className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C] disabled:bg-[#FAF7F2] disabled:text-[#6B5E4C]"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-[#6B5E4C] mb-2">
                  <MapPin className="w-4 h-4" />
                  Ubicación
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  disabled={!isEditing}
                  className="w-full px-4 py-2.5 bg-white border-2 border-[#E5DDD1] rounded-2xl text-[#2C2621] focus:outline-none focus:border-[#7C8F5C] disabled:bg-[#FAF7F2] disabled:text-[#6B5E4C]"
                />
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Subscription Info */}
        <BentoCard className="p-6">
          <h3 className="text-lg text-[#2C2621] mb-4">Plan de Suscripción</h3>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-4 py-1.5 bg-[#7C8F5C] text-white text-sm rounded-full">
                  Plan Profesional
                </span>
              </div>
              <p className="text-sm text-[#6B5E4C]">
                Hasta 20 sensores activos • Acceso completo al histórico
              </p>
            </div>
            <PillButton variant="secondary">Ver Planes</PillButton>
          </div>
        </BentoCard>

        {/* Security Settings */}
        <BentoCard className="p-6">
          <h3 className="text-lg text-[#2C2621] mb-4">Seguridad</h3>
          <div className="space-y-3">
            <PillButton variant="secondary" className="w-full md:w-auto">
              Cambiar Contraseña
            </PillButton>
            <div className="text-sm text-[#6B5E4C]">
              Última actualización: 15 de febrero, 2026
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}