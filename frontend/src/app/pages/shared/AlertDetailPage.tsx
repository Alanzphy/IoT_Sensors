import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Droplets,
  Loader2,
  RadioTower,
  RefreshCw,
  ThermometerSun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { AlertItem, getAlert, markAlertRead } from "../../services/alerts";

const severityStyles: Record<AlertItem["severity"], string> = {
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  critical: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
};

const typeLabels: Record<AlertItem["type"], string> = {
  threshold: "Umbral",
  inactivity: "Inactividad",
};

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${format(parsed, "dd/MM/yyyy HH:mm")} (${formatDistanceToNowStrict(parsed, {
    addSuffix: true,
    locale: es,
  })})`;
}

function buildRecommendation(alert: AlertItem): {
  title: string;
  icon: typeof AlertTriangle;
  steps: string[];
} {
  if (alert.type === "inactivity") {
    return {
      title: "Recomendación por inactividad",
      icon: RadioTower,
      steps: [
        "Verifica energía, conectividad y ubicación física del nodo.",
        "Confirma que la última lectura esperada no haya fallado por mantenimiento o baja señal.",
        "Si el nodo sigue sin enviar datos, revisa el API key del simulador/dispositivo y reinicia el equipo.",
      ],
    };
  }

  if (alert.parameter === "soil.humidity") {
    return {
      title: "Recomendación para humedad de suelo",
      icon: Droplets,
      steps: [
        "Compara el valor detectado contra el rango configurado para el área.",
        "Revisa si el riego programado reciente fue suficiente o si hubo interrupciones de flujo.",
        "Inspecciona el sensor y el punto de medición antes de ajustar el calendario de riego.",
      ],
    };
  }

  if (alert.parameter === "irrigation.flow_per_minute") {
    return {
      title: "Recomendación para flujo de riego",
      icon: Droplets,
      steps: [
        "Confirma si el riego debía estar activo al momento de la alerta.",
        "Revisa presión, válvulas, filtros y posibles fugas u obstrucciones.",
        "Compara el flujo contra lecturas previas del mismo nodo para detectar cambios bruscos.",
      ],
    };
  }

  if (alert.parameter === "environmental.eto") {
    return {
      title: "Recomendación para E.T.O.",
      icon: ThermometerSun,
      steps: [
        "Interpreta la alerta como una señal de mayor demanda hídrica del cultivo.",
        "Cruza E.T.O. con humedad de suelo y estado del riego antes de aumentar lámina de agua.",
        "Revisa radiación, temperatura y viento para descartar una lectura ambiental atípica.",
      ],
    };
  }

  return {
    title: "Recomendación general",
    icon: AlertTriangle,
    steps: [
      "Revisa el parámetro alertado y compáralo con su rango configurado.",
      "Valida que el sensor esté reportando valores coherentes con el estado real del área.",
      "Consulta el histórico reciente antes de aplicar cambios operativos en riego.",
    ],
  };
}

export function AlertDetailPage() {
  const { alertId } = useParams();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const alertsPath = isAdmin ? "/admin/alertas" : "/cliente/alertas";
  const parsedAlertId = Number(alertId);

  const [alert, setAlert] = useState<AlertItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recommendation = useMemo(
    () => (alert ? buildRecommendation(alert) : null),
    [alert],
  );
  const RecommendationIcon = recommendation?.icon ?? AlertTriangle;

  const fetchAlert = useCallback(async () => {
    if (!Number.isFinite(parsedAlertId) || parsedAlertId <= 0) {
      setErrorMessage("La alerta solicitada no es válida");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getAlert(parsedAlertId);
      setAlert(data);
    } catch (error) {
      console.error("Failed to fetch alert detail", error);
      setErrorMessage("No fue posible cargar la alerta");
    } finally {
      setLoading(false);
    }
  }, [parsedAlertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const markAsRead = async () => {
    if (!alert || alert.read) return;
    setUpdating(true);
    setErrorMessage(null);
    try {
      const updated = await markAlertRead(alert.id, true);
      setAlert(updated);
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      setErrorMessage("No fue posible marcar la alerta como leída");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to={alertsPath}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a alertas
            </Link>
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">
              Recomendación de alerta
            </h1>
            <p className="text-[var(--text-subtle)]">
              Detalle operativo para revisar la alerta recibida por WhatsApp.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchAlert}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        {loading ? (
          <BentoCard variant="light">
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando alerta...
            </div>
          </BentoCard>
        ) : errorMessage && !alert ? (
          <BentoCard variant="light">
            <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger)]">
              {errorMessage}
            </div>
          </BentoCard>
        ) : alert && recommendation ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <BentoCard variant="light">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityStyles[alert.severity]}`}
                >
                  {alert.severity.toUpperCase()}
                </span>
                <span className="rounded-full bg-[var(--surface-card-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-body)]">
                  {typeLabels[alert.type]}
                </span>
                {!alert.read && (
                  <span className="rounded-full bg-[var(--status-warning-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-warning)]">
                    No leída
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                    Mensaje
                  </p>
                  <p className="mt-1 text-base font-medium text-[var(--text-body)]">
                    {alert.message}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Nodo</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.node_id}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Área</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.irrigation_area_id}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Parámetro</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.parameter ?? "N/D"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Valor detectado</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.detected_value ?? "N/D"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-subtle)]">
                  <span className="inline-flex items-center gap-1">
                    <Bell className="h-4 w-4" />
                    {formatTimestamp(alert.timestamp)}
                  </span>
                  {alert.notified_email && <span>Correo enviado</span>}
                  {alert.notified_whatsapp && <span>WhatsApp enviado</span>}
                </div>

                {!alert.read && (
                  <button
                    type="button"
                    onClick={markAsRead}
                    disabled={updating}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Marcar como leída
                  </button>
                )}
              </div>
            </BentoCard>

            <BentoCard variant="light">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-gold-glow)] text-[var(--accent-primary)]">
                  <RecommendationIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-title)]">
                    {recommendation.title}
                  </h2>
                  <p className="text-sm text-[var(--text-subtle)]">
                    Guía inicial generada con reglas del sistema.
                  </p>
                </div>
              </div>

              <ol className="space-y-3">
                {recommendation.steps.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-primary)] text-xs font-semibold text-[var(--text-inverted)]">
                      {index + 1}
                    </span>
                    <span className="text-sm text-[var(--text-body)]">{step}</span>
                  </li>
                ))}
              </ol>

              <p className="mt-4 text-xs text-[var(--text-subtle)]">
                En la Fase 2 esta sección podrá enriquecerse con análisis histórico y
                recomendaciones generadas dentro de la plataforma.
              </p>
            </BentoCard>
          </div>
        ) : null}
      </div>
    </PageTransition>
  );
}
