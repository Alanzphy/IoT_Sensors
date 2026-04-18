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
│   ├── notifications/ # Alertas en UI (AlertsPopover)
│   └── ProtectedRoute.tsx # HOC para blindar rutas según el Rol y JWT.
├── context/          # React Context API para estado global (AuthContext)
├── data/             # (Deprecado/Migración) Datos estáticos 'mockData'. Se eliminarán.
├── hooks/            # Custom hooks (e.g., useIsMobile.ts, useAuth.ts)
├── layouts/          # Envoltorios de interfaz (RootLayout, AdminLayout, ClientLayout)
├── pages/            # Vistas enrutadas
│   ├── admin/        # CRUD para el admin (Clientes, Predios, Nodos, Cultivos, etc.)
│   ├── auth/         # Autenticación y recuperación (Login/Forgot/Reset)
│   └── client/       # Dashboards y datos de agricultores (ClientDashboard, Histórico, etc.)
│   └── shared/       # Pantallas compartidas entre roles (AlertsCenterPage)
├── services/         # Integración y llamadas HTTP (api.ts para base axios)
├── App.tsx           # Entry point general integrando el AuthProvider y RouterProvider
└── routes.tsx        # Definición del árbol de rutas y protección
```

---

## 3. Estado de la Integración (Mock -> API Base de Datos)
Actualmente el frontend está en fase de **transición de datos estáticos hacia consumo real del backend FastAPI**, con parte de Fase 2 Lite activa.

- **Fase 1 (Completada)**: Autenticación. `LoginPage` conecta a `/api/v1/auth/login`. El JWT se decodifica con `jwt-decode`, se guarda en `localStorage` y se gestiona mediante `AuthContext`. El `api.ts` de Axios inyecta automáticamente el header `Authorization: Bearer <token>` y maneja las redirecciones por `401 Unauthorized`.
- **Fase 2 Lite (Implementada)**: Centro de alertas y popover conectados a `/api/v1/alerts`, bitácora administrativa en `/api/v1/audit-logs`, gestión Admin de umbrales, preferencias de notificación del cliente y flujo de recuperación de contraseña (`/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`).
- **Fase 3 (En proceso)**: Reemplazo gradual de `mockData` en dashboard/histórico por datos reales (`/api/v1/readings`, `/api/v1/readings/latest`, `/api/v1/readings/availability`).
- **Fase 4 (Parcial)**: Semáforos de estado para datos prioritarios en dashboard cliente usando alertas de umbral activas.

### 3.1 Módulo de Alertas en UI (Activo)

- `components/notifications/AlertsPopover.tsx`: campana global con contador y últimas alertas.
- `pages/shared/AlertsCenterPage.tsx`: listado completo con filtros, paginación y marcado de leídas.
- `services/alerts.ts`: cliente HTTP para `/api/v1/alerts` y `/api/v1/alerts/{id}/read`.
- Integración en layouts de Admin y Cliente para visibilidad transversal.

### 3.2 Módulo de Auditoría en UI (Activo - Admin)

- `pages/admin/AuditLogsPage.tsx`: listado con filtros, paginación y detalle por evento.
- `services/auditLogs.ts`: cliente HTTP para `/api/v1/audit-logs` y `/api/v1/audit-logs/{id}`.
- Ruta protegida: `/admin/auditoria`.

### 3.3 Módulo de Umbrales en UI (Activo - Admin)

- `pages/admin/ThresholdManagement.tsx`: CRUD de umbrales por área/parámetro/severidad.
- `services/thresholds.ts`: cliente HTTP para `/api/v1/thresholds`.
- Ruta protegida: `/admin/umbrales`.

### 3.4 Semáforos de Prioridad en Dashboard Cliente (Activo)

- `pages/client/ClientDashboard.tsx`: indicadores visuales (Optimo, Riesgo, Critico) para:
	- `soil.humidity`
	- `irrigation.flow_per_minute`
	- `environmental.eto`
- El estado se deriva de alertas de tipo `threshold` no leídas del área seleccionada.

### 3.5 Preferencias de Notificación en Cliente (Activo)

- `pages/client/NotificationPreferencesPage.tsx`: configuración por área/tipo/severidad/canal y switch global.
- `services/notificationPreferences.ts`: cliente HTTP para:
	- `/api/v1/clients/me/notification-settings`
	- `/api/v1/notification-preferences`
	- `/api/v1/notification-preferences/bulk`
- Ruta protegida: `/cliente/notificaciones`.

### 3.6 Recuperación de Contraseña (Activo)

- `pages/auth/ForgotPasswordPage.tsx`: formulario público para solicitar enlace por correo.
- `pages/auth/ResetPasswordPage.tsx`: formulario público para restablecer contraseña con token.
- Integración con backend en:
	- `/api/v1/auth/forgot-password`
	- `/api/v1/auth/reset-password`
- Rutas públicas:
	- `/recuperar-contrasena`
	- `/restablecer-contrasena?token=...`

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
