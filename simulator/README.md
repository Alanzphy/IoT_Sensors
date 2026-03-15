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

### Variables de entorno (alternativa a CLI)
```bash
export SIMULATOR_API_KEY=ak_n01_xxxxxx
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
