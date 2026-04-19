import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

interface PillButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
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
    primary: "bg-[#6D7E5E] text-[#F4F1EB] hover:opacity-90",
    secondary: "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]",
    outline: "border-2 border-[#6D7E5E] text-[#6D7E5E] hover:bg-[#6D7E5E]/5",
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
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-2
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
