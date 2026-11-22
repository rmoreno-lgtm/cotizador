const {chromium}=require('playwright');
const {iniciarSesion}=require('../cotizador-gnp.cjs');

const servicios=/^servicios asistid[oa]s?$/i;
const medicos=/^(?:gastos m[eé]dicos mayores|gmm)$/i;
const folio=/^(?:folio(?: (?:del? )?tr[aá]mite)?|(?:n[uú]m(?:ero)?\.?|no\.?) (?:de )?tr[aá]mite)$/i;
const estado=/^(?:estado|estatus)(?: (?:del? )?tr[aá]mite)?$/i;

class ConsultaIncompleta extends Error {}

async function esperar(leer, mensaje) {
  const fin=Date.now()+12000;
  do {
    const resultado=await leer();
    if(resultado)return resultado;
    await new Promise(resolve=>setTimeout(resolve,200));
  } while(Date.now()<fin);
  throw new ConsultaIncompleta(mensaje);
}

function marcosGnp(page) {
  return page.frames().filter(frame=>{
    try {
      const url=new URL(frame.url());
      return url.protocol==='https:' && /(^|\.)gnp\.com\.mx$/i.test(url.hostname);
    } catch {return false;}
  });
}

async function accionUnica(marcos,nombre,roles) {
  const acciones=[];
  for(const marco of marcos) {
    for(const role of roles) {
      for(const loc of await marco.getByRole(role,{name:nombre}).all()) {
        if(await loc.isVisible())acciones.push(loc);
      }
    }
  }
  if(acciones.length>1)throw new ConsultaIncompleta('GNP muestra varias opciones con el mismo nombre.');
  return acciones[0];
}

async function describirMenu(marcos) {
  const opciones=new Set();
  for(const marco of marcos) {
    const elementos=marco.locator('nav a, [role="navigation"] a, [role="menuitem"]');
    for(const elemento of (await elementos.all()).slice(0,60)) {
      if(!await elemento.isVisible())continue;
      const titulo=(await elemento.innerText()).replace(/\s+/g,' ').trim();
      if(/^[\p{L}][\p{L} &()/.-]{2,59}$/u.test(titulo))opciones.add(titulo);
    }
  }
  return [...opciones].slice(0,40);
}

async function leerTabla(marcos) {
  const tablas=[];
  for(const marco of marcos) {
    for(const tabla of await marco.getByRole('table').or(marco.getByRole('grid')).all()) {
      if(!await tabla.isVisible())continue;
      const datos=await tabla.evaluate(elemento=>{
        const filas=[...elemento.querySelectorAll('tr,[role="row"]')].filter(fila=>
          fila.closest('table,[role="table"],[role="grid"]')===elemento && fila.getClientRects().length);
        return filas.map(fila=>[...fila.children].filter(celda=>
          celda.matches('th,td,[role="columnheader"],[role="cell"],[role="gridcell"]'))
          .map(celda=>({encabezado:celda.matches('th,[role="columnheader"]'),texto:celda.innerText.replace(/\s+/g,' ').trim()})));
      });
      const indice=datos.findIndex(fila=>fila.some(c=>c.encabezado && folio.test(c.texto)) &&
        fila.some(c=>c.encabezado && estado.test(c.texto)));
      if(indice<0)continue;
      const columnas=datos[indice].map(c=>c.texto);
      if(columnas.filter(c=>folio.test(c)).length!==1 || columnas.filter(c=>estado.test(c)).length!==1) {
        throw new ConsultaIncompleta('La tabla de GNP tiene columnas de folio o estado duplicadas.');
      }
      const indiceFolio=columnas.findIndex(c=>folio.test(c));
      const indiceEstado=columnas.findIndex(c=>estado.test(c));
      const filas=datos.slice(indice+1).filter(fila=>fila.length);
      const vacia=/^(?:sin (?:registros|resultados|tr[aá]mites)|no (?:se encontraron|hay) (?:registros|resultados|tr[aá]mites))\.?$/i;
      if(filas.some(fila=>fila.length!==columnas.length && !(fila.length===1 && vacia.test(fila[0].texto)))) {
        throw new ConsultaIncompleta('GNP devolvió una fila con una estructura inesperada.');
      }
      const tramites=filas.filter(fila=>fila.length===columnas.length).map(fila=>({
        folio:fila[indiceFolio].texto,estado:fila[indiceEstado].texto
      }));
      if(tramites.some(t=>!/^[\p{L}\p{N}][\p{L}\p{N} ./_-]{0,79}$/u.test(t.folio) || !t.estado)) {
        throw new ConsultaIncompleta('GNP devolvió un folio o estado incompleto.');
      }
      tablas.push({marco,tramites,listo:filas.length>0});
    }
  }
  if(tablas.length>1)throw new ConsultaIncompleta('Hay varias tablas de folios y estados en GNP.');
  return tablas[0];
}

