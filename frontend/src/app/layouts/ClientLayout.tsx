import { Outlet } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { AlertsPopover } from "../components/notifications/AlertsPopover";
import { SelectionProvider } from "../context/SelectionContext";
import { useIsMobile } from "../hooks/useIsMobile";

export function ClientLayout() {
  const isMobile = useIsMobile();

  return (
    <SelectionProvider>
      <div
        className={`bg-[#F4F1EB] flex overflow-x-hidden ${
          isMobile ? "min-h-screen" : "h-screen overflow-hidden"
        }`}
      >
        {!isMobile && <DesktopSidebar role="client" />}

        <main
          className={`flex-1 min-w-0 overflow-x-hidden ${
            isMobile ? "pb-20" : "h-screen overflow-y-auto"
          }`}
        >
          <Outlet />
        </main>

        <AlertsPopover className={isMobile ? "fixed top-3 right-3 z-40" : "fixed top-4 right-6 z-40"} />

        {isMobile && <MobileTabBar role="client" />}
      </div>
    </SelectionProvider>
  );
}
