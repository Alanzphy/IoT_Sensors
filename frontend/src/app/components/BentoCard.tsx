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
    light: "bg-[#F9F8F4]",
    sand: "bg-[#E2D4B7]",
    dark: "bg-[#3B312B] text-[#F4F1EB]",
    brown: "bg-[#705541] text-[#F4F1EB]",
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
