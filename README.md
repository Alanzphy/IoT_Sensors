# Sistema IoT de Riego Agrícola

Sistema web para el monitoreo de sensores de riego agrícola. Recibe lecturas de nodos IoT cada 10 minutos y las presenta en un dashboard multicategoría con históricos, filtros y exportación.

## Estructura del Proyecto

```
sensorestest/
├── AGENTS.md                # Contexto principal para agentes IA
├── README.md
├── .gitignore
│
├── docs/                    # Documentación del proyecto
│   ├── arquitectura.md          # Diagramas de arquitectura (MVP + Fase 2)
│   ├── design_system.md         # Paleta, tipografía, tokens del frontend
│   ├── documentacion_api.md     # Guía de la API REST
│   ├── documentacion_base_de_datos.md  # Modelo de datos explicado
│   ├── openapi.yaml             # Spec OpenAPI 3.1 (importable en Swagger/Postman)
│   └── srs/
│       └── Especificación de Requisitos de Software_SRS-v2.md
│
├── .agent/                  # Contexto para agentes IA (prompts, seeds, diagramas)
│   ├── agente_base_de_datos.md  # DDL, SQL seeds, queries de referencia
│   ├── agente_caso_de_uso.md    # Diagrama de casos de uso
│   └── agente_diagramas.md      # Diagramas de actividad
│
├── backend/                 # FastAPI + Uvicorn (Python 3.11+)
│   ├── pyproject.toml
│   ├── main.py                  # Placeholder — por implementar
│   └── .python-version
│
├── frontend/                # React SPA — por implementar
│
├── assets/
│   └── imgs/                    # Logo y recursos gráficos
│       ├── logo.svg
│       ├── logo.png
│       └── logo_compress.png
│
└── others/                  # Borradores y prompts auxiliares
    └── figma_prompts.md
```

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11+ / FastAPI / Uvicorn |
| Frontend | React (SPA) |
| Base de Datos | MySQL 8 / SQLAlchemy / Alembic |
| Reverse Proxy | Nginx |
| Contenedores | Docker + Docker Compose |
| Servidor | VPS Linux ("Servidor Grogu") |

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [`docs/arquitectura.md`](docs/arquitectura.md) | Diagramas de infraestructura, flujos de datos, autenticación |
| [`docs/documentacion_api.md`](docs/documentacion_api.md) | Guía completa de la API REST |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Spec técnico OpenAPI 3.1 |
| [`docs/documentacion_base_de_datos.md`](docs/documentacion_base_de_datos.md) | Modelo de datos, tablas, relaciones |
| [`docs/design_system.md`](docs/design_system.md) | Design system del frontend |
| [`docs/srs/`](docs/srs/) | Especificación de Requisitos de Software |