# Plan y Definición de Pruebas del Frontend (SPA React)

Este documento centraliza la estrategia adoptada para validar la integridad de la interfaz de usuario en el proyecto IoT Sensores.

---

## a) Pruebas Estáticas y Manuales

Puesto que el MVP actual no incorpora todavía suites End-to-End automatizadas pesadas (e.g. Cypress, Playwright), la validación general de flujos de usuario se reparte en dos grandes enfoques directos de control de calidad:

### 1. Pruebas Estáticas (Static Testing)
Las pruebas estáticas actúan como la primera barrera defensiva mientras desarrollamos. Ocurren antes del Build.
*   **Análisis de Tipos (TypeScript):** Se añadió el comando `npm run typecheck` al proyecto, que corre el compilador TypeScript (`tsc --noEmit`). Garantiza que ninguno de los contratos contra la API y ninguna Interfaz (e.g. el Payload dinámico del Sensor o Respuestas paginadas) genere excepciones de código por falta de tipos de datos.
*   **Inspección del Compilador (Vite):** Cuando el CI ejecuta `npm run build`, Rollup inspecciona toda la paquetería detectando dependencias muertas (`tree-shaking`) o importaciones rotas y detiene el paso a producción si no compila la integridad del sistema modular.

### 2. Pruebas Manuales Funcionales (Escenarios Clave)
El Analista de Calidad (QA) o Tester deberá seguir los siguientes casos de uso manuales en la web (usando diferentes resoluciones como un Móvil en Chrome DevTools y un Monitor Desktop):

*   **ESC-01 (Autenticación):**
    *   Ingresar con `admin@sensores.com` y comprobar que aterriza en el Dashboard de Admin.
    *   Verificar que al poner contraseñas malas rebote con el Alert de Toast.
    *   Terminar con clic al botón "Cerrar sesión" destruyendo tokens locales en el storage.
*   **ESC-02 (Dashboard Cliente & Tiempo Real):**
    *   Iniciar sesión con cuenta de cliente y seleccionar un predio/área.
    *   Asegurarse de que el script remoto en Python (`simulator.py`) está inyectando lecturas y validar si la tarjeta "Humedad del Suelo" y el "Indicador de Frescura" actualizan su estatus visual (cambios de color o minutero a "Hace 0 min") **sin recargar la pantalla completa bruscamente** ni forzar un Skeleton general (Flicker-free).
*   **ESC-03 (Histórico y Filtros):**
    *   Entrar a la vista "Históricos" en un Área.
    *   Manipular manualmente el Selector de fechas (e.g. elegir "Personalizado" y recortar un margen muy pequeño de fechas).
    *   La tabla Recharts debe repintarse, y al darle al ícono "Exportar", la web debe procesar satisfactoriamente el archivo binario descargable en CSV y PDF provisto por el backend.
*   **ESC-04 (Control de Formularios Base - Admin):**
    *   Asegurarse de que intentar duplicar un correo creando un Cliente bloquea visualmente y avisa del conflicto (Error HTTP `409`).

---

## b) Definición de las Pruebas Unitarias

Las pruebas unitarias o de componentes del Front-end se enfocan en porciones atómicas de UI / State, valiéndose de **Vitest** (Motor) y **React Testing Library** (DOM virtual) simulando en JSDOM.

### 1. Elementos que CUBRE la suite Unitaria:
Las pruebas unitarias no hacen peticiones reales, operan enfocándose en el comportamiento de:
*   **Componentes Puros de Interfaz:** Tarjetas (BentoCard), Botones (PillButton), Indicadores visuales y EmptyStates. Se prueba la accesibilidad (`roles`), inserción condicional de variables CSS oscuras/claras y bloqueos de inacción (disabling en asincrónicos).
*   **Custom Hooks Locales:** Elementos que no devuelven HTML, sino estado reaccionario (`useIsMobile`, `usePageVisibility`), falseando APIs del ecosistema web como el `window.innerWidth` o los eventos del Document `visibilitychange`.

### 2. Estructura y Estándares de Definición
Un archivo de Test siempre corre pareado bajo la misma carpeta del artefacto evaluado. Se llama `<NombreArtefacto>.test.tsx/.ts`. Su Anatomía es la siguiente:
1.  **`describe()`:** Engloba todo el comportamiento de la UI (Ej. *"AlertsPopover Component"*).
2.  **Preparación (Mocks):** Se capturan eventos falsos usando `vi.fn()` para simular funciones que el navegador haría.
3.  **`render()`:** Instancia al componente metiéndolo en el JSDOM aislado (nuestra pantalla fake).
4.  **`it()`:** Define la prueba unitaria en inglés/español usando formato declarativo de lo que se espera (e.g. *"it renders the loaded children"*).
5.  **Ejecución (`act()` o `fireEvent`):** Se detonan clicks, typeados o cambios visuales interactivos simulando la mano del usuario.
6.  **`expect() / Aserciones`:** Valida que un nodo de texto exista contundentemente (`toBeInTheDocument`), tenga inyectada una clase (`toHaveClass`) o esté deshabilitado (`toBeDisabled()`).

*(Ver los archivos en `src/app/components/PillButton.test.tsx` o `src/app/hooks/usePageVisibility.test.ts` que se levantaron de prueba durante la implementación de esta base).*

### 3. Comandos Ejecutivos de Pruebas:
Todos ejecutados dentro del directorio `/frontend/`:
- `npm run test` (Validación rápida)
- `npm run test:ui` (Para ver un panel en la web con cada componente de test desgranado)
- `npm run test:coverage` (Genera mapa de porcentaje del código frontend verificado).
