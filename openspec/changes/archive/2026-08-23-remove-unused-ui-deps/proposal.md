# Proposal: Remove unused UI dependencies

## Problem

El frontend declara 57 dependencias pero varias son de un stack MUI/popper/slick que **nunca se importó** en `src/` (verificado con grep: 0 usos): `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@popperjs/core`, `react-popper`, `react-slick`, `react-responsive-masonry`, `react-dnd`, `react-dnd-html5-backend`. Además el chunk manual `vendor-mui` de vite quedó huérfano.

Hallazgo adicional: `npm ci` resolvió `@types/react@19` con runtime React 18.3.1 — los types v19 rompen el typecheck (el prop `key` ya no se acepta implícitamente). Fix: fijar `@types/react@^18.3` y `@types/react-dom@^18.3` como devDependencies explícitas.

## Goals

- Quitar las 10 dependencias muertas y el chunk `vendor-mui`.
- Alinear @types/react con el runtime React 18.
- typecheck + vitest + build en verde.

## Non-goals

- No tocar el stack activo (shadcn/Radix + Tailwind v4).
- No añadir ESLint/Prettier.

## How

1. Eliminar deps muertas de `package.json`; `npm ci` para regenerar lock.
2. `vite.config.ts`: quitar el bloque `vendor-mui`.
3. Añadir `@types/react@^18.3.0` y `@types/react-dom@^18.3.0` a devDependencies.
4. Verificar pipeline completo.

## Impact

57 → 47 dependencias; build más liviano; types alineados con el runtime.