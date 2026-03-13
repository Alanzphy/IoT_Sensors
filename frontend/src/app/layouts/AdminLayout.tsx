import { Outlet } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { useIsMobile } from "../hooks/useIsMobile";

export function AdminLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex">
      {!isMobile && <DesktopSidebar role="admin" />}
      
      <main className={`flex-1 ${isMobile ? "pb-20" : ""}`}>
        <Outlet />
      </main>

      {isMobile && <MobileTabBar role="admin" />}
    </div>
  );
}
