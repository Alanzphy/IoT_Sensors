import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutDashboard,
  LogOut,
  MapPin,
  Radio,
  Sprout,
  User,
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
    { path: "/cliente/perfil", icon: User, label: "Mi Perfil" },
  ];

  const adminNavItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/clientes", icon: Users, label: "Clientes" },
    { path: "/admin/nodos", icon: Radio, label: "Nodos" },
    { path: "/admin/cultivos", icon: Sprout, label: "Catálogo" },
    { path: "/admin/alertas", icon: Bell, label: "Alertas" },
  ];

  const navItems = role === "client" ? clientNavItems : adminNavItems;
  const homePath = role === "client" ? "/cliente" : "/admin";
  const initials = user?.nombre ? user.nombre.charAt(0).toUpperCase() : (role === "client" ? "C" : "A");

  return (
    <div
      className={`${expanded ? "w-[220px]" : "w-[68px]"} h-screen sticky top-0 self-start shrink-0 overflow-hidden glass-panel rounded-none border-y-0 border-l-0 transition-all duration-300 flex flex-col z-20`}
      style={{ borderRight: "1px solid var(--border-subtle)" }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between min-h-[64px]">
        {expanded && (
          <div className="flex items-center gap-2.5 animate-fade-in overflow-hidden">
            {/* Logo mark */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--accent-green) 0%, var(--accent-gold) 100%)",
              }}
            >
              <Sprout className="w-4 h-4" style={{ color: "#0D0D0C" }} />
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm leading-tight truncate" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>
                Sensores
              </p>
              <p className="text-xs leading-tight truncate" style={{ color: "var(--text-muted)" }}>
                Agrícolas IoT
              </p>
            </div>
          </div>
        )}
        {!expanded && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
            style={{
              background: "linear-gradient(135deg, var(--accent-green) 0%, var(--accent-gold) 100%)",
            }}
          >
            <Sprout className="w-4 h-4" style={{ color: "#0D0D0C" }} />
          </div>
        )}
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute bottom-[72px] left-1/2 -translate-x-1/2 p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="divider mx-3 mb-3" />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2.5 space-y-1 pb-4">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                isActive ? "nav-accent-line" : ""
              }`}
              style={{
                background: isActive ? "rgba(143,175,122,0.1)" : "transparent",
                color: isActive ? "var(--accent-green)" : "var(--text-secondary)",
                border: isActive ? "1px solid rgba(143,175,122,0.15)" : "1px solid transparent",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {expanded && (
                <span className="font-medium text-sm animate-fade-in truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="divider mx-3 mb-3" />

      {/* User section */}
      <div className={`px-3 pb-5 flex items-center gap-3 ${!expanded ? "justify-center" : ""}`}>
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: role === "admin"
              ? "linear-gradient(135deg, rgba(196,164,109,0.3) 0%, rgba(196,164,109,0.1) 100%)"
              : "linear-gradient(135deg, rgba(143,175,122,0.3) 0%, rgba(143,175,122,0.1) 100%)",
            border: role === "admin"
              ? "1px solid rgba(196,164,109,0.3)"
              : "1px solid rgba(143,175,122,0.3)",
            color: role === "admin" ? "var(--accent-gold)" : "var(--accent-green)",
          }}
        >
          {initials}
        </div>

        {expanded && (
          <div className="flex-1 overflow-hidden animate-fade-in">
            <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
              {user?.nombre || "Usuario"}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {role === "client" ? "Cliente" : "Admin"}
            </p>
          </div>
        )}

        {expanded && (
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("refreshToken");
              window.location.href = "/";
            }}
            className="p-1.5 rounded-lg transition-colors flex-shrink-0"
            title="Cerrar sesión"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--status-danger-bg)";
              (e.currentTarget as HTMLElement).style.color = "var(--status-danger)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
