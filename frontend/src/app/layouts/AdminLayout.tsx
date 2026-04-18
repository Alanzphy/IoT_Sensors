import { Outlet } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { AlertsPopover } from "../components/notifications/AlertsPopover";
import { useIsMobile } from "../hooks/useIsMobile";

export function AdminLayout() {
  const isMobile = useIsMobile();

  return (
    <div
      className={`bg-[#F4F1EB] flex overflow-x-hidden ${
        isMobile ? "min-h-screen" : "h-screen overflow-hidden"
      }`}
    >
      {!isMobile && <DesktopSidebar role="admin" />}

      <main
        className={`flex-1 min-w-0 overflow-x-hidden ${
          isMobile ? "pb-20" : "h-screen overflow-y-auto"
        }`}
      >
        <Outlet />
      </main>

      <AlertsPopover className={isMobile ? "fixed top-3 right-3 z-40" : "fixed top-4 right-6 z-40"} />

      {isMobile && <MobileTabBar role="admin" />}
    </div>
  );
}
