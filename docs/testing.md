# Testing del Sistema — Sensor IoT Agrícolas

Esta documentación sirve como índice central para todas las estrategias, infraestructuras y lineamientos de pruebas automáticas y manuales construidas para asegurar la confiabilidad del Producto Mínimo Viable (MVP) y sentar las bases para la Fase 2.

Dado que la arquitectura se compone de un Backend API (FastAPI) y un Frontend Desacoplado (React/Vite), las definiciones y protocolos de testing están rigurosamente separados por entorno.

---

## 1. Testing del Backend (FastAPI / Pytest)

La infraestructura de validación del servicio en el puerto 5050 está cubierta en su totalidad por **Pytest** con una base de datos in-memory (SQLite) de muy alta velocidad transaccional. Esto abarca desde validaciones de seguridad atómicas hasta flujos End-To-End HTTP simulando clientes y sensores IoT.

➡️ **Ver estructura, métodos de ejecución, coverage y fixtures detallados:**
[docs/testing_backend.md](./testing_backend.md)

---

## 2. Testing del Frontend (React / Vitest)

La aplicación de interfaz de usuario cuenta con un plan de pruebas adaptado al navegador, la validación del DOM y el control de estado reactivo mediante **Vitest**, **React Testing Library** y simulaciones asíncronas con **JSDOM**. El plan incluye también protocolos de tipado estático (TypeScript) y pruebas manuales obligatorias.

➡️ **Ver definición, configuraciones estáticas y unitarias detalladas:**
[docs/testing_frontend.md](./testing_frontend.md)

---

## Resumen del Ecosistema de QA

| Entidad    | Entorno / Framework | Cobertura / Alcance | CI/CD Ready | Comandos Ágiles |
|------------|---------------------|----------------------|-------------|-----------------|
| **Backend** | Pytest / httpx      | Pruebas de Integración (Rutas HTTP), Unitarias (Capa Servicios ORM) y Fixtures Jerárquicos. | Sí (SQLite in-memory aislada) | `uv run pytest tests/` |
| **Frontend** | Vitest / Jest-DOM   | Testing Unitario en Componentes UI/Hooks, Typescript Estático y testing E2E Funcional interactivo. | Sí | `npm run test` / `npm run typecheck` |
