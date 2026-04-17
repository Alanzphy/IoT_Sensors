# Instrucciones Paso a Paso — Actualizar Coordenadas de un Nodo (Docker)




## 1) Verificar contenedores

Desde la raiz del proyecto:

    docker compose ps

Si no estan arriba:

    docker compose up -d --build

## 2) (Opcional) Probar login admin

Este comando debe devolver access_token y refresh_token:

    curl -X POST "http://localhost:5050/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@sensores.com","password":"admin123"}'

## 3) (Opcional) Ver lista de nodos (token dinamico)

    curl "http://localhost:5050/api/v1/nodes?per_page=200" \
      -H "Authorization: Bearer $(curl -s -X POST http://localhost:5050/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@sensores.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")"

## 4) Actualizar coordenadas de Nogal Norte (nodo 2, token dinamico)

Copiar y pegar exactamente este comando:

    curl -X PUT "http://localhost:5050/api/v1/nodes/2" \
      -H "Authorization: Bearer $(curl -s -X POST http://localhost:5050/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@sensores.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")" \
      -H "Content-Type: application/json" \
      -d '{"latitude":28.6329000,"longitude":-106.0691000}'

Si necesitas otras coordenadas, cambia solo estos 2 valores:

    "latitude":28.6329000
    "longitude":-106.0691000

## 5) Verificar cambio guardado (token dinamico)

    curl "http://localhost:5050/api/v1/nodes/2" \
      -H "Authorization: Bearer $(curl -s -X POST http://localhost:5050/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@sensores.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")"

En la respuesta deben aparecer latitude y longitude con los nuevos valores.

## 6) Consulta opcional con cliente de Nogal Norte (token dinamico)

    curl "http://localhost:5050/api/v1/nodes?per_page=200" \
      -H "Authorization: Bearer $(curl -s -X POST http://localhost:5050/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"cliente@sensores.com","password":"cliente123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")"

## 7) Errores comunes

### 401 Unauthorized

- Verificar que el backend este arriba con docker compose ps.
- Reintentar el mismo comando (el token se regenera dinamicamente).

### 403 Forbidden

- Asegurar que se usa admin@sensores.com / admin123 para update.

### 404 Not Found

- Verificar que el nodo exista en la lista del paso 3.

### Connection refused

- El backend no esta arriba o no esta en el puerto 5050.

## 8) Credenciales de referencia (test)

- Admin:
  - Email: admin@sensores.com
  - Password: admin123
- Cliente con Nogal Norte:
  - Email: cliente@sensores.com
  - Password: cliente123
