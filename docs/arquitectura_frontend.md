# Arquitectura del Frontend (Sensores IoT)
**Documento de Contexto para Agentes de IA y Desarrolladores**

Este documento describe la arquitectura, stack tecnológico, estado actual y reglas de desarrollo para el frontend de la plataforma IoT de Monitoreo de Sensores Agrícolas.

---

## 1. Stack Tecnológico General
- **Framework Core**: React (v18+) configurado con Vite.
- **Lenguaje**: TypeScript (Strict mode).
- **Rutas**: `react-router` (v7). Declarado estáticamente en `routes.tsx` con componentes `Layout` anidados.
- **Estilos**: Tailwind CSS combinado con variables o valores hexadecimales estáticos derivados del *Design System Bento Box* pre-aprobado.
- **Cliente HTTP**: `axios` (v1.x) con interceptores para JWT.
- **Iconografía**: `lucide-react`.
- **Gráficos**: `recharts` (para visualización de series de tiempo).

---

## 2. Estructura del Proyecto (`/frontend/src/app`)
La arquitectura está basada en dominios funcionales (Feature-driven / Role-based):

```text
src/app/
├── components/       # Componentes reusables de UI (Botones, Tarjetas, Input, etc.)
│   ├── navigation/   # Menús (DesktopSidebar.tsx, MobileTabBar.tsx)
│   └── ProtectedRoute.tsx # HOC para blindar rutas según el Rol y JWT.
├── context/          # React Context API para estado global (AuthContext)
├── data/             # (Deprecado/Migración) Datos estáticos 'mockData'. Se eliminarán.
├── hooks/            # Custom hooks (e.g., useIsMobile.ts, useAuth.ts)
├── layouts/          # Envoltorios de interfaz (RootLayout, AdminLayout, ClientLayout)
├── pages/            # Vistas enrutadas
│   ├── admin/        # CRUD para el admin (Clientes, Predios, Nodos, Cultivos, etc.)
│   ├── auth/         # Autenticación (LoginPage)
│   └── client/       # Dashboards y datos de agricultores (ClientDashboard, Histórico, etc.)
├── services/         # Integración y llamadas HTTP (api.ts para base axios)
├── App.tsx           # Entry point general integrando el AuthProvider y RouterProvider
└── routes.tsx        # Definición del árbol de rutas y protección
```

---

## 3. Estado de la Integración (Mock -> API Base de Datos)
Actualmente el frontend está en fase de **transición de datos estáticos hacia consumo real del backend FastAPI**.

- **Fase 1 (Completada)**: Autenticación. `LoginPage` conecta a `/api/v1/auth/login`. El JWT se decodifica con `jwt-decode`, se guarda en `localStorage` y se gestiona mediante `AuthContext`. El `api.ts` de Axios inyecta automáticamente el header `Authorization: Bearer <token>` y maneja las redirecciones por `401 Unauthorized`.
- **Fase 2 (Pendiente - En proceso)**: Reemplazar variables simuladas del Dashboard (`mockData.ts`) obteniendo los datos reales de `/api/v1/readings/latest`.
- **Fase 3 (Pendiente)**: Históricos y gráficos consumiendo el API tabulado y exportación nativa de archivos.
- **Fase 4 (Pendiente)**: Dashboards de Administrador (CRUD de Catálogos).

---

## 4. Diseño y UI (UI Guidelines)
El sistema usa un "Design System" estricto tipo *Bento Box* orgánico:
- **Colores Principales**: Crema Base (`#F4F1EB`), Hueso (`#F9F8F4`), Arena (`#E2D4B7`), Marrón oscuro (`#3B312B`), Verde Sage (`#6D7E5E`).
- **Formas**: Bordes muy redondeados (`rounded-[24px]` o `rounded-[32px]`).
- **Responsive**: Se sigue estrategia Mobile-First. En Móvil, la navegación ocurre abajo (Bottom-Bar: `MobileTabBar`); en Desktop, es lateral (`DesktopSidebar`). Se intercambian respondiendo a `useIsMobile()`.

---

## 5. Reglas Inquebrantables para el AI (Agent Directives)

1. **Gestión de Estado**: Usa `React Context` y Custom Hooks para estado transversal. NO intentes introducir Redux o Zustand a menos que el usuario lo exija explícitamente.
2. **Peticiones HTTP**: Jamás uses `fetch()`. Usa siempre la instancia preconfigurada de `axios` ubicada en `src/app/services/api.ts` importándola como `api`.
3. **Manejo de Rutas**: Toda validación de acceso de usuarios debe basarse en el rol provisto por el JWT (`admin` o `cliente`) procesado a través de `<ProtectedRoute allowedRole="..." />`.
4. **Respetar Modelo de Base de Datos**: El backend envía los datos de las lecturas en estructura "Wide-Table". En el dashboard, referirse a campos aplastados como `suelo_humedad`, `riego_activo`, `ambiental_eto` (tal como lo define la respuesta en Pydantic `ReadingResponse`).
5. **UI no destructiva**: Al actualizar un componente de `mockData` a API, no destruyas la estructura CSS Tailwind original del layout y estilo. Solo reemplaza de dónde provienen las variables/arrays y agrega control de estados de carga (`isLoading`) y error.
6. **URLs relativas**: Las peticiones desde axios al backend deben hacerse relativas, ej. `api.get("/readings/latest?irrigation_area_id=xx")`, ya que el `baseURL` en config ya tiene `http://localhost:5050/api/v1`.
