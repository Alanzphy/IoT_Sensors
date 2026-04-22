import { useTheme } from "../context/ThemeContext";

export function AnimatedBackground() {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {theme === "light" ? (
        <>
          {/* Soft abstract shapes for light mode */}
          <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vh] rounded-full bg-[var(--card-sand)] opacity-20 blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vh] rounded-full bg-[var(--accent-primary)] opacity-10 blur-[120px]" />
        </>
      ) : (
        <>
          {/* Grid overlay for dark mode */}
          <div className="absolute inset-0 gradient-mesh opacity-20" />
          
          {/* Glowing orbs for dark mode command center */}
          <div className="absolute top-[10%] left-[20%] w-[300px] h-[300px] bg-[var(--accent-primary)]/15 rounded-full blur-[100px] animate-orb-float-1" />
          <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] bg-[var(--accent-gold)]/10 rounded-full blur-[120px] animate-orb-float-2" />
          <div className="absolute bottom-[10%] left-[30%] w-[250px] h-[250px] bg-[var(--accent-primary)]/10 rounded-full blur-[90px] animate-orb-float-3" />
          
          {/* Ambient center glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-[var(--accent-primary)]/5 rounded-full blur-[150px]" />
        </>
      )}
    </div>
  );
}