async function elegirGastosMedicos(page) {
  const elegir=await esperar(async()=>{
    const coincidencias=[];
    for(const marco of marcosGnp(page)) {
      for(const select of await marco.locator('select:visible').all()) {
        const opciones=await select.locator('option:not(:disabled)').evaluateAll(opciones=>
          opciones.map(opcion=>opcion.label));
        for(const label of opciones.filter(o=>medicos.test(o.trim().replace(/\s+/g,' ')))) {
          coincidencias.push(()=>select.selectOption({label}));
        }
      }
    }
    const radio=await accionUnica(marcosGnp(page),medicos,['radio']);
    if(radio)coincidencias.push(()=>radio.check());
    if(coincidencias.length>1)throw new ConsultaIncompleta('GNP muestra varias opciones de Gastos Médicos Mayores.');
    if(coincidencias.length)return coincidencias[0];

    const combo=await accionUnica(marcosGnp(page),/^(?:tipo de (?:seguro|servicio|tr[aá]mite|consulta)|ramo|producto|seguro|servicio|selecciona(?:r)?(?: una opci[oó]n)?)$/i,['combobox']);
    if(!combo || await combo.evaluate(el=>el.tagName==='SELECT'))return;
    await combo.click();
    const opcion=await esperar(()=>accionUnica(marcosGnp(page),medicos,['option']),
      'El selector de Consulta no ofrece Gastos Médicos Mayores.');
    return ()=>opcion.click();
  },'No se encontró la opción de Gastos Médicos Mayores en Consulta.');
  await elegir();
}

async function navegarA(page,nombre,etiqueta) {
  const roles=['link','button','menuitem','tab'];
  const opcion=await esperar(()=>accionUnica(marcosGnp(page),nombre,roles),
    `No se encontró la opción «${etiqueta}» en GNP.`);
  await opcion.click();
}

async function recorrer(page, informar=()=>{}) {
  const menu=page.getByRole('button').filter({hasText:/^\s*menu\s*$/i});
  if(await menu.count()===1 && await menu.isVisible())await menu.click();
  const opciones=await describirMenu(marcosGnp(page));
  if(opciones.length)informar('Opciones visibles: '+opciones.join(' · '));

  await navegarA(page,servicios,'Servicios asistidos');
  informar('Servicios asistidos');
  const consulta=/^consulta$/i;
  if(!await accionUnica(marcosGnp(page),consulta,['link','button','menuitem','tab'])) {
    const cerrar=page.getByRole('button').filter({hasText:/^\s*close\s*$/i});
    if(await cerrar.count()===1 && await cerrar.isVisible())await cerrar.click();
  }
  await navegarA(page,consulta,'Consulta');
  informar('Consulta');
  await elegirGastosMedicos(page);
  informar('Gastos Médicos Mayores');

  const consultar=await esperar(()=>accionUnica(marcosGnp(page),/^consultar$/i,['button','link']),
    'No se encontró el botón Consultar para Gastos Médicos Mayores.');
  await consultar.click();
  informar('Consultar');
  let tabla=await esperar(async()=>{
    const datos=await leerTabla(marcosGnp(page));
    if(datos?.listo)return datos;
  },'GNP no mostró filas ni una confirmación de que la búsqueda está vacía.');
  informar('Tabla con columnas Folio y Estado');
  const visitadas=new Set();
  const activos=new Map();
  const vistos=new Map();
  while(true) {
    const firma=JSON.stringify(tabla.tramites);
    if(visitadas.has(firma) || visitadas.size>=100)throw new ConsultaIncompleta('No se pudo confirmar el final de la paginación.');
    visitadas.add(firma);
    for(const tramite of tabla.tramites) {
      const texto=tramite.estado.normalize('NFC').toLowerCase();
      const valor=/^activad[oa]s?$/.test(texto)?'activado':texto;
      if(vistos.has(tramite.folio) && vistos.get(tramite.folio)!==valor) {
        throw new ConsultaIncompleta('GNP muestra estados diferentes para el mismo folio.');
      }
      vistos.set(tramite.folio,valor);
      if(valor==='en proceso' || valor==='activado') {
        activos.set(tramite.folio,{folio:tramite.folio,estado:valor==='en proceso'?'En proceso':'Activado'});
      }
    }
    const siguiente=await accionUnica([tabla.marco],/^(?:p[aá]gina )?siguiente(?: p[aá]gina)?$/i,['link','button']);
    if(!siguiente) {
      const paginacion=await tabla.marco.getByRole('navigation',{name:/paginaci[oó]n|pagination/i}).count();
      if(paginacion)throw new ConsultaIncompleta('GNP muestra controles de paginación sin una opción «Siguiente» reconocible.');
      break;
    }
    if(!await siguiente.isEnabled() ||
      await siguiente.evaluate(el=>Boolean(el.closest('[aria-disabled="true"],.disabled'))))break;
    await siguiente.click();
    tabla=await esperar(async()=>{
      const datos=await leerTabla(marcosGnp(page));
      if(datos?.listo && JSON.stringify(datos.tramites)!==firma)return datos;
    },'La tabla de GNP no avanzó a la siguiente página.');
  }
  return {tramites:[...activos.values()],paginas:visitadas.size};
}

async function consultar(env, informar) {
  const browser=await chromium.launch({headless:true,...(env.CHROMIUM_EXECUTABLE_PATH?{executablePath:env.CHROMIUM_EXECUTABLE_PATH}:{})});
  let iniciada=false;
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:false});
    page.setDefaultTimeout(15000);
    await iniciarSesion(page,env);
    iniciada=true;
    return await recorrer(page,informar);
  } catch(error) {
    if(error instanceof ConsultaIncompleta)throw error;
    throw new ConsultaIncompleta(iniciada?'No se pudo completar la navegación de trámites en GNP.':'No se pudo iniciar sesión en GNP para consultar los trámites.');
  } finally {await browser.close();}
}
module.exports={consultar,recorrer,ConsultaIncompleta};
