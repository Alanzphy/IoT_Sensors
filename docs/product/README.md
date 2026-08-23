# Capa de Producto (docs/product/)

Esta carpeta es la **fuente de verdad del "por qué"**: contexto de negocio, visión, problemas que resuelve el sistema y requerimientos de alto nivel (no técnicos).

## Contenido

| Archivo | Qué responde |
|---|---|
| [`vision.md`](vision.md) | ¿Qué es el producto, para quién, por qué existe? |
| [`problem-context.md`](problem-context.md) | ¿Cuál es el problema actual y su impacto? (dolores, situación actual) |
| [`high-level-requirements.md`](high-level-requirements.md) | ¿Qué debe lograr el sistema desde el punto de vista de negocio/usuario? |
| [`solution-exploration.md`](solution-exploration.md) | ¿Qué alternativas se consideraron y por qué el enfoque actual? |

## Cómo se relaciona con el resto

```
docs/product/  (el "por qué" — negocio)
      ↓ alimenta
openspec/specs/  (el "qué" — comportamiento del sistema, requirements + scenarios)
      ↓ se implementa según
docs/  (el "cómo" — arquitectura, stack, design system, deployment, testing)
```

- **OpenSpec** especifica el comportamiento (requirements + scenarios) de cada capacidad.
- **docs/** documenta cómo está construido el sistema (referencia técnica).
- Si un cambio de producto afecta la visión o los requerimientos de alto nivel, se actualiza aquí primero; las specs y docs técnicos lo reflejan después.

> **Nota**: los campos marcados como `[TODO: completar]` son contexto real del cliente que debe rellenar el dueño del producto.