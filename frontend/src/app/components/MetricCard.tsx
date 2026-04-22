import { ReactNode } from "react";
import { BentoCard } from "./BentoCard";
import { FreshnessIndicator } from "./FreshnessIndicator";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon?: ReactNode;
  variant?: "light" | "sand" | "dark" | "brown";
  subtitle?: string;
  lastUpdate?: Date;
  children?: ReactNode;
  priority?: boolean;
}

export function MetricCard({
  title,
  value,
  unit,
  icon,
  variant = "sand",
  subtitle,
  lastUpdate,
  children,
  priority = false,
}: MetricCardProps) {
  return (
    <BentoCard variant={variant} className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`text-lg ${variant === "dark" || variant === "brown" ? "text-[var(--text-on-dark)]" : "text-[var(--text-main)]"}`}>
            {title}
          </h3>
          {subtitle && (
            <p className={`text-sm mt-1 ${variant === "dark" || variant === "brown" ? "text-[var(--text-on-dark)]/70" : "text-[var(--text-muted)]"}`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="bg-[var(--card-sand)] text-[var(--text-main)] p-3 rounded-[24px]">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`${priority ? "text-5xl" : "text-4xl"} font-bold font-mono-data`}>
          {value}
        </span>
        <span className={`text-xl ${variant === "dark" || variant === "brown" ? "text-[var(--text-on-dark)]/80" : "text-[var(--text-muted)]"}`}>
          {unit}
        </span>
      </div>

      {children}

      {lastUpdate && (
        <FreshnessIndicator lastUpdate={lastUpdate} variant={variant === "dark" || variant === "brown" ? "dark" : "light"} />
      )}
    </BentoCard>
  );
}
