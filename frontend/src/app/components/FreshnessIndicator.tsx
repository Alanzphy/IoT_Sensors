interface FreshnessIndicatorProps {
  lastUpdate: Date;
  variant?: "light" | "dark";
}

export function FreshnessIndicator({ lastUpdate }: FreshnessIndicatorProps) {
  let minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60));
  if (minutesAgo < 0) minutesAgo = 0;

  const isLive = minutesAgo < 2;
  const isWarning = minutesAgo >= 2 && minutesAgo < 20;
  const isStale = minutesAgo >= 20;

  const dotClass = isLive ? "status-dot active" : isWarning ? "status-dot warning" : "status-dot danger";

  const getTimeText = () => {
    if (minutesAgo === 0) return "ahora mismo";
    if (minutesAgo < 60) return `hace ${minutesAgo} min`;
    const hours = Math.floor(minutesAgo / 60);
    const mins = minutesAgo % 60;
    return mins > 0 ? `hace ${hours}h ${mins}min` : `hace ${hours}h`;
  };

  return (
    <div className="flex items-center gap-2">
      <span className={dotClass} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
        Último dato: {getTimeText()}
      </span>
    </div>
  );
}
