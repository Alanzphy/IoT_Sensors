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
    Users,
    Warehouse,
    BellRing,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { preloadMapRoutes } from "../../services/routePreload";

interface DesktopSidebarProps {
  role: "client" | "admin";
}

export function DesktopSidebar({ role }: DesktopSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSidebarToggle = () => {
    setExpanded((previous) => {
      const next = !previous;
      if (next) {
        void preloadMapRoutes();
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const maybePreloadMaps = (path: string) => {
    if (path.includes("/mapa")) {
      void preloadMapRoutes();
    }
  };

  const clientNavItems = [
    { path: "/cliente",              icon: LayoutDashboard,  label: "Dashboard" },
    { path: "/cliente/areas",        icon: Warehouse,         label: "Predios" },
    { path: "/cliente/mapa",         icon: MapPin,            label: "Mapa" },
    { path: "/cliente/historico",    icon: Clock,             label: "Histórico" },
    { path: "/cliente/exportar",     icon: Download,          label: "Exportar" },
    { path: "/cliente/alertas",      icon: Bell,              label: "Alertas" },
    { path: "/cliente/umbrales",     icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/cliente/notificaciones", icon: BellRing,        label: "Notificaciones" },
  ];

  const adminNavItems = [
    { path: "/admin",           icon: LayoutDashboard,  label: "Dashboard" },
    { path: "/admin/clientes",  icon: Users,            label: "Clientes" },
    { path: "/admin/mapa",      icon: MapPin,           label: "Mapa" },
    { path: "/admin/nodos",     icon: Radio,            label: "Nodos" },
    { path: "/admin/cultivos",  icon: Sprout,           label: "Catálogo" },
    { path: "/admin/umbrales",  icon: SlidersHorizontal, label: "Umbrales" },
    { path: "/admin/alertas",   icon: Bell,             label: "Alertas" },
    { path: "/admin/auditoria", icon: ClipboardList,    label: "Auditoría" },
  ];

  const navItems = role === "client" ? clientNavItems : adminNavItems;
  const homePath = role === "client" ? "/cliente" : "/admin";

  return (
    <div
      className={`${expanded ? "w-60" : "w-20"} h-screen sticky top-0 self-start shrink-0 overflow-hidden bg-[#F9F8F4] border-r border-[#2C2621]/10 transition-all duration-300 flex flex-col`}
    >
      {/* Logo */}
      <div className="p-6 flex items-center justify-between min-h-[80px]">
        <div
          className={`overflow-hidden transition-all duration-300 ${expanded ? "w-full opacity-100" : "w-0 opacity-0"}`}
        >
          <h2 className="font-serif text-xl text-[#2C2621] whitespace-nowrap">
            Sensores Agrícolas
          </h2>
        </div>
        <button
          onClick={handleSidebarToggle}
          className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E]"
          aria-label={expanded ? "Colapsar menú" : "Expandir menú"}
        >
          {expanded ? (
            <ChevronLeft className="w-5 h-5 text-[#6E6359]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[#6E6359]" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
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
              onMouseEnter={() => maybePreloadMaps(item.path)}
              onFocus={() => maybePreloadMaps(item.path)}
              aria-current={isActive ? "page" : undefined}
              title={!expanded ? item.label : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-full transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-1
                ${expanded ? "" : "justify-center"}
                ${isActive
                  ? "bg-[#6D7E5E] text-[#F4F1EB]"
                  : "text-[#6E6359] hover:bg-[#E2D4B7]/30"
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={`font-medium overflow-hidden transition-all duration-300 whitespace-nowrap ${
                  expanded ? "max-w-full opacity-100" : "max-w-0 opacity-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-[#2C2621]/10">
        <div className={`flex items-center gap-3 ${expanded ? "" : "justify-center"}`}>
          <div className="w-9 h-9 rounded-full bg-[#6D7E5E] flex items-center justify-center text-[#F4F1EB] font-medium text-sm flex-shrink-0">
            {user?.nombre ? user.nombre.charAt(0).toUpperCase() : (role === "client" ? "C" : "A")}
          </div>

          <div
            className={`flex-1 min-w-0 overflow-hidden transition-all duration-300 ${
              expanded ? "max-w-full opacity-100" : "max-w-0 opacity-0"
            }`}
          >
            <p className="font-medium text-[#2C2621] text-sm truncate">{user?.nombre || "Usuario"}</p>
            <p className="text-xs text-[#6E6359] truncate">{role === "client" ? "Cliente" : "Admin"}</p>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-[#E2D4B7]/50 transition-colors flex-shrink-0
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E]"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 text-[#6E6359]" />
          </button>
        </div>
      </div>
    </div>
  );
}
