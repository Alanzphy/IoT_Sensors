# Reporte Ejecutivo de Calidad y Flujos de Sistema (Fase 1)

Este documento certifica la validación de calidad y el funcionamiento íntegro de los flujos de información del sistema de Monitoreo de Sensores IoT Agrícolas (Fase MVP), presentado fundamentalmente para revisión de stakeholders e interesados técnicos y operativos. Abarca la cobertura total tanto del **Cerebro del Sistema (Backend)** como de la **Interfaz de Usuario (Frontend)**.

---

## A. Pruebas Estáticas y Manuales (Prevención de Errores)

Para garantizar que el sistema no presente fallas antes de llegar a producción, implementamos barreras de calidad estrictas en ambas capas:

### 1. En el Servidor (Backend API)
- **Estáticas (Validación Estricta de Datos):** La API (FastAPI) utiliza un filtro implacable (Pydantic) que asegura que si un sensor envía texto en lugar de números para la `Humedad`, o falta la `X-API-Key`, el sistema rechaza la carga automáticamente sin crashear.
- **Manuales (Panel Swagger UI):** Contamos con una consola interactiva de documentación técnica (`/docs`) donde el usuario administrador o un tester QA puede ejecutar peticiones manualmente (simular inicios de sesión, consultar listas de predios, inyectar lecturas) y ver las respuestas crudas en tiempo real.
* **Evidencia sugerida:**
> `[INSERTAR IMAGEN: Captura de pantalla de la interfaz interactiva "Swagger UI" (http://localhost:5050/docs) autorizando un token manualmente]`

### 2. En la Plataforma Web (Frontend)
- **Estáticas:** Análisis de compilación y tipado estricto (TypeScript) que verifica matemáticamente la integridad del código fuente antes de encender la interfaz.
- **Manuales:** Protocolo humano de QA validando responsividad móvil/escritorio, accesos de administrador vs. cliente, y la experiencia de usuario (UX) previniendo parpadeos de carga.

---

## B. Definición de las Pruebas Unitarias y de Integración (La Red de Seguridad)

Las pruebas automáticas ("robots evaluadores") revisan el código pieza por pieza en fragmentos de milisegundos.

### 1. El Motor de Servidor y Reglas de Negocio (Backend)
Contamos con una batería robusta de **más de 280 pruebas automáticas en Python (Pytest)** que se ejecutan en aproximadamente ~1 minuto. Todas evalúan el sistema en una base de datos temporal asilada (RAM) sin destruir los datos reales:
- **Unitarias (Lógica de Negocio):** Verifican en aislamiento total reglas estrictas como: *No permitir dos ciclos de cultivo activos al mismo tiempo*, asegurar que las contraseñas se encripten (bcrypt) irreversiblemente, y verificar el ciclo de vida seguro de los tokens JWT de sesión.
- **De Integración (API y Red):** 13 módulos completos que simulan a un cliente real HTTP llamando a las rutas de red. Evalúan escenarios complejos como: Iniciar sesión -> Recibir un Token -> Intentar crear un predio (o ser rechazado si no se tienen permisos) -> Guardar una lectura de sensor.

### 2. La Interfaz Visual (Frontend)
Componentes unitarios construidos con React Testing Library y Vitest. Evaluamos visualmente los botones, gráficas y "pantallas vacías" en un navegador virtual invisible, garantizando que un clic erróneo nunca rompa la paǵina.

* **Evidencia sugerida:**
> `[INSERTAR IMAGEN: Captura de pantalla de la terminal mostrando en letras verdes masivas "282 passed in 73.30s" ejecutando el comando de Pytest]`

---

## C. Secuencias de Flujo de Información Completadas

Certificamos que el "Viaje del Dato" desde el campo agrícola (simulado) hasta los ojos del cliente final está 100% operativo a través de pruebas End-to-End:

### Secuencia 1: Ingesta de Datos del Sensor (IoT → Backend Servidor)
1. El **Simulador de Nodo IoT** mide las 3 categorías dinámicas (Conductividad, Flujo de agua, etc.).
2. Pasa por el sistema de autenticación de Servidor con una credencial fija `X-API-Key`.
3. El **Gestor Central Backend** valida el formato, asocia la lectura automáticamente con el Predio/Cliente dueño de ese sensor, y resguarda el histórico en la base MySQL inyectando una marca de tiempo exacta.

### Secuencia 2: Intercambio Seguro y Visualización (Backend → Frontend Cliente)
1. El **Cliente** entra a la plataforma y proporciona su email/contraseña. El Backend le emite sus sellos JWT de acceso.
2. Al seleccionar "Área de Nogales", la Plataforma solicita los promedios al Backend.
3. El **Gestor Central** recupera la telemetría histórica del área asegurando que el rol coincida (protegiendo la privacidad de datos de otros ranchos).
4. El **Dashboard (React)** gráfica las fluctuaciones históricas y actualiza en tiempo real el "Indicador de Frescura" y la lectura más reciente en pantalla.

> 📚 **Anexo de Arquitecutra y Flujos:** Para consultar el detalle exhaustivo de cómo operan en la realidad los datos en ambas partes de este sistema, preparamos dos mapas de flujos narrativos:
> - 🖥️ [Documentación de Flujos del Web (Frontend)](./flujos_frontend.md) (Pantallas, Mapas, Roles)
> - ⚙️ [Documentación de Flujos de Servidor (Backend)](./flujos_backend.md) (Ingesta IoT, Seguridad JWT, Exportaciones)

* **Evidencia sugerida (El entregable de mayor impacto):**
> `[INSERTAR ENLACE A VIDEO: Grabar la pantalla dividida. De un lado el script de Python Terminal enviando datos cada 10s al Backend (mostrando "HTTP 201 Created"). Del otro lado, el navegador con el dashboard del cliente. Se debe observar cómo al caer el registro en el servidor, los widgets web de Humedad y Evapotranspiración se re-ajustan instantáneamente.]`
