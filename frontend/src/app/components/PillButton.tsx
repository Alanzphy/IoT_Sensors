import { ReactNode } from "react";

interface PillButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}

export function PillButton({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: PillButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 cursor-pointer select-none";

  const variants: Record<string, string> = {
    primary: `
      text-[var(--primary-foreground)]
      hover:opacity-90 active:scale-[0.97]
      shadow-sm hover:shadow-md
    `,
    secondary: `
      bg-white/[0.06] text-[var(--text-primary)]
      border border-[var(--border-glass)]
      hover:bg-white/[0.1] hover:border-[var(--border-highlight)]
      active:scale-[0.97]
    `,
    outline: `
      border text-[var(--accent-green)]
      bg-transparent
      hover:bg-[var(--accent-green)]/10
      active:scale-[0.97]
    `,
    ghost: `
      text-[var(--text-secondary)] bg-transparent
      hover:bg-white/[0.05] hover:text-[var(--text-primary)]
      active:scale-[0.97]
    `,
    danger: `
      text-[var(--status-danger)]
      border border-[var(--status-danger)]/30
      bg-[var(--status-danger-bg)]
      hover:bg-[var(--status-danger)]/20
      active:scale-[0.97]
    `,
  };

  const primaryBg = `bg-[var(--accent-green)]`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${variant === "primary" ? primaryBg : ""} ${
        disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
