import { ReactNode } from "react";

interface BentoCardProps {
  children: ReactNode;
  variant?: "light" | "sand" | "dark" | "brown";
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export function BentoCard({ 
  children, 
  variant = "light", 
  className = "",
  padding = "md"
}: BentoCardProps) {
  const backgrounds = {
    light: "glass-card text-[var(--text-main)]",
    sand: "bg-[var(--card-sand)] text-[var(--text-main)]",
    dark: "bg-[var(--card-dark)] text-[var(--text-on-dark)]",
    brown: "bg-[var(--card-brown)] text-[var(--text-on-dark)]",
  };

  const paddings = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div className={`${backgrounds[variant]} ${paddings[padding]} rounded-[32px] ${className}`}>
      {children}
    </div>
  );
}
