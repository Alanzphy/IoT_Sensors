import { ReactNode } from "react";
import { BentoCard } from "./BentoCard";
import { FreshnessIndicator } from "./FreshnessIndicator";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon?: ReactNode;
  variant?: "light" | "sand" | "dark" | "brown" | "glass" | "priority" | "gold";
  subtitle?: string;
  lastUpdate?: Date;
  children?: ReactNode;
  priority?: boolean;
  accentColor?: "green" | "gold";
}

export function MetricCard({
  title,
  value,
  unit,
  icon,
  variant = "dark",
  subtitle,
  lastUpdate,
  children,
  priority = false,
  accentColor = "green",
}: MetricCardProps) {
  const isGold = variant === "brown" || variant === "gold" || accentColor === "gold";
  const valueColor = isGold
    ? "var(--accent-gold)"
    : "var(--accent-green)";

  const titleColor = "var(--text-primary)";
  const subtitleColor = "var(--text-muted)";

  return (
    <BentoCard variant={variant} className="flex flex-col gap-3 group h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3
            className="font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", color: titleColor }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5 uppercase tracking-widest font-medium" style={{ color: subtitleColor }}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="p-2.5 rounded-xl flex-shrink-0"
            style={{
              background: isGold ? "rgba(196,164,109,0.12)" : "rgba(143,175,122,0.12)",
              border: `1px solid ${isGold ? "rgba(196,164,109,0.2)" : "rgba(143,175,122,0.2)"}`,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-data tracking-tight transition-all duration-500 ${priority ? "metric-value-lg" : "metric-value"}`}
          style={{ color: valueColor }}
        >
          {value}
        </span>
        <span className="metric-unit">{unit}</span>
      </div>

      {/* Children (chart, ring, etc.) */}
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}

      {/* Freshness */}
      {lastUpdate && (
        <FreshnessIndicator lastUpdate={lastUpdate} />
      )}
    </BentoCard>
  );
}
