# Flujos de Información del Frontend (React App)

Este documento describe formalmente las secuencias funcionales comprobadas y los flujos de navegación (UX/UI y rutas) dentro de la aplicación Frontend, tanto para el rol de **Administrador** como para el **Cliente (Usuario Final)**, basándose en la configuración actual del `react-router` y el manejador de estado de autenticación.

---

## 1. Flujo Base (Común a Todos los Usuarios)

### 1.1 Autenticación y Desvío por Roles
1.  **Directiva inicial (`/`)**: Cualquier petición no autenticada al sistema redirige o aterriza por defecto en la página de **Login**.
2.  **Validación de Credenciales**: El usuario ingresa su correo electrónico y contraseña. Esta información viaja por medio de `axios` (vía nuestro hook o servicio) al endpoint correspondiente en FastAPI.
3.  **Procesamiento del Token**: 
    - El Backend retorna un token JWT que el frontend aloja en el `Contexto Global de React (AuthContext)` y paralelamente en el `localStorage`.
    - `jwt-decode` lee el payload del token y extrae el rol específico (`rol: "admin"` o `rol: "cliente"`).
4.  **Routing Inteligente**: El componente `<ProtectedRoute>` realiza un chequeo del estado del Context. Según el rol:
    - **Si es Cliente**, se redirige a `Layout: ClientLayout` -> Rutas bajo el subdirectorio `/cliente`.
    - **Si es Admin**, se redirige a `Layout: AdminLayout` -> Rutas bajo el subdirectorio `/admin`.

---

## 2. Flujo de Secuencia: Rol de "Cliente"

El *Cliente* es el consumidor de la información. El sistema está diseñado en forma de **jerarquía (Predio -> Área)** para facilitarle al agricultor la visualización rápida de sus sensores y terrenos, limitando el acceso a modificar valores de sistema.

### 2.1 Vista Principal (Dashboard Global)
- **URL**: `/cliente` (Pantalla de inicio al logearse)
- **Componente**: `ClientDashboard`
- El cliente inicia en un dashboard general que resume la información de los **datos prioritarios** (Humedad, Flujo, E.T.O) proveniente de todas sus áreas registradas. Aparece el "Indicador de frescura" evidenciando cuándo fue la última vez que un nodo se reportó.

### 2.2 Navegación Jerárquica y Profundización de Datos
El cliente puede hacer _drill-down_ (bajar de nivel) para examinar en detalle la información:
1.  **Navegación al Predio (`/cliente/predio/:predioId`)**: 
    - Al seleccionar un predio específico, se activa el `PropertyDetail`. Esto filtra el contexto, reduciendo el enfoque solo a aquellas parcelas o unidades que pertenecen a esa finca.
2.  **Selector de Área de Riego (`/cliente/areas`)**: 
    - Aquí, el agricultor escoge un Área de Riego específica validando qué cultivo tiene (ej. Alfalfa o Nogal). Como el sistema sigue una relación 1:1, entrar aquí equivale a "mirar los sensores de este Nodo IoT en cuestión".

### 2.3 Exploración de Datos Profundos (Histórico y Exportación)
- **Histórico (`/cliente/historico`)**: 
    - Una vez en el contexto de un área determinada, el usuario accede a `HistoricalData`.
    - En esta vista hay filtros integrados de rangos de fechas (inicio/fin) resolviendo presets desde el lado del cliente y pidiendo al Backend.
    - Los gráficos cargan la serie de las 3 categorías descritas para el payload: **Suelo** (Humedad, Temperatura, etc.), **Riego** y **Ambiental**.
- **Exportar Reportes (`/cliente/exportar`)**: 
    - Conectado a la vista de los historiales, `ExportData` manda el query con los filtros actuales al Backend para generar documentos (CSV, Excel o PDF).

### 2.4 Administración de Perfil
- **URL**: `/cliente/perfil`
- El cliente tiene gestión exclusiva de su propio perfil/cuenta estática.

---

## 3. Flujo de Secuencia: Rol de "Administrador"

El *Administrador* cuenta con una responsabilidad de supervisión global de cualquier cliente y la gestión y configuración técnica de la jerarquía agrícola.

### 3.1 Vista Inicial (Supervisión)
- **URL**: `/admin`
- **Componente**: `AdminDashboard`
- Al iniciar, cuenta con una vista global de operación. Dado que tiene acceso total sin restricciones RLS, puede verificar el funcionamiento del flujo de lectura de sensores saltando a visualizar cómo lo verían diversos clientes o inspeccionando los datos fríos de uso total de sistema.

### 3.2 Gestión de Clientes y Predios
1.  **Listado General (`/admin/clientes`)**: Ingresa al CRUD para registrar un nuevo "Cliente final".
2.  **Vinculación del Territorio (`/admin/clientes/:clientId/predios`)**: Al entrar en los detalles de un usuario cliente, el admin es responsable de definir cuántos y cuáles predios posee esta cuenta.

### 3.3 Gestión de la Jerarquía Agrícola
- **Gestión de Áreas y Cultivos (`/admin/predios/:predioId/areas`)**: El administrador selecciona un predio, crea una "Área de Riego" y debe **asignarle un cultivo**.
- **Catálogo Base (`/admin/cultivos`)**: Previamente el Admin debió haber ingresado a esta ruta para el alta en el catálogo global de cultivos (Maíz, Nogal, Algodón, etc.).
- **Temporadas o Ciclos (`/admin/ciclos`)**: Control histórico. El admin dictamina la "fecha de inicio / fecha de fin" de cada temporada bajo la cual se agruparán estadísticamente todas las lecturas de los sensores en el tiempo.

### 3.4 Configuración del Hardware a Plataforma (Nodos IoT)
- **Registro Global de Hardware (`/admin/nodos`)**: Se da de alta un "hardware" nuevo. Aquí el administrador configura de manera estática los datos de ubicación GPS (latitud / longitud).
- **Detalle y Vinculación (`/admin/nodos/:nodeId`)**: En el detalle de ese nodo, el administrador se asegura de "amarrar" el harware a un **Área de Riego** (relacionándolos en la base de datos MySQL 1:1). Con este paso crucial terminado, los posts del Simulador (en el puerto API de Python), son canalizados jerárquicamente a los Predios y Clientes correctos para ser visualizados en el dashboard (`Flujo 2.1`).
