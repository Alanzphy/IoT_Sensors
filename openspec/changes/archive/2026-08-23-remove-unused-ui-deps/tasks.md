# Tasks

- [x] Eliminar de `package.json`: @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, @popperjs/core, react-popper, react-slick, react-responsive-masonry, react-dnd, react-dnd-html5-backend.
- [x] `vite.config.ts`: quitar chunk `vendor-mui`.
- [x] devDependencies: `@types/react@^18.3.0`, `@types/react-dom@^18.3.0` (runtime React 18; los types v19 rompen `key` en JSX).
- [x] `npm ci` + `npm run typecheck` + `npm run test -- --run` + `npm run build` en verde.