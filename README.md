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

En el formulario elige «Comparar deducibles y tabuladores» y selecciona dos o tres configuraciones distintas. Los asegurados, acceso hospitalario y Alta Tecnología son comunes a todas las opciones. Se ejecutan cotizaciones secuenciales en una sola sesión y navegador. Entre opciones se vuelve a `/sesion` conservando las cookies y se recorre menú → Cotiza y Emite → GMM → Cotizador GMM Tarifa Actual; no se usa un botón «Editar» no verificado. Cada original se conserva en `opcion-N/gnp.pdf` y se valida contra su solicitud antes de generar un único comparativo de cuatro páginas.

El comparativo muestra prima anual, deducible, tabulador, acceso, suma asegurada y ejemplos de participación para el mismo gasto en niveles hospitalarios A y B. Los honorarios fuera del tabulador no se calculan como si fueran coaseguro. Si una opción falla o cambian las coberturas comunes, el trabajo requiere revisión y no se publica un comparativo incompleto. Al reintentar se reutilizan originales de menos de una hora únicamente si coinciden la solicitud y su SHA-256, y el parser vuelve a validar su contenido. Las opciones faltantes, modificadas o antiguas se cotizan en una nueva sesión compartida. Desde el historial se descargan por separado el comparativo y cada original. La carga de un solo PDF mantiene exclusivamente la modalidad individual.

Validación local: `npm test`. La comprobación con el portal real requiere las credenciales de GNP configuradas en Railway.

El PDF comparativo presenta primero los beneficios comunes con el estilo de la propuesta individual; después señala qué cambia respecto a la opción 1 (deducible, tabulador o ambos), la diferencia de prima anual y ejemplos desglosados de participación. La propuesta individual mantiene su diseño.

### Presentación de Vida y Retiro

La propuesta guía al cliente por su objetivo, escenarios y una tabla anual continua a todo el ancho. Destaca la última aportación, el primer año donde el valor en efectivo proyectado alcanza el total aportado y el vencimiento. Ese cruce no representa una tasa de rendimiento ni una garantía. La tabla distingue aportación anual, total aportado, valor en efectivo, porcentaje de recuperación y protección; la correspondencia de Protección con Invalidez Sin Espera se aplica bajo la regla Proyecta confirmada por el asesor y las comprobaciones descritas más adelante. Para ilustraciones de más de 35 años, la tabla continúa en páginas adicionales, sin dividirse en bloques laterales.

El selector de año se aplica exclusivamente al escenario de invalidez y abre la hoja 2. No cambia el escenario de fallecimiento, no resalta filas de la tabla ni recalcula sus cifras. La tabla mantiene el calendario original, centra los importes y destaca en verde el vencimiento, con el ahorro final remarcado. Se conservan los logos guardados. Los datos personales y los PDFs de ejemplo no se incorporan al repositorio.

En la tabla, solo el número del último año de aportación se subraya. La columna de aportación sustituye los ceros posteriores por una línea punteada con la etiqueta «Dejas de aportar», sin modificar los importes del modelo. Los importes finales de efectivo y protección se remarcan; la gráfica inicial ocupa todo el ancho y etiqueta el total aportado, el fin de aportaciones y el valor proyectado al vencimiento.

Los textos dirigidos al prospecto no mencionan el PDF ni el proceso de lectura. El total aportado explica su periodo y los escenarios se personalizan con nombre, año y edad, sin cambiar importes ni condiciones. Los títulos de cada enfoque son descriptivos. La revisión de los datos de origen permanece disponible para el asesor antes de exportar.

### Títulos personalizados de Retiro

Cada enfoque sugiere una frase con el primer nombre del cliente. Después de cargar la ilustración, el asesor puede editar el «Título para este enfoque» (hasta 140 caracteres), aplicarlo a la vista previa o restablecer la sugerencia. Se conserva un título por enfoque durante el borrador y se aplica también antes de descargar, para que el archivo incluya el texto elegido. Los títulos no pasan a otras propuestas ni se guardan como historial del cliente.

La API autenticada `PATCH /api/retiro/:id/titulo` acepta `{enfoque, titulo}`; un título vacío recupera la sugerencia. Valida texto y longitud, y la presentación escapa HTML. El texto personalizado se guarda en el borrador, sin enviarse en las direcciones de la vista previa ni de la descarga.

### Redacción desde contexto con IA

