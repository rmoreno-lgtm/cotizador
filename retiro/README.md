# Retiro · primera revisión

Apartado separado de GMM para cargar una ilustración PDF de Proyecta GNP y revisar un borrador de tres páginas. Se integran cuatro enfoques (Retiro personal, Independencia, Personas importantes y Patrimonio), con título, subtítulo, texto e icono propios. Los logos originales QUILLUM y GNP se pueden adjuntar como PNG y se conservan completos; no se distribuyen sustitutos dibujados.

La extracción actual identifica únicamente etiquetas explícitas, conserva el fragmento fuente y señala valores ausentes o contradictorios. No interpreta columnas anuales, no presume coberturas contratadas, no fija inflación y no incorpora cifras del ejemplo de Oliver. El estado del modelo es siempre `borrador`, con `generacionHabilitada:false`. No existe una ruta de descarga final de Retiro en esta primera revisión.

Los borradores requieren la autenticación existente, permanecen en memoria un máximo de 30 minutos (hasta cinco simultáneos) y pueden eliminarse. No se conservan los PDF originales ni se consulta GNP. Reiniciar el servidor elimina los borradores. La vista usa un iframe aislado, sin scripts ni formularios. Los PDFs y logos no se guardan en Git ni en el historial de GMM.

## Validación

`npm test`: 24 pruebas (19 existentes de GMM y cinco nuevas de Retiro). Además se comprobó con Chromium local el inicio de sesión, carga de un PDF sintético, lectura de inflación distinta de 5%, cuatro enfoques y eliminación del borrador. Esto valida el flujo técnico, no la compatibilidad con una ilustración real.

## Pendiente antes de finalizar

- Recibir una ilustración Proyecta GNP real y las condiciones aplicables; convertir ejemplos anonimizados en fixtures de regresión.
- Validar encabezados, unidades, moneda, años, edades, primas acumuladas y tabla anual. No asignar protección por fallecimiento a invalidez.
- Mostrar el importe del ahorro al vencimiento y su clasificación explícita como proyectado o garantizado; separar valores de recuperación anticipada.
- Verificar contratación, suma vigente para un año concreto y condiciones de Invalidez Sin Espera, por separado de exención de primas.
- Contrastar fallecimiento antes del vencimiento, incluso tras invalidez, pago a beneficiarios y terminación del plan con las condiciones contractuales. El borrador señala que el escenario solicitado está pendiente de dicha comprobación.
- Incorporar los archivos originales de logos suministrados y revisar legibilidad a tamaño de impresión.
- Revisar la vista previa con el usuario antes de cerrar la implementación; después habilitar generación y almacenamiento de la propuesta final y su validación de paginación.

No requiere cambios de dependencias ni credenciales reales de GNP para esta revisión. No se ha desplegado en Railway.
