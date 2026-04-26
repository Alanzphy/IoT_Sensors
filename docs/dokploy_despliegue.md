# Despliegue en Dokploy (Checklist Operativo)

Este documento te deja el proyecto listo para desplegar en Dokploy sin tocar el flujo local.

## 1) Crear proyecto en Dokploy

1. Tipo de proyecto: `Compose`.
2. Repositorio: `Alanzphy/IoT_Sensors`.
3. Rama: `main`.
4. Compose path: `docker-compose.yml`.

## 2) Variables de entorno (pestaña Environment)

Pega este bloque y reemplaza valores sensibles:

```env
# Dominio publico
DOMAIN=sensores.alanrz.bond
FRONTEND_PUBLIC_URL=https://sensores.alanrz.bond
PASSWORD_RESET_URL_BASE=https://sensores.alanrz.bond/restablecer-contrasena

# App
DEBUG=false
SECRET_KEY=CAMBIA_ESTE_SECRET_LARGO_Y_ALEATORIO
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Base de datos MySQL
DB_USER=root
DB_PASSWORD=CAMBIA_ESTA_PASSWORD
DB_NAME=sensores_riego

# Bind local de puertos (mantener en localhost)
MYSQL_PORT_BIND=127.0.0.1:3306
BACKEND_PORT_BIND=127.0.0.1:5050
FRONTEND_PORT_BIND=127.0.0.1:3022

# Scheduler inactividad
SCHEDULER_ADMIN_EMAIL=admin@sensores.com
SCHEDULER_ADMIN_PASSWORD=CAMBIA_PASSWORD_ADMIN
INACTIVITY_SCAN_INTERVAL_SECONDS=300
INACTIVITY_SCAN_MINUTES=20
INACTIVITY_SCAN_HTTP_TIMEOUT_SECONDS=20

# Notificaciones
NOTIFICATIONS_ENABLED=true
NOTIFICATIONS_EMAIL_ENABLED=true
NOTIFICATIONS_WHATSAPP_ENABLED=true

# SMTP (Gmail app password o proveedor SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=alerts@sensores.com
SMTP_PASSWORD=CAMBIA_APP_PASSWORD_SMTP
SMTP_FROM_EMAIL=alerts@sensores.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
NOTIFICATION_EMAIL_SUBJECT_PREFIX=[Sensores IoT]

# WhatsApp Meta
WHATSAPP_PROVIDER=meta
WHATSAPP_MESSAGE_MODE=template
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v20.0
WHATSAPP_PHONE_NUMBER_ID=CAMBIA_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN=CAMBIA_ACCESS_TOKEN
WHATSAPP_HTTP_TIMEOUT_SECONDS=15
WHATSAPP_TEMPLATE_NAME=alerta_riego_critica_v1
WHATSAPP_TEMPLATE_LANGUAGE_CODE=es_MX

# Twilio (solo si cambias provider a twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_CONTENT_SID=
TWILIO_STATUS_CALLBACK_URL=
TWILIO_API_BASE_URL=https://api.twilio.com

# Scheduler dispatch de notificaciones
NOTIFICATION_DISPATCH_INTERVAL_SECONDS=300
NOTIFICATION_DISPATCH_LIMIT=200
NOTIFICATION_DISPATCH_ONLY_UNREAD=false
NOTIFICATION_DISPATCH_HTTP_TIMEOUT_SECONDS=20
```

## 3) DNS y SSL

1. Asegura que el dominio (`DOMAIN`) apunte a la IP de la VPS.
2. Si usas Cloudflare y el certificado no sale al primer intento, prueba temporalmente `DNS only` hasta que Traefik emita SSL.

## 4) Deploy

1. Click en `Deploy`.
2. Espera estado healthy en servicios:
   - `mysql`
   - `backend`
   - `frontend`
   - `inactivity_scheduler`
   - `notification_scheduler`

## 5) Validacion post deploy

1. `https://TU_DOMINIO/health` debe responder `{"status":"ok"}`.
2. `https://TU_DOMINIO/api/v1/docs` debe abrir Swagger.
3. `https://TU_DOMINIO` debe abrir frontend.
4. Login admin y prueba de dispatch:
   - `POST /api/v1/alerts/dispatch-notifications`
5. Confirma correo y WhatsApp en cliente objetivo.

## 6) Problemas comunes

1. No llegan WhatsApp y email si: `NOTIFICATIONS_ENABLED=false`.
2. WhatsApp falla si token/phone id inválidos o plantilla no aprobada cuando `WHATSAPP_MESSAGE_MODE=template`.
3. Links de WhatsApp mal direccionados si `FRONTEND_PUBLIC_URL` no coincide con el dominio real.
