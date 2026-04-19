import { useEffect, useState } from "react";

interface FreshnessIndicatorProps {
  lastUpdate: Date;
  variant?: "light" | "dark";
}

function getTimeText(minutesAgo: number): string {
  if (minutesAgo < 1) return "hace un momento";
  if (minutesAgo < 60) return `hace ${minutesAgo} min`;
  const hours = Math.floor(minutesAgo / 60);
  const mins = minutesAgo % 60;
  return mins > 0 ? `hace ${hours}h ${mins}min` : `hace ${hours}h`;
}

export function FreshnessIndicator({ lastUpdate, variant = "light" }: FreshnessIndicatorProps) {
  const [, forceUpdate] = useState(0);

  // Re-render quickly for testing
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  let minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60));
  if (minutesAgo < 0) minutesAgo = 0;

  let dotColor: string;
  let statusLabel: string;

  if (minutesAgo < 30) {
    dotColor = "#6D7E5E"; // green — recent
    statusLabel = "En línea";
  } else if (minutesAgo < 120) {
    dotColor = "#D97706"; // amber — warning
    statusLabel = "Advertencia";
  } else {
    dotColor = "#DC2626"; // red — error
    statusLabel = "Sin conexión";
  }

  const textColor = variant === "dark" ? "text-[#F4F1EB]/70" : "text-[#6E6359]";
  const isPulsing = minutesAgo < 30;

  return (
    <div
      className={`flex items-center gap-2 text-sm ${textColor}`}
      title={`Estado del nodo: ${statusLabel}. Último dato recibido ${getTimeText(minutesAgo)}.`}
    >
      <span className="relative flex items-center justify-center w-2.5 h-2.5">
        {/* Pulsing ring when fresh */}
        {isPulsing && (
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-60"
            style={{
              backgroundColor: dotColor,
              animation: "rippleExpand 2s ease-out infinite",
            }}
          />
        )}
        <span
          className="relative block w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
      </span>
      <span>Último dato: {getTimeText(minutesAgo)}</span>
    </div>
  );
}
