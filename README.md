# Cotizador QUILLUM
Cotizador GNP y generador de propuestas personalizadas.

## Esta versión

Aplicación privada con formulario, una cola persistente y generación de la propuesta
QUILLUM desde cada PDF de GNP. Mantiene la plantilla aprobada, la comparación de
niveles A/B y el ejemplo del tope. Alta Tecnología se incluye cuando se selecciona.
Cero deducible por accidente se destaca cuando aparece en el documento de GNP.
También permite cargar una cotización existente para generar la propuesta.

El acceso de Playwright a GNP desde Railway requiere una prueba real. El navegador
y la navegación se basan en el programa que funcionó en la Mac; el inicio de sesión
automático tiene selectores configurables porque el usuario iniciaba sesión
manualmente. La presencia de credenciales no demuestra que el acceso funcione.

**WhatsApp no está conectado todavía.** Se necesita la API/webhook de LiveConnect
o del proveedor real antes de agregar recepción y envío de mensajes y documentos.
El QR de las propuestas solamente abre una conversación de WhatsApp.

## Railway

1. Subir estos archivos al repositorio `rmoreno-lgtm/cotizador`, rama `main`, sin
   subir PDF de clientes, credenciales, sesiones ni `node_modules`.
2. Conectar el repositorio al servicio. Dockerfile es el método de construcción.
   `/healthz` indica que el servidor responde; no valida el acceso a GNP.
3. Crear un **Volume** montado en `/data` para conservar logo, cola y documentos.
4. Configurar en Variables:

   | Variable | Uso |
   | --- | --- |
   | `APP_SECRET` | Clave privada de al menos 32 caracteres para entrar a la aplicación. |
   | `GNP_USERNAME` | Usuario de GNP. |
   | `GNP_PASSWORD` | Contraseña de GNP. |
   | `DATA_DIR` | `/data`. |

   `PORT` lo proporciona Railway. `NODE_ENV=production` está configurado en Docker.
   Generar una clave local con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   y pegarla directamente en Variables, no en GitHub ni en el chat.

5. Mantener **una sola réplica**: la cola usa el volumen local, no una base de datos
   distribuida. No activar suspensión mientras haya solicitudes pendientes.
6. Desplegar manualmente si el despliegue automático no está disponible y generar
   el dominio HTTPS. Abrirlo, introducir `APP_SECRET` y cargar `logo-quillum.png`.
7. Probar primero con un PDF existente y después con una cotización real en GNP.
   Comprobar el nombre, todos los asegurados, los importes y la tabla en ambos PDF.

Si la pantalla de inicio de sesión no tiene un único campo visible de usuario,
contraseña o un botón reconocido, configurar selectores CSS en
`GNP_USERNAME_SELECTOR`, `GNP_PASSWORD_SELECTOR` y `GNP_SUBMIT_SELECTOR`.
No se desactiva CAPTCHA ni se evita una verificación del portal. Si aparecen,
el flujo debe revisarse antes de operar sin intervención.

La imagen oficial de Playwright y su paquete NPM usan la versión `1.62.1`.
Se comprobó la aplicación con Chromium instalado en el entorno de desarrollo.
La descarga de la imagen de Microsoft quedó bloqueada por la red de ese entorno;
la construcción Docker debe verificarse en Railway antes de declarar el despliegue listo.

## Desarrollo

```sh
npm ci
npx playwright install chromium
npm test
```

Para iniciar, definir `APP_SECRET` y opcionalmente credenciales de GNP en el proceso
y ejecutar `npm start`. No se carga automáticamente un archivo `.env`.
Si se usa un Chromium ya instalado, `CHROMIUM_EXECUTABLE_PATH` indica su ruta.
No establecer esta variable en Railway cuando se utilice la imagen oficial.

Se probaron acceso y descarga protegidos, validación de solicitudes, archivos y
orígenes, exclusión de credenciales en errores, ejecución serial, idempotencia y
recuperación de trabajos después de un reinicio. También se probó en navegador
el flujo completo de carga de logo, carga del PDF real aportado y descarga de la
propuesta generada y el documento original. La maquetación usó un logo de prueba;
la aplicación carga el logo original del usuario desde el volumen.

## API para la siguiente integración

Las rutas privadas aceptan sesión de navegador o `Authorization: Bearer <APP_SECRET>`.
No entregar esta clave al frontend de un sitio externo: usar un backend/Worker.

- `POST /api/jobs`: recibe la solicitud JSON y devuelve un trabajo en cola.
- `POST /api/pdf`: multipart con `pdf` y `solicitud` (JSON de los mismos campos).
- `GET /api/jobs/:id`: devuelve el estado y advertencias.
- `GET /api/jobs/:id/files/gnp`: PDF original, si ya se descargó.
- `GET /api/jobs/:id/files/propuesta`: propuesta terminada.
- `POST /api/jobs/:id/retry`: reintento explícito de un trabajo con error.

`Idempotency-Key` evita duplicar una misma solicitud ante reintentos. Para WhatsApp,
se usará el identificador del mensaje entrante y se autorizarán los remitentes.
El webhook del proveedor aún no está implementado.

Ejemplo de estructura (sin datos personales reales):

```json
{
  "nombre": "Cliente de prueba",
  "edad": "45",
  "genero": "Masculino",
  "cp": "64000",
  "familiares": [],
  "tabulador": "D",
  "deducible": "32000",
  "acceso": "Amplio",
  "alta": false
}
```

Solidez Familiar se solicita automáticamente al sumar cuatro o más asegurados,
como en la versión local. Los PDF se contrastan con la solicitud; si faltan datos
o hay discrepancias, el programa conserva el documento original y no completa
una propuesta con cifras del ejemplo. El formato admitido es el PDF anual de
Personaliza Variable con resumen, desglose de asegurados y tabla hospitalaria A–D.
Las solicitudes y resultados permanecen en el volumen hasta que el despacho los
elimine; requiere administrar almacenamiento y respaldos según su operación.
