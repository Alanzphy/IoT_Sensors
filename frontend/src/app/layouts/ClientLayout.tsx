import { Outlet } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { useIsMobile } from "../hooks/useIsMobile";

export function ClientLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex overflow-x-hidden">
      {!isMobile && <DesktopSidebar role="client" />}
      
      <main className={`flex-1 ${isMobile ? "pb-20" : ""} overflow-x-hidden`}>
        <Outlet />
      </main>

      {isMobile && <MobileTabBar role="client" />}
    </div>
  );
}