Tras cargar una propuesta, el asesor puede describir las prioridades del cliente en «¿Qué busca este cliente?» y pulsar «Generar título y frase». OpenAI sugiere un título y una frase de cierre para el enfoque seleccionado. Los textos se pueden editar y se aplican al pulsar «Aplicar textos» o antes de descargar. La frase aparece en el cierre de la propuesta. Los cuatro enfoques y la edición manual funcionan sin IA.

Para activar la conexión en producción:

1. En Railway, abrir `quillum-cotizador` → **Variables** y agregar `OPENAI_API_KEY` con una clave de un proyecto de OpenAI con acceso y facturación de API. La facturación de API es independiente de una suscripción de ChatGPT.
2. Opcionalmente, definir `OPENAI_MODEL`; su valor predeterminado es `gpt-4.1-mini`.
3. Aplicar los cambios de Railway y recargar el portal. La clave permanece en el servidor y no debe compartirse por chat ni incorporarse al repositorio.

El servidor consulta la API Responses con `store: false`, un límite de salida y un tiempo máximo de 30 segundos. Envía solo el primer nombre, el enfoque y el contexto escrito, sin incluir el PDF, la tabla ni las coberturas. El contexto no se incorpora al historial del cliente ni al almacenamiento persistente de la aplicación. La interfaz informa del envío a OpenAI antes de solicitarlo. Aplican las condiciones de tratamiento de datos del proveedor.

Las respuestas se restringen a dos campos de texto, con límites de longitud y validaciones para rechazar cifras y afirmaciones financieras o contractuales reconocibles. El asesor debe revisar la redacción; la IA no modifica los datos del plan. La aplicación limita las solicitudes simultáneas y la frecuencia de generación. Ante ausencia de clave o errores del proveedor, conserva los textos existentes y permite continuar con la edición manual.

La integración se verifica con respuestas simuladas, incluyendo errores, rechazos y protección de datos. Para confirmar el servicio real hace falta configurar una clave válida en Railway.

El escenario de invalidez separa exención de primas e indemnización según las coberturas identificadas, y muestra el ahorro previsto al vencimiento si la persona sobrevive. La continuidad y los pagos posteriores a una invalidez permanecen sujetos a la verificación de condiciones contractuales. Si no hay exención, no supone una interrupción de aportaciones; si solo hay exención, no muestra una indemnización adicional. El camino de fallecimiento incluye la situación posterior a una invalidez, sujeto a la póliza, sin presentar un ahorro posterior. No se equiparan automáticamente coberturas con sumas iniciales diferentes.

### Correspondencia anual de Invalidez Sin Espera en Proyecta

Por indicación y confirmación del asesor, se utiliza la columna Protección del año seleccionado para la suma ilustrativa de Invalidez Sin Espera en Proyecta cuando esa cobertura está identificada, la tabla completa está validada y su suma inicial coincide con la de fallecimiento y con la primera fila. La correspondencia se registra en los datos de la cobertura y en sus fuentes como regla confirmada por el asesor; no se presenta como una comprobación independiente de las condiciones de la póliza. No se recalculan importes ni se usa el ahorro como sustituto.

Si las sumas iniciales difieren, falta la cobertura o la tabla no es válida, no se asigna esa serie anual a invalidez. Se conserva el dato inicial y se indica la revisión necesaria cuando proceda. La propuesta describe el importe anual como ilustrado, sujeto a vigencia, dictamen y condiciones; la exención se mantiene separada.

### Controles y descarga de Retiro

Junto a la vista previa se agrupan, en este orden, el selector de página, «Descargar propuesta PDF» y el año del escenario de invalidez. En móvil se apilan en el mismo orden. La descarga incluye todas las páginas, independientemente de la página visible.

El área explica por qué la descarga está deshabilitada (datos pendientes, logotipos o una operación en curso) y muestra los errores junto al botón. Al preparar el archivo se conserva un enlace «Guardar PDF preparado» para una descarga iniciada directamente por el usuario si el navegador no inicia la automática. Se verifica que la respuesta sea un PDF. Cambiar los datos de presentación, el año o los logos retira el archivo preparado anterior; cerrar o cargar otra propuesta libera su URL temporal. Una descarga pendiente no publica un archivo de un borrador que haya cambiado.

### Menú Vida y Ahorro y presentaciones de Retiro

