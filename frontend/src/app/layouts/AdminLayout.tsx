import { motion } from "motion/react";
import { Outlet, useLocation } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { AlertsPopover } from "../components/notifications/AlertsPopover";
import { useIsMobile } from "../hooks/useIsMobile";

export function AdminLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();

  return (
    <div
      className={`bg-transparent flex overflow-x-hidden ${
        isMobile ? "min-h-screen" : "h-screen overflow-hidden"
      }`}
    >
      {!isMobile && <DesktopSidebar role="admin" />}

      <main
        className={`flex-1 min-w-0 overflow-x-hidden ${
          isMobile ? "pb-20" : "h-screen overflow-y-auto"
        }`}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="min-h-full"
        >
          <Outlet />
        </motion.div>
      </main>

      <AlertsPopover className={isMobile ? "fixed bottom-24 right-4 z-40 group" : "fixed bottom-8 right-8 z-40 group"} />

      {isMobile && <MobileTabBar role="admin" />}
    </div>
  );
}
