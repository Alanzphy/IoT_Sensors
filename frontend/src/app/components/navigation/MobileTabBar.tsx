import {
  Bell,
  Clock,
  Download,
  LayoutDashboard,
  MapPin,
  Radio,
  Sprout,
  User,
  Users
} from "lucide-react";
import { Link, useLocation } from "react-router";

interface MobileTabBarProps {
  role: "client" | "admin";
}

export function MobileTabBar({ role }: MobileTabBarProps) {
  const location = useLocation();

  const clientTabs = [
    { path: "/cliente", icon: LayoutDashboard, label: "Inicio" },
    { path: "/cliente/areas", icon: MapPin, label: "Predios" },
    { path: "/cliente/historico", icon: Clock, label: "Histórico" },
    { path: "/cliente/exportar", icon: Download, label: "Exportar" },
    { path: "/cliente/perfil", icon: User, label: "Perfil" },
  ];

  const adminTabs = [
    { path: "/admin", icon: LayoutDashboard, label: "Inicio" },
    { path: "/admin/clientes", icon: Users, label: "Clientes" },
    { path: "/admin/nodos", icon: Radio, label: "Nodos" },
    { path: "/admin/cultivos", icon: Sprout, label: "Catálogo" },
    { path: "/admin/alertas", icon: Bell, label: "Alertas" },
  ];

  const tabs = role === "client" ? clientTabs : adminTabs;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(13,13,12,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid var(--border-glass)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path ||
            (tab.path !== "/cliente" && tab.path !== "/admin" && location.pathname.startsWith(tab.path));

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[56px] relative"
              style={{
                color: isActive ? "var(--accent-green)" : "var(--text-muted)",
              }}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "var(--accent-green)" }}
                />
              )}
              <Icon
                className="w-[22px] h-[22px] transition-transform duration-200"
                style={{ transform: isActive ? "scale(1.1)" : "scale(1)" }}
              />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
