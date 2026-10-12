# Actualizaciones sin subir archivos manualmente

El repositorio incluye un workflow de GitHub Actions que instala con `npm ci`
y ejecuta las pruebas en `main`, ramas `codex/**` y pull requests.
El despliegue CLI está desactivado hasta configurarlo explícitamente.

## Opción preferida: integración nativa de Railway

Si Railway reconoce el acceso de la GitHub App al repositorio, habilitar el
despliegue automático del servicio desde `main` y activar **Wait for CI**.
En este modo no hace falta dar a GitHub un token de Railway. Dejar
`RAILWAY_DEPLOY_ENABLED` sin configurar para evitar despliegues duplicados.
La compilación Docker la realiza Railway después de pasar las pruebas.

## Alternativa si Railway sigue mostrando Auto deploy unavailable

Configurar una sola vez en **GitHub → Settings → Secrets and variables → Actions**:

1. Secret `RAILWAY_TOKEN`: token de proyecto creado en la configuración del
   proyecto de Railway para el entorno de producción. No usar la clave
   `APP_SECRET` del formulario ni una contraseña de GNP.
2. Variables de repositorio:

   - `RAILWAY_PROJECT_ID`: identificador del proyecto existente.
   - `RAILWAY_SERVICE_ID`: identificador del servicio quillum-cotizador.
   - `RAILWAY_ENVIRONMENT_ID`: identificador del entorno production.
   - `RAILWAY_PUBLIC_URL`: URL HTTPS pública de la aplicación.
   - `RAILWAY_DEPLOY_ENABLED`: `true` al terminar la configuración.

La CLI envía el código a ese proyecto, servicio y entorno concretos; no crea
proyectos nuevos. `release.json` identifica el commit. El workflow espera a que
la URL publique ese mismo commit, sin tomar como éxito que una versión anterior
siga respondiendo. El chequeo acredita el servidor, no una nueva cotización GNP.

No habilitar al mismo tiempo este workflow y el despliegue nativo: usar una ruta.
No cambiar credenciales, volumen `/data`, dominio ni puerto de la aplicación.

## Flujo habitual

Cambios de código → rama de trabajo → pruebas → revisión/merge a main →
compilación Docker y despliegue automático. El diseño de la propuesta permanece
igual. Cada despliegue reinicia el servicio; revisar trabajos en curso según
el estado de la cola. El código público/privado es una configuración separada
del acceso privado de la aplicación mediante APP_SECRET.
