import { Outlet } from "react-router";
import { ThemeProvider } from "../context/ThemeContext";
import { AnimatedBackground } from "../components/AnimatedBackground";

export function RootLayout() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative">
        <AnimatedBackground />
        <Outlet />
      </div>
    </ThemeProvider>
  );
}
