import { getSemaphoreClass, getSemaphoreLabel, type SemaphoreLevel } from "./helpers";

export function SemaphorePill({ level }: { level: SemaphoreLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getSemaphoreClass(level)}`}>
      {getSemaphoreLabel(level)}
    </span>
  );
}
