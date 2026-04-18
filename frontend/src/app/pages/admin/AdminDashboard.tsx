import { useState, useEffect } from "react";
import { Users, MapPin, Radio, Database, AlertCircle, Plus, Activity, ArrowRight } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { Link } from "react-router";
import { api } from "../../services/api";

interface StatCard {
  label: string;
  value: string | number;
  icon: typeof Users;
  accent: string;
  accentBg: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    properties: 0,
    nodesTotal: 0,
    nodesActive: 0,
    readingsToday: 0,
  });
  const [offlineNodes, setOfflineNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [clientsRes, propsRes, nodesRes, readingsRes] = await Promise.all([
          api.get("/clients?per_page=1"),
          api.get("/properties?per_page=1"),
          api.get("/nodes?per_page=200"),
          api.get(`/readings?per_page=1&start_date=${new Date().toISOString().split("T")[0]}`),
        ]);

        const totalClients = clientsRes.data.total || 0;
        const totalProps = propsRes.data.total || 0;
        const totalReadings = readingsRes.data.total || 0;
        const nodesData = nodesRes.data.data || nodesRes.data || [];
        const totalNodes = nodesRes.data.total || nodesData.length || 0;
        const activeNodes = nodesData.filter((n: any) => n.is_active || n.activo).length;

        setStats({
          clients: totalClients,
          properties: totalProps,
          nodesTotal: totalNodes,
          nodesActive: activeNodes,
          readingsToday: totalReadings,
        });
        setOfflineNodes(nodesData.filter((n: any) => !(n.is_active || n.activo)));
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const statCards: StatCard[] = [
    {
      label: "Total Clientes",
      value: stats.clients,
      icon: Users,
      accent: "var(--accent-green)",
      accentBg: "rgba(143,175,122,0.12)",
    },
    {
      label: "Total Predios",
      value: stats.properties,
      icon: MapPin,
      accent: "var(--accent-gold)",
      accentBg: "rgba(196,164,109,0.12)",
    },
    {
      label: "Nodos Activos",
      value: `${stats.nodesActive}/${stats.nodesTotal}`,
      icon: Radio,
      accent: "var(--status-active)",
      accentBg: "var(--status-active-bg)",
    },
    {
      label: "Lecturas Hoy",
      value: stats.readingsToday.toLocaleString(),
      icon: Database,
      accent: "#5B9BD5",
      accentBg: "rgba(91,155,213,0.1)",
    },
  ];

  const quickActions = [
    { label: "Nuevo Cliente", to: "/admin/clientes", icon: Users, accent: "var(--accent-green)" },
    { label: "Nuevo Predio", to: "/admin/clientes", icon: MapPin, accent: "var(--accent-gold)" },
    { label: "Nuevo Nodo", to: "/admin/nodos", icon: Radio, accent: "#5B9BD5" },
  ];

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <Activity className="w-5 h-5" style={{ color: "var(--accent-green)" }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-green)" }}>
            Panel de Control
          </span>
        </div>
        <h1 className="page-title text-gradient">Panel de Administración</h1>
        <p className="page-subtitle">
          {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 h-[120px] shimmer" />
          ))}
        </div>
      ) : (
        <div className="animate-fade-in-up stagger">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <BentoCard key={card.label} variant="glass" className="flex flex-col gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: card.accentBg, border: `1px solid ${card.accentBg}` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                      {card.label}
                    </p>
                    <p
                      className="font-data font-bold text-3xl"
                      style={{ color: "var(--text-primary)", letterSpacing: "-0.04em" }}
                    >
                      {card.value}
                    </p>
                  </div>
                </BentoCard>
              );
            })}
          </div>

          {/* Body grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Offline nodes panel */}
            <div className="lg:col-span-2">
              <BentoCard variant="glass">
                <div className="section-header">
                  <h3 className="section-title">Nodos Sin Comunicación</h3>
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{
                      background: offlineNodes.length > 0 ? "var(--status-danger-bg)" : "var(--status-active-bg)",
                      border: `1px solid ${offlineNodes.length > 0 ? "rgba(248,113,113,0.2)" : "rgba(74,222,128,0.2)"}`,
                    }}
                  >
                    <AlertCircle
                      className="w-3.5 h-3.5"
                      style={{ color: offlineNodes.length > 0 ? "var(--status-danger)" : "var(--status-active)" }}
                    />
                    <span
                      className="text-xs font-semibold"
                      style={{ color: offlineNodes.length > 0 ? "var(--status-danger)" : "var(--status-active)" }}
                    >
                      {offlineNodes.length} offline
                    </span>
                  </div>
                </div>

                {offlineNodes.length === 0 ? (
                  <div className="flex items-center gap-3 py-6">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--status-active-bg)" }}
                    >
                      <Radio className="w-5 h-5" style={{ color: "var(--status-active)" }} />
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                        Todos los nodos operando correctamente
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        No hay nodos sin comunicación en este momento.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {offlineNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center gap-4 p-3.5 rounded-xl"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border-subtle)",
                          borderLeft: "3px solid var(--status-danger)",
                        }}
                      >
                        <div className="status-dot danger flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                            {node.name || `Nodo #${node.id}`}
                          </p>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            Serial: {node.serial_number || "—"}
                          </p>
                        </div>
                        <span className="badge-danger flex-shrink-0">Sin conexión</span>
                      </div>
                    ))}
                  </div>
                )}
              </BentoCard>
            </div>

            {/* Quick actions */}
            <div className="space-y-4">
              <BentoCard variant="glass">
                <h3 className="section-title mb-4">Acciones Rápidas</h3>
                <div className="space-y-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link key={action.label} to={action.to} className="block">
                        <div
                          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--border-subtle)",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glass)";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${action.accent}18` }}
                          >
                            <Plus className="w-4 h-4" style={{ color: action.accent }} />
                          </div>
                          <span className="flex-1 font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                            {action.label}
                          </span>
                          <ArrowRight
                            className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                            style={{ color: "var(--text-muted)" }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </BentoCard>

              <BentoCard variant="sand">
                <h3 className="section-title mb-3">Actividad Reciente</h3>
                <div
                  className="flex flex-col items-center justify-center py-6 space-y-2"
                  style={{ opacity: 0.5 }}
                >
                  <Activity className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                    El registro de actividad estará disponible próximamente.
                  </p>
                </div>
              </BentoCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
