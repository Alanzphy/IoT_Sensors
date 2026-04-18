import {
    Bell,
    ClipboardList,
    Clock,
    Download,
    LayoutDashboard,
    MapPin,
    Radio,
    SlidersHorizontal,
    Sprout,
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
    { path: "/cliente/notificaciones", icon: Bell, label: "Notifs" },
  ];

  const adminTabs = [
    { path: "/admin", icon: LayoutDashboard, label: "Inicio" },
    { path: "/admin/clientes", icon: Users, label: "Clientes" },
    { path: "/admin/nodos", icon: Radio, label: "Nodos" },
    { path: "/admin/cultivos", icon: Sprout, label: "Catálogo" },
    { path: "/admin/umbrales", icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/admin/alertas", icon: Bell, label: "Alertas" },
    { path: "/admin/auditoria", icon: ClipboardList, label: "Auditoría" },
  ];

  const tabs = role === "client" ? clientTabs : adminTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#F9F8F4] border-t border-[#2C2621]/10 safe-area-inset-bottom z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-colors min-w-[64px]"
            >
              <Icon
                className={`w-6 h-6 ${isActive ? "text-[#6D7E5E]" : "text-[#6E6359]"}`}
              />
              <span
                className={`text-xs font-medium ${isActive ? "text-[#6D7E5E]" : "text-[#6E6359]"}`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
