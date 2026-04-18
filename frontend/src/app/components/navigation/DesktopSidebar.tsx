import {
    Bell,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    Download,
    LayoutDashboard,
    LogOut,
    MapPin,
    Radio,
    SlidersHorizontal,
    Sprout,
    Users
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";

interface DesktopSidebarProps {
  role: "client" | "admin";
}

export function DesktopSidebar({ role }: DesktopSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();

  const clientNavItems = [
    { path: "/cliente", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/cliente/areas", icon: MapPin, label: "Predios" },
    { path: "/cliente/historico", icon: Clock, label: "Histórico" },
    { path: "/cliente/exportar", icon: Download, label: "Exportar" },
    { path: "/cliente/alertas", icon: Bell, label: "Alertas" },
    {
      path: "/cliente/notificaciones",
      icon: SlidersHorizontal,
      label: "Notificaciones",
    },
  ];

  const adminNavItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/clientes", icon: Users, label: "Clientes" },
    { path: "/admin/nodos", icon: Radio, label: "Nodos" },
    { path: "/admin/cultivos", icon: Sprout, label: "Catálogo" },
    { path: "/admin/umbrales", icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/admin/alertas", icon: Bell, label: "Alertas" },
    { path: "/admin/auditoria", icon: ClipboardList, label: "Auditoría" },
  ];

  const navItems = role === "client" ? clientNavItems : adminNavItems;
  const homePath = role === "client" ? "/cliente" : "/admin";

  return (
    <div
      className={`${expanded ? "w-60" : "w-20"} h-screen sticky top-0 self-start shrink-0 overflow-hidden bg-[#F9F8F4] border-r border-[#2C2621]/10 transition-all duration-300 flex flex-col`}
    >
      {/* Logo */}
      <div className="p-6 flex items-center justify-between">
        {expanded && (
          <h2 className="font-serif text-xl text-[#2C2621]">
            Sensores Agrícolas
          </h2>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors"
        >
          {expanded ? (
            <ChevronLeft className="w-5 h-5 text-[#6E6359]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[#6E6359]" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-2 pb-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const currentPath = location.pathname.replace(/\/+$/, "") || "/";
          const itemPath = item.path.replace(/\/+$/, "") || "/";
          const isHomeItem = itemPath === homePath;
          const isActive =
            currentPath === itemPath ||
            (!isHomeItem && currentPath.startsWith(`${itemPath}/`));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all ${
                isActive
                  ? "bg-[#6D7E5E] text-[#F4F1EB]"
                  : "text-[#6E6359] hover:bg-[#E2D4B7]/30"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-[#2C2621]/10">
        <div className={`flex items-center gap-3 ${expanded ? "" : "justify-center"}`}>
          <div className="w-10 h-10 rounded-full bg-[#6D7E5E] flex items-center justify-center text-[#F4F1EB] font-medium">
            {user?.nombre ? user.nombre.charAt(0).toUpperCase() : (role === "client" ? "C" : "A")}
          </div>
          {expanded && (
            <div className="flex-1">
              <p className="font-medium text-[#2C2621]">{user?.nombre || "Usuario"}</p>
              <p className="text-sm text-[#6E6359]">{role === "client" ? "Cliente" : "Admin"}</p>
            </div>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("refreshToken");
              window.location.href = "/";
            }}
            className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#6E6359]" />
          </button>
        </div>
      </div>
    </div>
  );
}
