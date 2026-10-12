# Cotizador QUILLUM
Cotizador GNP y generador de propuestas personalizadas.

## Esta versión

Aplicación privada con formulario, historial con búsqueda y filtros, una cola persistente y generación de la propuesta
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
   | `APP_SECRET` | Llave interna/API de al menos 32 caracteres; firma las sesiones. |
   | `APP_USERNAME` | Usuario del formulario; por defecto `quillum`. |
   | `APP_PASSWORD` | Contraseña propia del formulario, de al menos 12 caracteres. |
   | `GNP_USERNAME` | Usuario de GNP. |
   | `GNP_PASSWORD` | Contraseña de GNP. |
   | `DATA_DIR` | `/data`. |

   `PORT` lo proporciona Railway. `NODE_ENV=production` está configurado en Docker.
   Generar una clave local con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   y pegarla directamente en Variables, no en GitHub ni en el chat.

   `APP_SECRET` sigue siendo la llave interna/API y firma las sesiones. Al definir
   `APP_PASSWORD`, el formulario solicita esa contraseña. Si todavía no está
   definida, acepta la clave anterior para facilitar la transición. El navegador
   ofrece guardar usuario y contraseña mediante su gestor. “Recordarme durante
   30 días” conserva la sesión en ese dispositivo; sin esa opción dura un día.
   Cambiar usuario, contraseña o APP_SECRET invalida las sesiones existentes.

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
- `GET /api/jobs?page=1&q=cliente&estado=completada`: historial paginado (10 por página), búsqueda por cliente/folio/CP y filtro de estado. Sin `page`, conserva el arreglo de hasta 30 registros para clientes anteriores.
- `GET /api/jobs/:id`: devuelve el estado, datos de la solicitud e importes verificados cuando existen.
- `DELETE /api/jobs/:id`: elimina una solicitud terminada y todos sus archivos con cuerpo `{"confirmar":true}`. Requiere autenticación y confirmación explícita. No elimina trabajos pendientes ni procesándose.
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
El historial permite abrir el detalle y eliminar solicitudes terminadas con sus PDF. Las solicitudes y resultados permanecen en el volumen hasta que el despacho los
elimine; requiere administrar almacenamiento y respaldos según su operación.

Los deducibles del formulario son los diez valores de la captura de GNP compartida: $21,000, $32,000, $45,000, $56,000, $68,000, $87,000, $111,000, $128,000, $175,000 y $233,000. Su disponibilidad final depende del portal al cotizar.

### Comparativo QUILLUM

En el formulario elige «Comparar deducibles y tabuladores» y selecciona dos o tres configuraciones distintas. Los asegurados, acceso hospitalario y Alta Tecnología son comunes a todas las opciones. Se ejecutan cotizaciones secuenciales en una sola sesión y navegador. Entre opciones se vuelve a `/sesion` conservando las cookies y se recorre menú → Cotiza y Emite → GMM → Cotizador GMM Tarifa Actual; no se usa un botón «Editar» no verificado. Cada original se conserva en `opcion-N/gnp.pdf` y se valida contra su solicitud antes de generar un único comparativo de tres páginas.

El comparativo muestra prima anual, deducible, tabulador, acceso, suma asegurada y ejemplos de participación para el mismo gasto en niveles hospitalarios A y B. Los honorarios fuera del tabulador no se calculan como si fueran coaseguro. Si una opción falla o cambian las coberturas comunes, el trabajo requiere revisión y no se publica un comparativo incompleto. Al reintentar se reutilizan originales de menos de una hora únicamente si coinciden la solicitud y su SHA-256, y el parser vuelve a validar su contenido. Las opciones faltantes, modificadas o antiguas se cotizan en una nueva sesión compartida. Desde el historial se descargan por separado el comparativo y cada original. La carga de un solo PDF mantiene exclusivamente la modalidad individual.

Validación local: `npm test`. La comprobación con el portal real requiere las credenciales de GNP configuradas en Railway.
