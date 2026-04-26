import {
  Activity,
  Bot,
  Bell,
  BellRing,
  ClipboardList,
  Clock,
  Download,
  LayoutDashboard,
  MessageCircle,
  MapPin,
  Moon,
  Radio,
  SlidersHorizontal,
  Sprout,
  Sun,
  User,
  Users,
  Warehouse,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { useTheme } from "../../context/ThemeContext";
import { preloadMapRoutes } from "../../services/routePreload";

interface MobileTabBarProps {
  role: "client" | "admin";
}

export function MobileTabBar({ role }: MobileTabBarProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

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
    { path: "/cliente/asistente-ia",   icon: MessageCircle,     label: "Chat IA" },
    { path: "/cliente/reportes-ia",    icon: Bot,               label: "IA" },
    { path: "/cliente/umbrales",       icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/cliente/notificaciones", icon: BellRing,          label: "Notifs" },
    { path: "/cliente/perfil",         icon: User,              label: "Perfil" },
  ];

  const adminTabs = [
    { path: "/admin",           icon: LayoutDashboard,  label: "Inicio" },
    { path: "/admin/clientes",  icon: Users,            label: "Clientes" },
    { path: "/admin/mapa",      icon: MapPin,           label: "Mapa" },
    { path: "/admin/nodos",     icon: Radio,            label: "Nodos" },
    { path: "/admin/cultivos",  icon: Sprout,           label: "Catálogo" },
    { path: "/admin/umbrales",  icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/admin/alertas",   icon: Bell,             label: "Alertas" },
    { path: "/admin/asistente-ia", icon: MessageCircle, label: "Chat IA" },
    { path: "/admin/consumo-ia", icon: Activity,        label: "Uso IA" },
    { path: "/admin/reportes-ia", icon: Bot,            label: "IA" },
    { path: "/admin/auditoria", icon: ClipboardList,    label: "Auditoría" },
  ];

  const tabs = role === "client" ? clientTabs : adminTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 glass-sidebar border-t border-sidebar-border safe-area-inset-bottom z-50">
      {/* Scrollable container with fade edges */}
      <div className="relative">
        {/* Left fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-sidebar to-transparent z-10" />
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-sidebar to-transparent z-10" />

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
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
                  ${isActive ? "bg-sidebar-primary/16" : "hover:bg-sidebar-accent"}
                `}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"}`}
                />
                <span
                  className={`text-[10px] font-medium leading-tight transition-colors whitespace-nowrap ${
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl
              transition-colors flex-shrink-0 min-w-[56px]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
              hover:bg-sidebar-accent
            `}
            aria-label="Cambiar tema"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 text-sidebar-foreground/70" />
            ) : (
              <Sun className="w-5 h-5 text-sidebar-foreground/70" />
            )}
            <span className="text-[10px] font-medium leading-tight text-sidebar-foreground/70 whitespace-nowrap">
              Tema
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
