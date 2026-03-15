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
Este usuario ya tiene asignado el predio "Rancho Norte" y el área "Nogal Norte" con un nodo activo recibiendo datos.
- **Login:** `cliente@sensores.com`
- **Password:** `cliente123`

**2. Juan López**
Usuario cliente inicial, actualmente sin predios asignados. El dashboard aparecerá vacío hasta que el Admin le asigne un predio.
- **Login:** `jlopez@test.com`
- **Password:** `admin123`

---

## 📡 Nodos IoT y API Keys

Estas API Keys se utilizan para enviar datos desde el simulador haciéndose pasar por los sensores físicos.

| ID | Nombre Nodo | Área Asignada (Predio) | API Key |
|----|-------------|------------------------|---------|
| 1 | Nodo Prueba E2E | Área 2 | `ak_b2727bc1d95e342932612ee5573fdb18` |
| 2 | Nodo Nogal Norte | Nogal Norte (Rancho Norte) | `99189486-8181-4e8c-8c6d-b3da66e6712b` |
| 3 | Nodo Alfalfa Este | Alfalfa Este | `c1f5cd79-e760-4a9f-92ea-31ea685a3add` |
| 4 | Nodo Chile Principal | Chile Principal | `02b21674-0099-4470-a8dd-b4ebd7d8c2b0` |

> **Nota para el Simulador:** Puedes usar cualquiera de estas keys, pero te sugerimos la del **Nodo Nogal Norte** (`99189486-8181-4e8c-8c6d-b3da66e6712b`), ya que este nodo pertenece al cliente `cliente@sensores.com` y podrás ver los datos fluyendo en vivo en su dashboard de prueba.
