# Práctica de Endpoints — Guía

## ¿Qué vamos a hacer?

Crear endpoints (URLs de una API) con Python.
Son **2 archivos**, ambos en la carpeta `practica/`:

| Archivo | ¿Qué es? |
|---------|----------|
| `practica_ejercicios.py` | **Tu archivo** — aquí escribes código |
| `practica_ejemplo.py` | Las respuestas (¡no lo veas antes de intentar!) |

---

## Paso 1: Abrir el Codespace

1. Ve al repositorio en GitHub
2. Click en el botón verde **`<> Code`**
3. Pestaña **Codespaces** → **New with options...**
4. En "Dev container configuration" selecciona **"Práctica Endpoints"**
5. Click **Create codespace**

Espera ~2 min. Cuando termine, MySQL y los datos de prueba ya están listos.

---

## Paso 2: Correr el servidor

Abre la terminal dentro del Codespace y corre:

```bash
cd practica
uvicorn practica_ejercicios:app --reload --port 8001
```

VS Code te mostrará un popup para abrir el puerto 8001 — dale click.
Eso abre **Swagger** en tu navegador donde puedes probar tus endpoints.

---

## Paso 3: Hacer los ejercicios

1. Abre `practica_ejercicios.py` en el editor
2. Busca los `# TODO` — hay 10 endpoints por completar
3. Cada endpoint tiene comentarios paso a paso
4. Guarda el archivo y el servidor se recarga solo (por el `--reload`)
5. Prueba cada endpoint en /docs (Swagger)

### ¿Te atoras?

Mira `practica_ejemplo.py` — tiene las **respuestas** con las mismas tablas.

```bash
uvicorn practica_ejemplo:app --reload --port 8000
```
