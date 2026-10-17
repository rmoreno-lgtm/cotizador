# Retiro · revisión con ilustración Proyecta

Apartado independiente de GMM para cargar Proyecta GNP y revisar tres páginas, con cuatro enfoques: Retiro personal, Independencia, Personas importantes y Patrimonio. Cambian título, subtítulo, texto e iconos vectoriales. Se pueden adjuntar los logos originales QUILLUM y GNP como PNG, sin redibujarlos.

## Lectura y validación

Se lee texto nativo mediante pdf-parse. En documentos escaneados o mixtos se renderizan las páginas con la misma biblioteca y se usa Tesseract local, sin enviar documentos a un servicio externo. Requiere `tesseract-ocr` y `tesseract-ocr-eng`; el Dockerfile instala ambos paquetes. En esta máquina están disponibles. Límite: 10 páginas, 40 MB, una lectura simultánea y 30 segundos de OCR por página. Los PNG temporales se eliminan al terminar o fallar.

El formato de tabla reconocido contiene año, edad, prima anual, prima acumulada, efectivo proyectado, porcentaje de recuperación y protección contratada. Se conserva el texto fuente. Se contrastan secuencia de años/edades, plazo hasta vencimiento, aportaciones después del plazo de pago, prima inicial, sumas de las aportaciones de coberturas y acumulados (tolerancia de un peso por redondeo del documento). Una tabla incompleta o incoherente no alimenta el gráfico ni el importe final. Un porcentaje incoherente se marca para revisión y se deja sin valor utilizable; no se corrige automáticamente.

Se distinguen efectivo proyectado, protección y aportaciones. El gráfico usa los valores de cada fila. El selector de año controla el ejemplo y la recuperación anticipada. La inflación procede de las etiquetas del documento y no tiene valor por defecto. Las sumas se manejan en centavos enteros.

Las coberturas se identifican mediante filas explícitas: fallecimiento/supervivencia, exención de primas amparada, Seguridad en Vida, Últimos Gastos e incremento No Fumador. La mera mención de Invalidez Sin Espera no acredita contratación ni autoriza convertir protección por fallecimiento en una indemnización de invalidez. Los importes adicionales conservan su carácter referencial y sus condiciones. La vista no muestra una indemnización de invalidez sin datos verificados.

El valor final de una tabla identificada como proyección se muestra como proyectado. El texto comercial «garantizado» no convierte esa serie en una serie de valores garantizados. El estado sigue siendo `borrador`, con `generacionHabilitada:false`; no existe todavía una ruta de descarga final de Retiro.

## Privacidad y acceso

Los borradores usan la autenticación existente, permanecen en memoria 30 minutos como máximo (hasta cinco simultáneos) y se pueden eliminar. Reiniciar borra los borradores. La vista se presenta en un iframe aislado, sin scripts ni formularios. No se consulta el portal GNP ni se guarda el PDF original en el historial de GMM. Los documentos aportados y los artefactos con datos del cliente no se incorporan al repositorio; las pruebas usan datos sintéticos.

## Comprobaciones

`npm test`: pruebas existentes de GMM y pruebas de extracción, tablas, OCR normalizado, contradicciones y coberturas. Se comprobó además en Chromium el flujo completo con una ilustración real escaneada: carga, OCR de dos páginas, 13 filas, cifras contrastadas visualmente con el original, cuatro enfoques, selector de año, cierre del borrador y salida PDF de tres páginas. Esto acredita esa muestra; otros formatos requieren sus propias comprobaciones.

## Pendiente antes de finalizar

- Contrastar con la póliza las condiciones de exención, fallecimiento posterior a invalidez y terminación del plan. La ilustración define la protección al final del plazo o antes si ocurre fallecimiento, pero no desarrolla todas esas condiciones.
- Recibir los archivos originales de los logos para incorporarlos a la vista; la carga manual ya está disponible.
- Revisar la vista previa con el usuario antes de habilitar generación final, almacenamiento e historial de Retiro.
- Verificar la construcción Docker en el entorno de despliegue. La ejecución local no acredita un despliegue en Railway.

No requiere credenciales reales de GNP para leer la ilustración. No se ha desplegado ni cambiado GMM.
