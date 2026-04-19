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
    Users,
    Warehouse,
    BellRing,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { preloadMapRoutes } from "../../services/routePreload";

interface MobileTabBarProps {
  role: "client" | "admin";
}

export function MobileTabBar({ role }: MobileTabBarProps) {
  const location = useLocation();

  const maybePreloadMaps = (path: string) => {
    if (path.includes("/mapa")) {
      void preloadMapRoutes();
    }
  };

  const clientTabs = [
    { path: "/cliente",                icon: LayoutDashboard,  label: "Inicio" },
    { path: "/cliente/areas",          icon: Warehouse,         label: "Predios" },
    { path: "/cliente/mapa",           icon: MapPin,            label: "Mapa" },
    { path: "/cliente/historico",      icon: Clock,             label: "Histórico" },
    { path: "/cliente/exportar",       icon: Download,          label: "Exportar" },
    { path: "/cliente/umbrales",       icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/cliente/notificaciones", icon: BellRing,          label: "Notifs" },
  ];

  const adminTabs = [
    { path: "/admin",           icon: LayoutDashboard,  label: "Inicio" },
    { path: "/admin/clientes",  icon: Users,            label: "Clientes" },
    { path: "/admin/mapa",      icon: MapPin,           label: "Mapa" },
    { path: "/admin/nodos",     icon: Radio,            label: "Nodos" },
    { path: "/admin/cultivos",  icon: Sprout,           label: "Catálogo" },
    { path: "/admin/umbrales",  icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/admin/alertas",   icon: Bell,             label: "Alertas" },
    { path: "/admin/auditoria", icon: ClipboardList,    label: "Auditoría" },
  ];

  const tabs = role === "client" ? clientTabs : adminTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#F9F8F4] border-t border-[#2C2621]/10 safe-area-inset-bottom z-50">
      {/* Scrollable container with fade edges */}
      <div className="relative">
        {/* Left fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#F9F8F4] to-transparent z-10" />
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#F9F8F4] to-transparent z-10" />

        <div
          className="flex items-center gap-1 px-3 py-2 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              location.pathname === tab.path ||
              (tab.path !== (role === "client" ? "/cliente" : "/admin") &&
                location.pathname.startsWith(tab.path));

            return (
              <Link
                key={tab.path}
                to={tab.path}
                onMouseEnter={() => maybePreloadMaps(tab.path)}
                onFocus={() => maybePreloadMaps(tab.path)}
                onTouchStart={() => maybePreloadMaps(tab.path)}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl
                  transition-colors flex-shrink-0 min-w-[56px]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E]
                  ${isActive ? "bg-[#6D7E5E]/10" : "hover:bg-[#E2D4B7]/40"}
                `}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${isActive ? "text-[#6D7E5E]" : "text-[#6E6359]"}`}
                />
                <span
                  className={`text-[10px] font-medium leading-tight transition-colors whitespace-nowrap ${
                    isActive ? "text-[#6D7E5E]" : "text-[#6E6359]"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
