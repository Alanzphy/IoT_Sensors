import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled confirmation modal — replaces window.confirm() with a polished dialog
 * that respects the design system and traps focus.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  // Focus cancel button on open (safer default)
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#2C2621]/30 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm bg-[#F9F8F4] rounded-[32px] p-8 shadow-lg"
        style={{ animation: "fadeInUp 0.25s ease-out both" }}
      >
        {variant === "danger" && (
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
            </div>
          </div>
        )}

        <h2
          id="confirm-dialog-title"
          className="text-lg font-serif font-medium text-[#2C2621] text-center mb-2"
        >
          {title}
        </h2>

        {description && (
          <p className="text-sm text-[#6E6359] text-center mb-6">{description}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium
              bg-[#E2D4B7] text-[#2C2621] hover:bg-[#D5C5A5] active:scale-[0.97]
              transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-full text-sm font-medium
              active:scale-[0.97] transition-all
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              ${variant === "danger"
                ? "bg-[#DC2626] text-white hover:opacity-90 focus-visible:ring-[#DC2626]"
                : "bg-[#6D7E5E] text-[#F4F1EB] hover:opacity-90 focus-visible:ring-[#6D7E5E]"
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
