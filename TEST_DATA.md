# Datos de Prueba (MVP)

A continuación se listan las credenciales y datos insertados actualmente en la base de datos para realizar pruebas del sistema.

## 👥 Usuarios

### Administrador
Tiene acceso a todas las pantallas, configuraciones de nodos, clientes, predios y catálogos.
- **Login:** `admin@sensores.com`
- **Password:** `admin123`

### Clientes (Usuarios Finales)
Tienen acceso únicamente a ver sus propios predios, áreas de riego y dashboards.

**1. Juan Perez (Recomendado para pruebas)**
Este usuario tiene estructuras demo y productivas del socio formador.
- **Login:** `alan2203mx@gmail.com`
- **Password:** `123`

**2. Juan López**
Usuario cliente inicial, actualmente sin predios asignados. El dashboard aparecerá vacío hasta que el Admin le asigne un predio.
- **Login:** `jlopez@test.com`
- **Password:** `admin123`

---

## 📡 Nodos IoT y API Keys

Estas API Keys se utilizan para enviar datos desde el simulador haciéndose pasar por los sensores físicos.

### Productivo socio (sin fallback)

| Nombre Nodo | Área Asignada (Predio) | API Key |
|-------------|------------------------|---------|
| Nodo Granja Hogar | Area Granja Hogar (Granja Hogar) | `ak_partner_granja_hogar_001` |
| Nodo Campus Reforestado | Area Campus Reforestado (Campus Reforestado) | `ak_partner_campus_reforestado_001` |

### Demo legado (marcado con prefijo `DEMO -`)

| Nombre Nodo | Área Asignada (Predio) | API Key |
|-------------|------------------------|---------|
| Nodo DEMO - Prueba E2E | DEMO - Área 2 (DEMO - Rancho Norte) | `ak_b2727bc1d95e342932612ee5573fdb18` |
| Nodo DEMO - Nogal Norte | DEMO - Nogal Norte (DEMO - Rancho Norte) | `99189486-8181-4e8c-8c6d-b3da66e6712b` |
| Nodo DEMO - Alfalfa Este | DEMO - Alfalfa Este (DEMO - Rancho Norte) | `c1f5cd79-e760-4a9f-92ea-31ea685a3add` |
| Nodo DEMO - Chile Principal | DEMO - Chile Principal (DEMO - Rancho Norte) | `02b21674-0099-4470-a8dd-b4ebd7d8c2b0` |

> **Nota para el simulador:** Para demo ejecutiva del socio, usa primero las API keys productivas (`ak_partner_*`).  
> Si quieres estrés multi-nodo y alertas históricas, usa también las keys demo.
