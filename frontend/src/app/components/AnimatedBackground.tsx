import { useTheme } from "../context/ThemeContext";

export function AnimatedBackground() {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {theme === "light" ? (
        <>
          {/* Soft abstract shapes for light mode */}
          <div className="absolute top-[-12%] left-[-10%] w-[42vw] h-[42vh] rounded-full bg-[var(--card-sand)] opacity-20 blur-[110px]" />
          <div className="absolute bottom-[-12%] right-[-8%] w-[48vw] h-[48vh] rounded-full bg-[var(--accent-primary)] opacity-8 blur-[120px]" />
        </>
      ) : (
        <>
          {/* Subtle mesh and espresso glass ambient shapes */}
          <div className="absolute inset-0 gradient-mesh opacity-8" />
          <div className="absolute top-[8%] left-[14%] w-[280px] h-[280px] bg-[var(--accent-primary)]/10 rounded-full blur-[120px] animate-orb-float-1" />
          <div className="absolute top-[36%] right-[12%] w-[360px] h-[360px] bg-[var(--accent-gold)]/8 rounded-full blur-[140px] animate-orb-float-2" />
          <div className="absolute bottom-[8%] left-[26%] w-[220px] h-[220px] bg-[var(--accent-primary)]/7 rounded-full blur-[110px] animate-orb-float-3" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55vw] h-[55vh] bg-[var(--accent-gold)]/4 rounded-full blur-[160px]" />
        </>
      )}
    </div>
  );
}
