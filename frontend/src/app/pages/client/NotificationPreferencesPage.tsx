import { Loader2, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useSelection } from "../../context/SelectionContext";
import {
    NotificationAlertType,
    NotificationChannel,
    NotificationSeverity,
    bulkUpsertNotificationPreferences,
    getMyNotificationSettings,
    listNotificationPreferences,
    updateMyNotificationSettings,
} from "../../services/notificationPreferences";

const ALERT_TYPES: Array<{ value: NotificationAlertType; label: string }> = [
  { value: "threshold", label: "Umbral" },
  { value: "inactivity", label: "Inactividad" },
];

const SEVERITIES: Array<{ value: NotificationSeverity; label: string }> = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const CHANNELS: Array<{ value: NotificationChannel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

function prefKey(
  irrigationAreaId: number,
  alertType: NotificationAlertType,
  severity: NotificationSeverity,
  channel: NotificationChannel,
): string {
  return `${irrigationAreaId}|${alertType}|${severity}|${channel}`;
}

function parsePrefKey(key: string): {
  irrigationAreaId: number;
  alertType: NotificationAlertType;
  severity: NotificationSeverity;
  channel: NotificationChannel;
} {
  const [areaId, alertType, severity, channel] = key.split("|");
  return {
    irrigationAreaId: Number(areaId),
    alertType: alertType as NotificationAlertType,
    severity: severity as NotificationSeverity,
    channel: channel as NotificationChannel,
  };
}

export function NotificationPreferencesPage() {
  const { properties, areas, loading: selectionLoading, error: selectionError } =
    useSelection();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [baselineGlobalEnabled, setBaselineGlobalEnabled] = useState(true);

  const [preferenceMap, setPreferenceMap] = useState<Record<string, boolean>>({});
  const [baselineMap, setBaselineMap] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const [settings, preferences] = await Promise.all([
        getMyNotificationSettings(),
        listNotificationPreferences({ page: 1, per_page: 500 }),
      ]);

      const mapped: Record<string, boolean> = {};
      for (const item of preferences.data) {
        mapped[
          prefKey(
            item.irrigation_area_id,
            item.alert_type,
            item.severity,
            item.channel,
          )
        ] = item.enabled;
      }

      setGlobalEnabled(settings.notifications_enabled);
      setBaselineGlobalEnabled(settings.notifications_enabled);
      setPreferenceMap(mapped);
      setBaselineMap(mapped);
    } catch (error) {
      console.error("Failed to load notification preferences", error);
      setErrorMessage("No fue posible cargar la configuración de notificaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasChanges = useMemo(() => {
    if (globalEnabled !== baselineGlobalEnabled) {
      return true;
    }

    const keys = new Set([
      ...Object.keys(preferenceMap),
      ...Object.keys(baselineMap),
    ]);
    for (const key of keys) {
      const current = key in preferenceMap ? preferenceMap[key] : true;
      const baseline = key in baselineMap ? baselineMap[key] : true;
      if (current !== baseline) {
        return true;
      }
    }
    return false;
  }, [globalEnabled, baselineGlobalEnabled, preferenceMap, baselineMap]);

  const getCurrentValue = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    severity: NotificationSeverity,
    channel: NotificationChannel,
  ): boolean => {
    const key = prefKey(irrigationAreaId, alertType, severity, channel);
    return key in preferenceMap ? preferenceMap[key] : true;
  };

  const togglePreference = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    severity: NotificationSeverity,
    channel: NotificationChannel,
  ) => {
    const key = prefKey(irrigationAreaId, alertType, severity, channel);
    const current = key in preferenceMap ? preferenceMap[key] : true;
    setPreferenceMap((previous) => ({
      ...previous,
      [key]: !current,
    }));
  };

  const saveChanges = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const changedItems = Object.keys(preferenceMap)
        .map((key) => {
          const current = preferenceMap[key];
          const baseline = key in baselineMap ? baselineMap[key] : true;
          if (current === baseline) {
            return null;
          }
          const parsed = parsePrefKey(key);
          return {
            irrigation_area_id: parsed.irrigationAreaId,
            alert_type: parsed.alertType,
            severity: parsed.severity,
            channel: parsed.channel,
            enabled: current,
          };
        })
        .filter((item) => item !== null);

      if (globalEnabled !== baselineGlobalEnabled) {
        await updateMyNotificationSettings(globalEnabled);
      }

      if (changedItems.length > 0) {
        await bulkUpsertNotificationPreferences(changedItems);
      }

      if (globalEnabled === baselineGlobalEnabled && changedItems.length === 0) {
        setSuccessMessage("No hay cambios para guardar");
      } else {
        setSuccessMessage("Preferencias guardadas correctamente");
      }

      await loadData();
    } catch (error) {
      console.error("Failed to save notification preferences", error);
      setErrorMessage("No fue posible guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (selectionLoading || loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-4">
        <div className="h-8 w-64 rounded-full animate-shimmer mb-2" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (selectionError) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center text-red-600">
        {selectionError}
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl text-[#2C2621]">
            Notificaciones
          </h1>
          <p className="text-[#6E6359]">
            Configura qué alertas recibir por área, severidad y canal.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-full border border-[#C9BEAF] bg-[#F9F8F4] px-4 py-2 text-sm font-medium text-[#4A433B] hover:bg-[#EFE8DD]"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </button>
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#6D7E5E] px-4 py-2 text-sm font-medium text-[#F4F1EB] hover:bg-[#5B6A4D] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </div>

      {errorMessage && (
        <BentoCard variant="light" className="mb-4 border border-red-200">
          <p className="text-red-700">{errorMessage}</p>
        </BentoCard>
      )}
      {successMessage && (
        <BentoCard variant="light" className="mb-4 border border-green-200">
          <p className="text-green-700">{successMessage}</p>
        </BentoCard>
      )}

      <BentoCard variant="light" className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg text-[#2C2621]">Interruptor global</h2>
            <p className="text-sm text-[#6E6359]">
              Si está apagado, no se envía ninguna notificación externa.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-[#4A433B]">
            <input
              type="checkbox"
              checked={globalEnabled}
              onChange={(event) => setGlobalEnabled(event.target.checked)}
              className="h-5 w-5 rounded border-[#C9BEAF] text-[#6D7E5E]"
            />
            {globalEnabled ? "Activado" : "Desactivado"}
          </label>
        </div>
      </BentoCard>

      <div className="space-y-5">
        {properties.map((property) => {
          const propertyAreas = areas.filter((area) => area.property_id === property.id);
          if (propertyAreas.length === 0) {
            return null;
          }

          return (
            <BentoCard key={property.id} variant="light" className="space-y-4">
              <div>
                <h2 className="text-xl text-[#2C2621]">{property.name}</h2>
                <p className="text-sm text-[#6E6359]">
                  {property.location || "Ubicación no definida"}
                </p>
              </div>

              <div className="space-y-4">
                {propertyAreas.map((area) => (
                  <div
                    key={area.id}
                    className="rounded-2xl border border-[#D9D0C4] bg-white p-4"
                  >
                    <h3 className="text-base text-[#2C2621] mb-3">{area.name}</h3>

                    <div className="space-y-4">
                      {ALERT_TYPES.map((alertType) => (
                        <div key={alertType.value}>
                          <h4 className="text-sm text-[#6E6359] mb-2">
                            {alertType.label}
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[420px] border-separate border-spacing-y-2">
                              <thead>
                                <tr className="text-left text-xs text-[#6E6359]">
                                  <th className="pr-4">Severidad</th>
                                  {CHANNELS.map((channel) => (
                                    <th key={channel.value} className="pr-4">
                                      {channel.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {SEVERITIES.map((severity) => (
                                  <tr key={severity.value} className="text-sm text-[#2C2621]">
                                    <td className="py-1 pr-4">{severity.label}</td>
                                    {CHANNELS.map((channel) => {
                                      const checked = getCurrentValue(
                                        area.id,
                                        alertType.value,
                                        severity.value,
                                        channel.value,
                                      );
                                      return (
                                        <td key={channel.value} className="py-1 pr-4">
                                          <label className="inline-flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() =>
                                                togglePreference(
                                                  area.id,
                                                  alertType.value,
                                                  severity.value,
                                                  channel.value,
                                                )
                                              }
                                              className="h-4 w-4 rounded border-[#C9BEAF] text-[#6D7E5E]"
                                            />
                                            <span className="text-xs text-[#6E6359]">
                                              {checked ? "On" : "Off"}
                                            </span>
                                          </label>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          );
        })}
      </div>

      {!hasChanges && (
        <p className="mt-4 text-sm text-[#6E6359]">
          No hay cambios pendientes por guardar.
        </p>
      )}
    </div>
    </PageTransition>
  );
}
