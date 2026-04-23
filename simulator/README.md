# 📡 Simulador IoT — Sistema de Riego Agrícola

Simula el envío de lecturas de sensores cada 10 minutos al backend.

## Instalación

```bash
cd simulator
pip install -r requirements.txt
```

## Uso

### 1. Obtener la API Key
Desde el panel de Admin, crea un nodo y copia su API Key.

### 2. Ejecutar el simulador

```bash
# Modo normal (envía cada 10 min)
python simulator.py --api-key ak_n01_xxxxxx

# Modo rápido para pruebas (cada 30 seg)
python simulator.py --api-key ak_n01_xxxxxx --interval 30

# Generar 7 días de historial + iniciar loop
python simulator.py --api-key ak_n01_xxxxxx --backfill 7

# Solo ver qué datos generaría (sin enviar)
python simulator.py --api-key ak_n01_xxxxxx --dry-run

# Apuntar a otro servidor
python simulator.py --api-key ak_n01_xxxxxx --base-url https://mi-servidor.com/api/v1
```

### 3. Simulador rápido multi-nodo (demo en vivo)

`simulator_fast.py` incluye soporte para varios nodos en paralelo, modo de picos controlados para demo y carga de API keys desde archivo.

```bash
# Demo total de un comando (usa el preset del seed local y despacha notificaciones)
python simulator_fast.py --quick-demo

# 2 nodos en paralelo (intervalo 2s)
python simulator_fast.py \
  --api-key 99189486-8181-4e8c-8c6d-b3da66e6712b \
  --api-key c1f5cd79-e760-4a9f-92ea-31ea685a3add \
  --interval 2

# Modo demo de alertas controladas
python simulator_fast.py \
  --api-key 99189486-8181-4e8c-8c6d-b3da66e6712b \
  --mode demo-alerts \
  --demo-spike-every 6 \
  --interval 2

# Cargar API keys desde archivo (una por linea)
python simulator_fast.py --api-keys-file ./keys.txt --mode demo-alerts

# Backfill por cada nodo y luego loop en vivo
python simulator_fast.py --api-keys-file ./keys.txt --backfill 7 --interval 2
```

`--quick-demo` habilita:
- preset `seed-demo` (4 API keys del seed local)
- modo `demo-alerts`
- dispatch automatico de notificaciones cada 20s
- login admin local por defecto (`admin@sensores.com` / `admin123`)

### Variables de entorno (alternativa a CLI)
```bash
export SIMULATOR_API_KEY=ak_n01_xxxxxx
export SIMULATOR_API_KEYS="key1,key2,key3"
export SIMULATOR_PRESET=seed-demo
export SIMULATOR_ADMIN_EMAIL=admin@sensores.com
export SIMULATOR_ADMIN_PASSWORD=admin123
export SIMULATOR_BASE_URL=http://localhost:5050/api/v1
export SIMULATOR_INTERVAL=600
python simulator.py
```

## Datos generados

El simulador genera datos coherentes con la hora del día:

| Parámetro | Comportamiento |
|-----------|---------------|
| ☀️ Radiación solar | Curva solar realista (pico ~14:00, 0 de noche) |
| 🌡️ Temp. ambiente | Correlacionada con sol + lag de 2 hrs |
| 🌱 Temp. suelo | Versión amortiguada de temp. ambiente |
| 💧 Humedad suelo | Baja con evaporación diurna, sube con riego |
| 🚿 Riego | Activo 5-7 AM y 5-7 PM (programado) |
| 💨 Viento | Ligeramente mayor al mediodía |
| 📊 ETo | Calculado de radiación + temp + viento |
