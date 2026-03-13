import { createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { ClientLayout } from "./layouts/ClientLayout";
import { AdminLayout } from "./layouts/AdminLayout";

// Auth pages
import { LoginPage } from "./pages/auth/LoginPage";

// Client pages
import { ClientDashboard } from "./pages/client/ClientDashboard";
import { AreaSelector } from "./pages/client/AreaSelector";
import { HistoricalData } from "./pages/client/HistoricalData";
import { ExportData } from "./pages/client/ExportData";
import { ProfilePage } from "./pages/client/ProfilePage";
import { PropertyDetail } from "./pages/client/PropertyDetail";

// Admin pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { ClientManagement } from "./pages/admin/ClientManagement";
import { PropertyManagement } from "./pages/admin/PropertyManagement";
import { IrrigationAreaManagement } from "./pages/admin/IrrigationAreaManagement";
import { CropTypeManagement } from "./pages/admin/CropTypeManagement";
import { CropCycleManagement } from "./pages/admin/CropCycleManagement";
import { NodeManagement } from "./pages/admin/NodeManagement";
import { NodeDetail } from "./pages/admin/NodeDetail";

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
        path: "cliente",
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
            path: "historico",
            Component: HistoricalData,
          },
          { 
            path: "exportar",
            Component: ExportData,
          },
          { 
            path: "perfil",
            Component: ProfilePage,
          },
          { 
            path: "predio/:predioId",
            Component: PropertyDetail,
          },
        ],
      },
      {
        path: "admin",
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
            path: "nodos/:nodeId",
            Component: NodeDetail,
          },
        ],
      },
    ],
  },
]);