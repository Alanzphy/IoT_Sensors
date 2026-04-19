import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Illustrated empty state with icon, title, description and optional CTA.
 * Replaces plain "No hay datos" text for a more polished UX.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-[24px] bg-[#E2D4B7] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#6E6359]" />
      </div>
      <h3 className="text-lg font-medium text-[#2C2621] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[#6E6359] max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-6 py-2.5 rounded-full bg-[#6D7E5E] text-[#F4F1EB] text-sm font-medium
            hover:opacity-90 active:scale-[0.97] transition-all
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D7E5E] focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
