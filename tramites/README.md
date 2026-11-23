# Trámites · Vigilancias automáticas

Reglas que revisan **Servicios asistidos** del portal de intermediarios de GNP
cada cierto tiempo y avisan por **correo** y **WhatsApp** cuando algo cambia.
Solo lectura: nunca se pulsa Agregar, Turnar ni Salir en GNP.

## Qué hace cada regla
- **Sección:** Gastos Médicos (individual) o Vida (individual) de Servicios asistidos.
- **Filtros:** estatus a vigilar, "registrados desde" una fecha y, opcional, una sola clave de agente.
- **Frecuencia y horario:** cada 30 min a 24 h, entre una hora de inicio y de término, en los días elegidos
  (zona `America/Monterrey`, configurable con `AVISOS_ZONA_HORARIA`).
- **Avisos:** trámite nuevo, cambio de estatus, nueva observación de GNP, cambio de fecha compromiso y
  trámites que salen de la vista (se cerraron o cambiaron a un estatus que no se vigila).
- **Observaciones Portal (GMM):** abre cada OT abierta con doble clic y lee las observaciones de
  "Empleado GNP" (máximo 30 por revisión).
- La primera revisión toma la **línea base** y envía un resumen; después solo se avisa cuando hay cambios.
- Si varias reglas tocan al mismo tiempo, se hace **un solo inicio de sesión** en GNP.

Datos guardados en el volumen: `/data/tramites-vigilancias.json` (reglas, último estado y 200 avisos).

## Variables en Railway
| Variable | Uso |
| --- | --- |
| `GNP_USERNAME`, `GNP_PASSWORD` | Ya existentes. Acceso al portal de GNP. |
| `RESEND_API_KEY` | Llave de [Resend](https://resend.com) para enviar correos. |
| `AVISOS_CORREO_REMITENTE` | Remitente verificado en Resend, p. ej. `Avisos QUILLUM <avisos@quillum.com.mx>`. |
| `WHATSAPP_TOKEN` | Token permanente de la app de WhatsApp Business (Meta). |
| `WHATSAPP_PHONE_ID` | Phone number ID del número emisor en Meta. |
| `WHATSAPP_PLANTILLA` | Nombre de la plantilla aprobada (cuerpo con una variable `{{1}}`). |
| `WHATSAPP_IDIOMA` | Opcional, por defecto `es_MX`. |
| `AVISOS_ZONA_HORARIA` | Opcional, por defecto `America/Monterrey`. |

El programador se enciende solo cuando `NODE_ENV=production` (ya configurado en Docker).
Mantener **una sola réplica** y sin suspensión del servicio, igual que la cola.

### Correo (Resend)
1. Crear cuenta en Resend y verificar el dominio `quillum.com.mx` (registros DNS que indica Resend).
2. Crear una API key y pegarla en `RESEND_API_KEY`; definir `AVISOS_CORREO_REMITENTE`.

### WhatsApp (Meta · WhatsApp Business Platform)
1. En Meta Business, crear una app de WhatsApp y registrar el número emisor.
2. Crear y enviar a aprobación una plantilla de categoría *Utilidad*, idioma Español (MEX), por ejemplo:
   `Aviso de trámites GNP: {{1}}`
3. Generar un token permanente (usuario del sistema) y copiar el Phone number ID.

Los mensajes de WhatsApp iniciados por la empresa requieren plantilla aprobada; el texto del aviso
se recorta a una sola línea de hasta 1000 caracteres. El detalle completo va por correo.

## Limitaciones
- El inicio de sesión de GNP tiene reCAPTCHA. Si GNP bloquea el acceso automático, la regla mostrará
  el error y no se intenta evadirlo.
- Las rutas y columnas se relevaron el 22-nov-2026; si GNP cambia la pantalla, la regla mostrará el error.
