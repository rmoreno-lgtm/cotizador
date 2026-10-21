# Retiro · revisión con ilustración Proyecta

Apartado independiente de GMM para cargar Proyecta GNP y revisar tres páginas, con cuatro enfoques: Retiro personal, Independencia, Personas importantes y Patrimonio. Cambian título, subtítulo, texto e iconos vectoriales. Los logos originales QUILLUM y GNP se guardan como PNG una sola vez en el volumen de datos, sin redibujarlos. El archivo `logo-quillum.png` se comparte con GMM y `logo-gnp.png` se reutiliza en las siguientes propuestas de Vida y Retiro.

## Lectura y validación

Se lee texto nativo mediante pdf-parse. En documentos escaneados o mixtos se renderizan las páginas con la misma biblioteca y se usa Tesseract local, sin enviar documentos a un servicio externo. Requiere `tesseract-ocr` y `tesseract-ocr-eng`; el Dockerfile instala ambos paquetes. En esta máquina están disponibles. Límite: 10 páginas, 40 MB, una lectura simultánea y 30 segundos de OCR por página. Los PNG temporales se eliminan al terminar o fallar.

El formato de tabla reconocido contiene año, edad, prima anual, prima acumulada, efectivo proyectado, porcentaje de recuperación y protección contratada. Se conserva el texto fuente. Se contrastan secuencia de años/edades, plazo hasta vencimiento, aportaciones después del plazo de pago, prima inicial, sumas de las aportaciones de coberturas y acumulados (tolerancia de un peso por redondeo del documento). Una tabla incompleta o incoherente no alimenta el gráfico ni el importe final. Un porcentaje incoherente se marca para revisión y se deja sin valor utilizable; no se corrige automáticamente.

Se distinguen efectivo proyectado, protección y aportaciones. El gráfico usa los valores de cada fila. El selector de año controla el ejemplo y la recuperación anticipada. La inflación procede de las etiquetas del documento y no tiene valor por defecto. Las sumas se manejan en centavos enteros.

Las coberturas se identifican mediante filas explícitas: fallecimiento/supervivencia, exención de primas amparada, Seguridad en Vida, Últimos Gastos e incremento No Fumador. Invalidez Sin Espera se identifica cuando su fila incluye suma y aportación; su prima forma parte de la suma de aportaciones contrastada con la prima inicial. La mera mención no acredita contratación. La suma identificada es inicial: no se completa una tabla anual de invalidez con la columna de protección por fallecimiento. También se reconoce el incremento Mujer cuando su fila lo indica. Los importes adicionales conservan su carácter referencial y sus condiciones. La vista no muestra una indemnización de invalidez sin datos verificados.

El valor final de una tabla identificada como proyección se muestra como proyectado. El texto comercial «garantizado» no convierte esa serie en una serie de valores garantizados. El modelo sigue representando una ilustración pendiente de validación contractual (`estado:borrador`, `generacionHabilitada:false` para emisión final). La descarga de una propuesta **ilustrativa** sí está disponible mediante `GET /api/retiro/:id/pdf`: usa el enfoque y año seleccionados, exige tabla y datos básicos completos y ambos logos guardados. El PDF no afirma que la ilustración sea una póliza o una garantía de rendimiento.

## Privacidad y acceso

Los borradores usan la autenticación existente, permanecen en memoria 30 minutos como máximo (hasta cinco simultáneos) y se pueden eliminar. Reiniciar borra los borradores; conserva los logos guardados en `DATA_DIR`. `GET /api/retiro/logos` informa qué marcas están listas y `POST /api/retiro/logos` permite guardar o reemplazar una o ambas sin borrar la otra. Las rutas requieren autenticación y respetan la validación de origen existente. La vista se presenta en un iframe aislado, sin scripts ni formularios. No se consulta el portal GNP ni se guarda el PDF original en el historial de GMM. Los documentos aportados y los artefactos con datos del cliente no se incorporan al repositorio; las pruebas usan datos sintéticos.

## Comprobaciones

`npm test`: pruebas existentes de GMM y pruebas de extracción, tablas, OCR normalizado, contradicciones y coberturas. Se comprobó además en Chromium el flujo completo con una ilustración real escaneada: carga, OCR de dos páginas, 13 filas, cifras contrastadas visualmente con el original, cuatro enfoques, selector de año, cierre del borrador y salida PDF de tres páginas. Esto acredita esa muestra; otros formatos requieren sus propias comprobaciones.

## Pendiente antes de finalizar

- Contrastar con la póliza las condiciones de exención, fallecimiento posterior a invalidez y terminación del plan. La ilustración define la protección al final del plazo o antes si ocurre fallecimiento, pero no desarrolla todas esas condiciones.
- El usuario guarda los archivos originales de logos una sola vez desde el portal; los logos cargados temporalmente en versiones anteriores no se pueden recuperar tras reiniciar. QUILLUM ya guardado en GMM se reutiliza automáticamente.
- La descarga ilustrativa está habilitada; el historial persistente de Retiro no forma parte de este cambio. El usuario puede seleccionar una página para revisar en pantalla; la descarga incluye siempre las tres. Se mantienen las observaciones contractuales dentro del documento.
- Verificar la construcción Docker en el entorno de despliegue. La ejecución local no acredita un despliegue en Railway.

No requiere credenciales reales de GNP para leer la ilustración. No se ha desplegado ni cambiado GMM.

## Navegación del portal

El menú separa Inicio, Gastos Médicos y Vida y Retiro. Las herramientas permanecen montadas al cambiar de sección para conservar los formularios y la vista temporal. La URL permite volver directamente a `#gastos-medicos` o `#vida`; los hashes desconocidos muestran Inicio. En móviles, el mismo menú pasa a la parte superior. Se verificaron cambio de sección, conservación de los datos de GMM, navegación atrás y recarga en Vida.

Se validó además una ilustración escaneada de tres páginas y 35 años: sus tres primas de coberturas cuadran y se identifican por separado la exención y la suma inicial de Invalidez Sin Espera. No se guarda el PDF ni datos del cliente en los tests. Para tablas largas, la tercera página muestra dos bloques de años consecutivos sin omitir filas; se verificaron tres páginas sin solapamientos en los cuatro enfoques para esta muestra.

## Descarga y validación de diseño

La exportación usa Chromium con todos los recursos embebidos, espera la carga de fuentes y logos, comprueba márgenes contra los pies en modo impresión y entrega el PDF autenticado como archivo adjunto. Solo se renderiza un PDF a la vez. La vista previa muestra una página escalada al ancho disponible; ese escalado no altera el PDF.

Se comprobó la descarga real desde el botón del navegador de los cuatro enfoques, con una ilustración de 35 años, y de una segunda ilustración de 13 años. Cada PDF contiene tres páginas. También se comprobó guardar GNP una sola vez, reutilizar QUILLUM existente de GMM, reiniciar la aplicación y descargar otra propuesta sin volver a cargar logos. Los logos sintéticos usados en las pruebas quedan fuera del repositorio y no sustituyen los originales del usuario.
