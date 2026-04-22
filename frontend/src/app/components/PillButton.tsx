import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

interface PillButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function PillButton({ 
  children, 
  variant = "primary", 
  onClick, 
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  "aria-label": ariaLabel,
}: PillButtonProps) {
  const variants = {
    primary: "bg-[var(--accent-primary)] text-[var(--text-inverted)] hover:opacity-90 hover:shadow-lg dark:hover:shadow-[var(--accent-glow)]",
    secondary: "bg-[var(--card-sand)] text-[var(--text-main)] hover:brightness-95",
    outline: "border-2 border-[var(--accent-primary)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10",
    ghost: "text-[var(--text-main)] hover:bg-[var(--border-subtle)]",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center gap-2
        px-6 py-2.5 rounded-full font-medium
        transition-all duration-150
        active:scale-[0.97]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2
        ${variants[variant]}
        ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {children}
    </button>
  );
}
