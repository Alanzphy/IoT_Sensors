import { ReactNode } from "react";

interface BentoCardProps {
  children: ReactNode;
  variant?: "glass" | "priority" | "gold" | "sand" | "elevated" | "dark" | "light" | "brown";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function BentoCard({
  children,
  variant = "glass",
  className = "",
  padding = "md",
  onClick,
  style,
}: BentoCardProps) {
  // Map old variant names to new ones for backward compatibility
  const resolvedVariant = (() => {
    if (variant === "light") return "glass";
    if (variant === "dark" || variant === "brown") return "priority";
    return variant;
  })();

  const variantClass = {
    glass: "glass-card",
    priority: "card-priority",
    gold: "card-gold",
    sand: "card-sand",
    elevated: "glass-card",
    dark: "card-priority",
    brown: "card-gold",
    light: "glass-card",
  }[variant] ?? "glass-card";

  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-7",
  }[padding];

  const radiusClass = "rounded-2xl";

  return (
    <div
      className={`${variantClass} ${paddingClass} ${radiusClass} ${className} ${onClick ? "cursor-pointer" : ""}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
