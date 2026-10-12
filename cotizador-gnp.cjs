const { chromium } = require('playwright');
async function iniciarSesion(page, env) {
  try {
    await page.goto('https://portalintermediarios.gnp.com.mx/', {waitUntil:'domcontentloaded'});
    const clave = page.locator(env.GNP_PASSWORD_SELECTOR || 'input[type="password"]:visible');
    await clave.waitFor({state:'visible'});
    const usuario = page.locator(env.GNP_USERNAME_SELECTOR || 'input[autocomplete="username"]:visible, input[type="email"]:visible, input[type="text"]:visible');
    const boton = env.GNP_SUBMIT_SELECTOR ? page.locator(env.GNP_SUBMIT_SELECTOR) : page.getByRole('button', {name:/^(Ingresar|Entrar|Acceder|Iniciar sesión)$/i});
    if (await usuario.count()!==1 || await clave.count()!==1 || await boton.count()!==1) {
      throw new Error('Los campos no son únicos.');
    }
    await usuario.fill(env.GNP_USERNAME);
    await clave.fill(env.GNP_PASSWORD);
    await boton.click();
    await page.getByRole('button').filter({hasText:'menu'}).waitFor({state:'visible'});
  } catch {
    // No devolver registros de fill() que pudieran contener las credenciales.
    throw new Error('No se pudo iniciar sesión en GNP. Verifica las credenciales, la conexión y los selectores GNP_USERNAME_SELECTOR, GNP_PASSWORD_SELECTOR y GNP_SUBMIT_SELECTOR en Railway.');
  }
}
async function cotizarEnPagina(page, solicitud, destino) {
  const datos={...solicitud,familiares:solicitud.familiares.map(f=>({...f}))};
    await page.getByRole('button').filter({ hasText: 'menu' }).click();
    await page.getByRole('link', { name: 'Cotiza y Emite' }).click();
    await page.getByRole('button').filter({ hasText: 'close' }).click();
    await page.getByText('GMM').click();
    await page.getByText('Cotizador GMM Tarifa Actual').click();
    const frame = page.locator('#inlineFrameExample').contentFrame();
    await frame.getByRole('button', { name: 'Fuerza Productora Regular' }).click();
    await frame.getByRole('menuitem', { name: 'Planes Individuales', exact: true }).click();

    await frame.getByText(/^Seguro Médico GNP Pers/).first().click();
    await frame.getByRole('option', { name: 'Seguro Médico GNP Personaliza Variable', exact: true }).click();
    await frame.getByRole('button', { name: 'Titular', exact: true }).click();
    async function elegirGenero(ambito, destino) {
      const visible = ambito.getByText(/^(Masculino|Femenino)$/);
      const actual = (await visible.innerText()).trim();
      if (actual !== destino) {
        await visible.click();
        
      const opcion = frame.getByRole('option', {
        name: destino,
        exact: true
      });
      await opcion.waitFor({ state: 'visible' });
      await opcion.focus();
      await page.keyboard.press('Enter');
      }
    }
    await elegirGenero(frame, datos.genero);
    await frame.getByRole('textbox', { name: 'Edad', exact: true }).fill(datos.edad);
    await frame.getByRole('textbox', { name: 'Código Postal', exact: true }).fill(datos.cp);
    if (datos.familiares.length) {
      await frame.getByRole('button', { name: 'Familiares - 0 de' }).click();
      for (const familiar of datos.familiares) {
        // La grabación sitúa las edades al inicio de los campos nuevos: índices 0, 2, 4.
        const campos = frame.getByRole('spinbutton');
        const antes = await campos.count();
        await frame.getByRole('button', { name: 'add', exact: true }).click();
        const nuevaEdad = campos.nth(antes);
        await nuevaEdad.waitFor({ state: 'visible' });
        await nuevaEdad.fill(familiar.edad);
        const tarjeta = nuevaEdad.locator('xpath=ancestor::*[.//*[normalize-space(.)="Masculino" or normalize-space(.)="Femenino"]][1]');
        await elegirGenero(tarjeta, familiar.genero);
      }
    }
    await frame.getByRole('button', { name: 'Plan - Seguro Médico GNP' }).click();
    async function elegir(actual, destino) {
      if (actual === destino) return;
      await frame.getByText(actual, { exact: true }).click();
      
      const opcion = frame.getByRole('option', {
        name: destino,
        exact: true
      });
      await opcion.waitFor({ state: 'visible' });
      await opcion.focus();
      await page.keyboard.press('Enter');
    }
    await elegir('B', datos.tabulador);
    const pesos = Number(datos.deducible).toLocaleString('en-US') + ' pesos';
    await elegir('21,000 pesos', pesos);
    await elegir('Esencial', datos.acceso);
    const solidez = frame.getByRole('checkbox', { name: 'Solidez Familiar', exact: true });
    if (datos.solidez) {
      await solidez.check();
      if (!(await solidez.isChecked())) throw new Error('No se confirmó Solidez Familiar.');
    } else if (await solidez.isVisible()) {
      if (await solidez.isChecked()) await solidez.uncheck();
    }
    await frame.getByRole('button', { name: 'Coberturas', exact: true }).click();
    await frame.getByRole('checkbox', { name: 'Alta Tecnología y Medicina de' }).setChecked(datos.alta);

    datos.altaVerificadaEnPortal = await frame.getByRole('checkbox', { name: 'Alta Tecnología y Medicina de' }).isChecked();
    if (datos.altaVerificadaEnPortal !== datos.alta) {
      throw new Error('Alta Tecnología cambió después de la captura. Reinicia con la opción que deseas cotizar.');
    }
    await frame.getByRole('button', { name: 'Cotizar', exact: true }).click();

    const format = frame.getByRole('button', {
      name: /Ver\s+Formato de Cotización/
    });
    await format.waitFor({ state: 'visible' });

    // Escuchar antes del clic por si descarga al abrir el formato.
    let espera = page.waitForEvent('download', { timeout: 8000 })
      .catch(() => null);
    await format.click();
    let descarga = await espera;

    if (!descarga) {
      // Activar el botón de descarga identificado en la grabación.
      [descarga] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        frame.locator('#button-DESCARGAR').evaluate(boton => {
          if (boton.disabled ||
              boton.getAttribute('aria-disabled') === 'true') {
            throw new Error('El botón de descarga está deshabilitado.');
          }
          boton.click();
        })
      ]);
    }


    await descarga.saveAs(destino);
    if (await descarga.failure()) throw new Error('No se pudo guardar el PDF descargado de GNP.');
    return datos;
}
async function crearSesion(env=process.env, dependencias={}) {
  if (!env.GNP_USERNAME || !env.GNP_PASSWORD) throw new Error('Faltan GNP_USERNAME o GNP_PASSWORD en Railway.');
  const navegador=dependencias.chromium || chromium;
  const browser=await navegador.launch({headless:true,...(env.CHROMIUM_EXECUTABLE_PATH?{executablePath:env.CHROMIUM_EXECUTABLE_PATH}:{})});
  try {
    const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
    const page=await context.newPage();page.setDefaultTimeout(45000);
    await (dependencias.iniciarSesion || iniciarSesion)(page,env);
    let realizadas=0,cerrada=false;
    return {
      async cotizar(solicitud,destino) {
        if(cerrada)throw new Error('La sesión de cotización está cerrada.');
        if(realizadas>0) {
          // Reiniciar la navegación del portal, conservando contexto, cookies y sesión.
          await page.goto('https://portalintermediarios.gnp.com.mx/sesion',{waitUntil:'domcontentloaded'});
          await page.getByRole('button').filter({hasText:'menu'}).waitFor({state:'visible'});
        }
        realizadas++;
        return (dependencias.cotizarEnPagina || cotizarEnPagina)(page,solicitud,destino);
      },
      async cerrar(){if(!cerrada){cerrada=true;await browser.close();}}
    };
  }catch(e){await browser.close();throw e;}
}
async function cotizar(solicitud,destino,env=process.env) {
  const sesion=await crearSesion(env);
  try{return await sesion.cotizar(solicitud,destino);}finally{await sesion.cerrar();}
}
module.exports={cotizar,iniciarSesion,crearSesion,cotizarEnPagina};
