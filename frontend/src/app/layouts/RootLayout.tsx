import { Outlet } from "react-router";
import { AnimatedBackground } from "../components/AnimatedBackground";

export function RootLayout() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
