# Design System: Agroindustrial Orgánico (Variante Bento Box)

## 1. Filosofía de Diseño
**Estética terrosa, elegante y orgánica.** Emplea un layout estilo **"Bento Box"** (cuadrículas asimétricas) con formas extremadamente suaves y redondeadas. El diseño busca un alto contraste entre bloques de color sólido, priorizando una combinación tipográfica clásica-moderna, alejándose de las interfaces SCADA industriales tradicionales para ofrecer una experiencia más artesanal y premium.

---

## 2. Paleta de Colores (Design Tokens)

### Fondos y Superficies
| Token | Valor Hex | Descripción |
| :--- | :--- | :--- |
| `--color-bg-base` | `#F4F1EB` | Crema suave. Fondo global de la aplicación. |
| `--color-card-light` | `#F9F8F4` | Hueso claro. Tarjetas con gráficos o listas. |
| `--color-card-sand` | `#E2D4B7` | Arena cálido. Tarjetas de métricas y contenedores de iconos. |
| `--color-card-dark` | `#3B312B` | Marrón café. Tarjetas de contraste y datos críticos. |
| `--color-card-brown` | `#705541` | Marrón medio. Tarjetas secundarias oscuras. |

### Acentos y Acciones
| Token | Valor Hex | Descripción |
| :--- | :--- | :--- |
| `--color-accent-green` | `#6D7E5E` | Verde olivo. Botones primarios y progreso principal. |
| `--color-accent-brown` | `#A68A61` | Marrón dorado. Barras de progreso secundarias. |

### Tipografía y Contraste
| Token | Valor Hex | Descripción |
| :--- | :--- | :--- |
| `--color-text-main` | `#2C2621` | Marrón casi negro. Texto sobre fondos claros. |
| `--color-text-muted` | `#6E6359` | Marrón grisáceo. Subtítulos sobre fondos claros. |
| `--color-text-inverted` | `#F4F1EB` | Crema. Texto principal sobre fondos oscuros. |

---

## 3. Tipografía

* **Primaria (Serif):** *Playfair Display*, *Merriweather* o *Lora*.
    * **Uso:** Encabezados (H1, H2), Títulos de tarjetas grandes.
    * **Pesos:** 400 (Regular) o 500 (Medium).
* **Secundaria (Sans-Serif):** *Inter*, *DM Sans* o *Montserrat*.
    * **Uso:** Valores numéricos (ej. 22.60%), cuerpo de texto, botones y etiquetas.
    * **Pesos:** 400 a 600.

---

## 4. Espaciado y Layout (Grid)

* **Bento Grid:** Utilizar CSS Grid.
* **Gap:** El espacio estándar entre tarjetas debe ser de `1.5rem` (24px) o `gap-6` en Tailwind.
* **Paddings:** Las tarjetas estándar deben tener un padding interno generoso de `1.5rem` o `2rem` (`p-6` o `p-8` en Tailwind).

---

## 5. UI y Geometría

### Radios de Borde (Border Radius)
* **Tarjetas (Cards):** `32px` (`rounded-[32px]` o `rounded-4xl`).
* **Contenedores de Íconos:** `24px` (`rounded-3xl`).
* **Botones (Pill):** `9999px` (`rounded-full`).

### Sombras y Detalles
* **Sombras (Shadows):** EVITAR sombras fuertes. Usar máximo una sombra difusa e imperceptible: `0 4px 20px rgba(44, 38, 33, 0.02)`. El diseño es mayormente *flat*.
* **Barras de Progreso:** Altura de `8px` (`h-2`), bordes totalmente redondeados (`rounded-full`). Fondo de la pista: Gris claro `#E6E1D8`.

### Estados Interactivos (Hover)
* **Botones Primarios:** Reducir opacidad al 90% (`hover:opacity-90`). Evitar cambios bruscos de color.
* **Botones Secundarios/Iconos:** Fondo sutil translúcido oscuro (`hover:bg-black/5`).

---

## 6. Configuración de Tailwind CSS

Copia y añade esta extensión a tu archivo `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        agro: {
          bg: '#F4F1EB',
          'card-light': '#F9F8F4',
          'card-sand': '#E2D4B7',
          'card-dark': '#3B312B',
          'card-brown': '#705541',
          'accent-green': '#6D7E5E',
          'accent-brown': '#A68A61',
          'text-main': '#2C2621',
          'text-muted': '#6E6359',
          'text-inverted': '#F4F1EB',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem', // 24px
        '4xl': '2rem',   // 32px para las cards
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(44, 38, 33, 0.02)',
      }
    }
  }
}
