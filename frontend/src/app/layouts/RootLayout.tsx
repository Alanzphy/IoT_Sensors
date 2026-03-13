import { Outlet } from "react-router";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-[#F4F1EB]">
      <Outlet />
    </div>
  );
}