El menú organiza los planes bajo **Vida y Ahorro**: Retiro, PPR, Educación, Ahorro e inversión — Trasciende y Total. Retiro y PPR tienen formularios propios; Educación, Trasciende y Total muestran «Próximamente». Gastos Médicos conserva su propio apartado. Los formularios y el borrador no se reinician al navegar entre secciones. El enlace anterior `#vida` sigue abriendo Retiro; el nuevo es `#retiro`.

Retiro ofrece dos presentaciones independientes del enfoque:

- **Resumida**: dos páginas con objetivo, cifras, línea de vida, gráfica y escenarios. No incluye la tabla anual. La frase de cierre personalizada aparece en el bloque del objetivo.
- **Detallada**: la presentación existente, con tabla anual completa y frase de cierre. Para las ilustraciones habituales de hasta 35 años son tres páginas; los planes más largos continúan su tabla en páginas adicionales.

Ambas usan los mismos datos validados y coberturas. El formato resumido no permite omitir validaciones ni generar una propuesta con una tabla de origen inválida. Los cuatro enfoques cambian títulos, subtítulos, meta de la línea de vida, textos de acompañamiento e íconos, sin modificar los importes del plan.

Las rutas de vista y PDF aceptan `formato=resumida` o `formato=detallada`; si se omite, se conserva la detallada. El servidor valida el formato y los límites de página. Cambiarlo actualiza la vista y la descarga e invalida cualquier archivo preparado del formato anterior.


### PPR Consolida: ejercicio fiscal supuesto

PPR permite cargar ilustraciones Consolida GNP en MXN con vencimiento a los 65 años y columna explícita de monto deducible del artículo 151. Lee las tablas completas y compactas, y conserva el plazo real de aportaciones: admite pagos limitados de 5 o 10 años y plazos hasta los 65, sin sustituir el plazo leído. Los casos con mezcla de artículo 185, moneda distinta, tablas incompletas o cifras contradictorias requieren revisión y no permiten emitir.

El ejercicio usa un **supuesto fijo del 30% aplicado al monto potencialmente deducible, no a toda la prima**. Supone que ese monto completo resulta aplicable y produce dicho efecto fiscal. No calcula límites personales, UMA, tarifa efectiva, ISR real ni devoluciones. Ejemplo: aportación de $200,000, monto para deducción de $192,824, beneficio supuesto de $57,847.20 y desembolso neto ilustrativo de $142,152.80. GNP recibe los $200,000 completos; el efecto fiscal se presenta por separado y depende de los límites y situación del contribuyente. No constituye una promesa de devolución ni un descuento de la prima.

No se han validado en esta implementación topes fiscales vigentes contra fuentes oficiales. El tratamiento de retiros, vencimiento y retenciones se mantiene sujeto a la legislación y contrato; no se afirma que el vencimiento esté libre de impuestos. Recuperación y protección se identifican como proyectadas. El beneficio no se suma al ahorro ni se reinvierte automáticamente.

La presentación resumida incluye dos páginas; la detallada agrega la tabla anual, con hasta 15 filas por página y continuación vertical. El selector fiscal permite elegir un año con aportación y cambia únicamente el ejercicio de la segunda página. La tabla conserva todos los años, destaca el fin de aportaciones y el vencimiento. Los totales fiscales suman las aportaciones anuales; diferencias de un peso por redondeo con acumulados impresos se señalan para revisión. No se inventan coberturas de invalidez a partir de otras columnas.

Los logos usan el mismo almacenamiento persistente de Retiro: se cargan una vez para ambos módulos. Los borradores PPR viven en memoria durante 30 minutos, con máximo cinco; las cargas no se agregan al historial persistente. Las rutas `/api/ppr` requieren autenticación. La descarga verifica el contenido PDF y ofrece un enlace alternativo al archivo preparado. El renderizado Chromium es compartido con Retiro y rechaza contenido que invada el pie de página. OCR limita Tesseract a un hilo por proceso para evitar saturación durante lecturas simultáneas.

Validación: pruebas automáticas del cálculo, lectura, inconsistencias, formatos y autenticación; carga y descarga en navegador con las tres ilustraciones proporcionadas, revisión móvil, logos compartidos y regresión de descarga de Retiro. Las pruebas sintéticas cubren pagos de 5, 9 y 10 años sin incluir documentos ni datos personales en el repositorio.
