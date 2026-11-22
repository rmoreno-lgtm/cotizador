const {chromium}=require('playwright');
const {iniciarSesion}=require('../cotizador-gnp.cjs');

const servicios=/^servicios asistid[oa]s?$/i;
const medicos=/^(?:gastos? m[eé]dicos?(?: mayores)?)$/i;
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

async function accionUnica(ambitos,nombre,roles) {
  const acciones=[];
  for(const ambito of ambitos) {
    for(const role of roles) {
      for(const loc of await ambito.getByRole(role,{name:nombre}).all()) {
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

async function leerTabla(marcos,modo) {
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
      const indice=datos.findIndex(fila=>modo==='vista'
        ? fila.filter(c=>c.encabezado && c.texto).length>=2
        : fila.some(c=>c.encabezado && folio.test(c.texto)) && fila.some(c=>c.encabezado && estado.test(c.texto)));
      if(indice<0)continue;
      const columnas=datos[indice].map(c=>c.texto);
      const vacia=/^(?:sin (?:registros|resultados|tr[aá]mites)|no (?:se encontraron|hay) (?:registros|resultados|tr[aá]mites))\.?$/i;
      const filas=datos.slice(indice+1).filter(fila=>fila.length);
      if(modo==='vista'){
        tablas.push({marco,columnas,listo:filas.length>0,filas:filas
          .filter(fila=>!(fila.length===1 && vacia.test(fila[0].texto)))
          .map(fila=>fila.map(c=>c.texto))});
        continue;
      }
      if(columnas.filter(c=>folio.test(c)).length!==1 || columnas.filter(c=>estado.test(c)).length!==1) {
        throw new ConsultaIncompleta('La tabla de GNP tiene columnas de folio o estado duplicadas.');
      }
      const indiceFolio=columnas.findIndex(c=>folio.test(c));
      const indiceEstado=columnas.findIndex(c=>estado.test(c));
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
  const identificadas=tablas.filter(t=>t.columnas?.some(c=>folio.test(c)) && t.columnas.some(c=>estado.test(c)));
  const candidatas=identificadas.length?identificadas:tablas;
  if(candidatas.length>1)throw new ConsultaIncompleta('GNP muestra varias tablas y no se pudo identificar una sola tabla de trámites.');
  return candidatas[0];
}

const rolesNavegacion=['link','button','menuitem','tab','treeitem'];

async function opcionVisible(ambitos,nombre) {
  const accion=await accionUnica(ambitos,nombre,rolesNavegacion);
  if(accion)return accion;
  const visibles=[];
  for(const ambito of ambitos) {
    for(const texto of await ambito.getByText(nombre).all()) {
      if(await texto.isVisible())visibles.push(texto);
    }
  }
  if(visibles.length>1)throw new ConsultaIncompleta('GNP muestra varias opciones con el mismo nombre.');
  return visibles[0];
}

async function consultaGastosMedicos(marcos) {
  const acciones=[];
  for(const marco of marcos) {
    for(const titulo of await marco.getByText(medicos).all()) {
      if(!await titulo.isVisible())continue;
      let tarjeta=titulo;
      for(let nivel=0;nivel<6;nivel++){
        tarjeta=tarjeta.locator('..');
        if(await tarjeta.evaluate(el=>el.matches('html,body,main,[role="main"]')))break;
        const consulta=await opcionVisible([tarjeta],/^consulta$/i);
        if(consulta){acciones.push(consulta);break;}
      }
    }
  }
  if(acciones.length>1)throw new ConsultaIncompleta('GNP muestra varias tarjetas de Gastos Médicos con Consulta.');
  return acciones[0];
}

async function recorrer(page, informar=()=>{}, modo='reporte') {
  const contexto=page.context();
  const pestañasPrevias=new Set(contexto.pages().filter(p=>p!==page));
  const marcosDisponibles=()=>contexto.pages().filter(p=>!pestañasPrevias.has(p)).flatMap(marcosGnp);
  if(!await accionUnica(marcosDisponibles(),servicios,rolesNavegacion)) {
    const menu=page.getByRole('button').filter({hasText:/^\s*menu\s*$/i});
    if(await menu.count()===1 && await menu.isVisible())await menu.click();
  }
  const opciones=await describirMenu(marcosDisponibles());
  if(opciones.length)informar('Opciones visibles: '+opciones.join(' · '));

  const servicio=await esperar(()=>opcionVisible(marcosDisponibles(),servicios),
    'No se encontró «Servicios asistidos» desde el inicio de GNP.');
  await servicio.click();
  informar('Servicios asistidos');

  const cerrar=page.getByRole('button').filter({hasText:/^\s*close\s*$/i});
  if(!page.isClosed() && await cerrar.count()===1 && await cerrar.isVisible())await cerrar.click();
  for(const [nombre,etiqueta] of [[/^gmm$/i,'GMM'],[medicos,'Gastos Médicos']]) {
    const opcion=await esperar(()=>opcionVisible(marcosDisponibles(),nombre),
      `No se encontró «${etiqueta}» en la ruta de Servicios asistidos.`);
    await opcion.click();
    informar(etiqueta);
  }

  const consulta=await esperar(async()=>{
    const marcos=marcosDisponibles();
    return await consultaGastosMedicos(marcos) || await opcionVisible(marcos,/^consulta$/i);
  },'No se encontró «Consulta» después de abrir Gastos Médicos.');
  const paginaConsulta=consulta.page();
  const otrasPestanas=new Set(contexto.pages().filter(p=>p!==paginaConsulta));
  await consulta.click();
  informar('Consulta');
  let tabla=await esperar(async()=>{
    const marcos=contexto.pages().filter(p=>!otrasPestanas.has(p)).flatMap(marcosGnp);
    const datos=await leerTabla(marcos,modo);
    if(datos?.listo)return datos;
  },'Consulta no mostró una tabla reconocible con filas o un mensaje de que no hay trámites.');
  informar('Tabla de Consulta');
  if(modo==='vista')return {columnas:tabla.columnas,filas:tabla.filas};
  const paginaResultados=tabla.marco.page();
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
      const datos=await leerTabla(marcosGnp(paginaResultados));
      if(datos?.listo && JSON.stringify(datos.tramites)!==firma)return datos;
    },'La tabla de GNP no avanzó a la siguiente página.');
  }
  return {tramites:[...activos.values()],paginas:visitadas.size};
}

async function consultar(env, informar, modo) {
  const browser=await chromium.launch({headless:true,...(env.CHROMIUM_EXECUTABLE_PATH?{executablePath:env.CHROMIUM_EXECUTABLE_PATH}:{})});
  let iniciada=false;
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:false});
    page.setDefaultTimeout(15000);
    await iniciarSesion(page,env);
    iniciada=true;
    return await recorrer(page,informar,modo);
  } catch(error) {
    if(error instanceof ConsultaIncompleta)throw error;
    throw new ConsultaIncompleta(iniciada?'No se pudo completar la navegación de trámites en GNP.':'No se pudo iniciar sesión en GNP para consultar los trámites.');
  } finally {await browser.close();}
}
module.exports={consultar,recorrer,ConsultaIncompleta};
