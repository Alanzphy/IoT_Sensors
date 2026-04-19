import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./layouts/AdminLayout";
import { ClientLayout } from "./layouts/ClientLayout";
import { RootLayout } from "./layouts/RootLayout";
import { loadAdminMapPage, loadClientMapPage } from "./services/routePreload";

// Auth pages
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";

// Client pages
import { ThresholdManagement } from "./pages/admin/ThresholdManagement";
import { AreaSelector } from "./pages/client/AreaSelector";
import { ClientDashboard } from "./pages/client/ClientDashboard";
import { ExportData } from "./pages/client/ExportData";
import { HistoricalData } from "./pages/client/HistoricalData";
import { NotificationPreferencesPage } from "./pages/client/NotificationPreferencesPage";
import { ProfilePage } from "./pages/client/ProfilePage";
import { PropertyDetail } from "./pages/client/PropertyDetail";
import { AlertsCenterPage } from "./pages/shared/AlertsCenterPage";

// Admin pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AuditLogsPage } from "./pages/admin/AuditLogsPage";
import { ClientManagement } from "./pages/admin/ClientManagement";
import { CropCycleManagement } from "./pages/admin/CropCycleManagement";
import { CropTypeManagement } from "./pages/admin/CropTypeManagement";
import { IrrigationAreaManagement } from "./pages/admin/IrrigationAreaManagement";
import { NodeDetail } from "./pages/admin/NodeDetail";
import { NodeManagement } from "./pages/admin/NodeManagement";
import { PropertyManagement } from "./pages/admin/PropertyManagement";

const ClientMapPage = lazy(() => loadClientMapPage().then((module) => ({ default: module.ClientMapPage })));

const AdminMapPage = lazy(() => loadAdminMapPage().then((module) => ({ default: module.AdminMapPage })));

function PageFallback() {
  return (
    <div className="min-h-[45vh] grid place-items-center text-[#6E6359] text-sm">
      Cargando vista...
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: LoginPage,
      },
      {
        path: "recuperar-contrasena",
        Component: ForgotPasswordPage,
      },
      {
        path: "restablecer-contrasena",
        Component: ResetPasswordPage,
      },
      {
        path: "cliente",
        element: <ProtectedRoute allowedRole="cliente" />,
        children: [
          {
            Component: ClientLayout,
            children: [
              {
                index: true,
                Component: ClientDashboard,
              },
              {
                path: "areas",
                Component: AreaSelector,
              },
              {
                path: "mapa",
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ClientMapPage />
                  </Suspense>
                ),
              },
              {
                path: "historico",
                Component: HistoricalData,
              },
              {
                path: "exportar",
                Component: ExportData,
              },
              {
                path: "alertas",
                Component: AlertsCenterPage,
              },
              {
                path: "notificaciones",
                Component: NotificationPreferencesPage,
              },
              {
                path: "umbrales",
                Component: ThresholdManagement,
              },
              {
                path: "perfil",
                Component: ProfilePage,
              },
              {
                path: "predio/:predioId",
                Component: PropertyDetail,
              },
            ]
          }
        ],
      },
      {
        path: "admin",
        element: <ProtectedRoute allowedRole="admin" />,
        children: [
          {
            Component: AdminLayout,
            children: [
              {
                index: true,
                Component: AdminDashboard,
              },
              {
                path: "clientes",
                Component: ClientManagement,
              },
              {
                path: "clientes/:clientId/predios",
                Component: PropertyManagement,
              },
              {
                path: "predios/:predioId/areas",
                Component: IrrigationAreaManagement,
              },
              {
                path: "cultivos",
                Component: CropTypeManagement,
              },
              {
                path: "ciclos",
                Component: CropCycleManagement,
              },
              {
                path: "nodos",
                Component: NodeManagement,
              },
              {
                path: "mapa",
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AdminMapPage />
                  </Suspense>
                ),
              },
              {
                path: "nodos/:nodeId",
                Component: NodeDetail,
              },
              {
                path: "alertas",
                Component: AlertsCenterPage,
              },
              {
                path: "umbrales",
                Component: ThresholdManagement,
              },
              {
                path: "auditoria",
                Component: AuditLogsPage,
              },
            ]
          }
        ],
      },
    ],
  },
]);
