import { ReactNode } from "react";

interface PillButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
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
  className = ""
}: PillButtonProps) {
  const variants = {
    primary: "bg-[#6D7E5E] text-[#F4F1EB] hover:opacity-90",
    secondary: "bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5]",
    outline: "border-2 border-[#6D7E5E] text-[#6D7E5E] hover:bg-[#6D7E5E]/5",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-2.5 rounded-full font-medium transition-all ${variants[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
