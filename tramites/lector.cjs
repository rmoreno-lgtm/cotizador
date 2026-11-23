// Lectura de Servicios asistidos en el portal de intermediarios de GNP (solo lectura).
// Ruta relevada el 22-nov-2026:
//   /home/servicios → pestaña (Vida | GMM) → INDIVIDUALES → (Vida | Gastos Médicos) → Consulta
//   La tabla carga en un iframe: wf-da-busqueda.gnp.com.mx (GMM) o wf-dasvida.gnp.com.mx (Vida).
//   En GMM, doble clic en la OT abre el detalle (wf-da.gnp.com.mx) con «Observaciones Portal».
// Nunca se pulsan Agregar, Turnar ni Salir.
const {chromium}=require('playwright');
const {iniciarSesion}=require('../cotizador-gnp.cjs');
const {ConsultaIncompleta}=require('./portal.cjs');
const {esAbierto,normalizar}=require('./reglas.cjs');

const PORTAL='https://portalintermediarios.gnp.com.mx';
const MARCOS={gmm:/^https:\/\/wf-da-busqueda\.gnp\.com\.mx\//,vida:/^https:\/\/wf-dasvida\.gnp\.com\.mx\//};
const DETALLE=/^https:\/\/wf-da\.gnp\.com\.mx\//;
const MAX_DETALLES=30;

const pausa=ms=>new Promise(r=>setTimeout(r,ms));
async function esperar(leer,mensaje,ms=20000) {
  const fin=Date.now()+ms;
  do {
    const r=await leer().catch(error=>{if(error instanceof ConsultaIncompleta)throw error;return null;});
    if(r)return r;
    await pausa(300);
  } while(Date.now()<fin);
  throw new ConsultaIncompleta(mensaje);
}

// «12/10/2026 12:43:59 hrs.» · «2026/11/13» · «2026-11-13» → «2026-10-12»
function fechaIso(valor) {
  const v=String(valor || '').trim();
  let m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  m=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(v);
  if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  return '';
}
const limpio=v=>{const t=String(v ?? '').replace(/\s+/g,' ').trim();return t==='-'?'':t;};

// Convierte una fila (encabezados + celdas) en un trámite con nombres estables.
function mapearFila(seccion,encabezados,celdas) {
  const c={};
  encabezados.forEach((h,i)=>{c[normalizar(h)]=celdas[i];});
  const col=(...nombres)=>{for(const n of nombres){const v=c[normalizar(n)];if(v!==undefined)return limpio(v);}return '';};
  if(seccion==='gmm'){
    return {
      ot:col('OT'),usuarioCreador:col('Usuario Creador'),estatus:col('Estatus'),
      fechaCompromiso:col('Fecha Compromiso'),poliza:col('Póliza'),agente:col('Agente'),
      contratante:col('Contratante'),tipo:col('Tipo de Solicitud'),producto:col('Producto'),
      fechaRegistro:fechaIso(col('Fecha de registro')),primerIngreso:col('Primer Ingreso a GNP'),
      ultimoIngreso:col('Último Ingreso a GNP')
    };
  }
  return {
    ot:col('OT'),estatus:col('Estatus'),tipo:col('Tipo de solicitud'),fechaCompromiso:col('Fecha compromiso'),
    poliza:col('Póliza'),agente:'',nombreAgente:col('Nombre agente'),contratante:col('Nombre del contratante'),
    area:col('Área'),producto:col('Producto'),
    fechaRegistro:fechaIso(col('Fecha y hora de primer ingreso')),primerIngreso:col('Fecha y hora de primer ingreso'),
    ultimoIngreso:col('Fecha y hora del último ingreso')
  };
}

// Lee el texto del detalle de una OT (GMM) y extrae observaciones, tipo de movimiento y documentos.
function leerDetalle(texto) {
  const lineas=String(texto).split('\n').map(l=>l.replace(/\t+/g,' ').trim());
  const i=lineas.findIndex(l=>/^tipo de movimiento$/i.test(l));
  let tipoMovimiento='';
  for(let j=i-1;i>0 && j>=0;j--){if(lineas[j]){tipoMovimiento=lineas[j];break;}}
  const inicio=texto.search(/Observaciones Portal/i);
  const fin=texto.search(/Expediente Digital/i);
  const bloque=inicio>=0?texto.slice(inicio+'Observaciones Portal'.length,fin>inicio?fin:undefined):'';
  const observaciones=[];
  const patron=/\(INTRODUCIDO POR (.+?) - (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) hrs\)/g;
  const marcas=[...bloque.matchAll(patron)];
  marcas.forEach((m,k)=>{
    const desde=m.index+m[0].length;
    const hasta=k+1<marcas.length?marcas[k+1].index:bloque.length;
    const cuerpo=bloque.slice(desde,hasta).split('\n').map(l=>l.trim()).filter(Boolean).join('\n');
    observaciones.push({autor:m[1].trim(),fecha:m[2],texto:cuerpo});
  });
  const docsInicio=lineas.findIndex(l=>/^documentos adjuntos$/i.test(l));
  const documentos=[];
  if(docsInicio>=0){
    for(const l of lineas.slice(docsInicio+1)){
      if(/^(turnar|salir|copyright)/i.test(l))break;
      const m=/^(.+?)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/.exec(l);
      if(m)documentos.push({nombre:m[1].trim(),fecha:m[2]});
    }
  }
  return {tipoMovimiento,observaciones,documentos};
}

function marcoDe(page,seccion) {
  return page.frames().find(f=>MARCOS[seccion].test(f.url()));
}

// Abre Servicios asistidos → ramo → INDIVIDUALES → Consulta y devuelve el iframe de la consulta.
// El portal usa pestañas de Angular Material solo con íconos (orden: Vida, GMM, Autos, Daños) y
// tarjetas con identificadores fijos: sera_gmm_ind_gm → sera_gmm_ind_consulta, sera_vid_ind_vida → sera_vid_ind_vidaconsulta.
const RUTAS={
  gmm:{pestana:1,tarjeta:'sera_gmm_ind_gm',consulta:'sera_gmm_ind_consulta',nombre:'Gastos Médicos'},
  vida:{pestana:0,tarjeta:'sera_vid_ind_vida',consulta:'sera_vid_ind_vidaconsulta',nombre:'Vida'}
};
async function abrirConsulta(page,seccion,informar) {
  const ruta=RUTAS[seccion];
  await page.goto(PORTAL+'/home/servicios',{waitUntil:'domcontentloaded'});
  const pestanas=page.locator('.mat-mdc-tab-labels [role="tab"], .mat-mdc-tab-labels .mat-mdc-tab');
  await esperar(async()=>await pestanas.count()>=4,'No se encontraron las pestañas de Servicios asistidos.');
  informar('Servicios asistidos');
  const pestana=pestanas.nth(ruta.pestana);
  if(!/mdc-tab--active/.test(await pestana.getAttribute('class') || ''))await pestana.click();
  await esperar(async()=>/mdc-tab--active/.test(await pestana.getAttribute('class') || ''),'No se abrió la pestaña '+seccion.toUpperCase()+'.');
  informar(seccion==='gmm'?'GMM':'Vida');
  const tarjeta=page.locator('mat-card#'+ruta.tarjeta);
  await esperar(async()=>await tarjeta.isVisible(),'No apareció la tarjeta '+ruta.nombre+' de INDIVIDUALES.');
  await tarjeta.click();
  informar(ruta.nombre);
  // El menú se abre en una capa flotante; se busca por id y, si cambia, por el texto «Consulta» dentro del menú.
  const porId=page.locator('mat-list-item#'+ruta.consulta+', [id="'+ruta.consulta+'"]').filter({visible:true}).first();
  const enMenu=page.locator('.cdk-overlay-container .mat-mdc-menu-panel').getByText(/^\s*Consulta\s*$/).filter({visible:true}).first();
  const consulta=await esperar(async()=>{
    if(await porId.count())return porId;
    if(await enMenu.count())return enMenu;
  },'No apareció la opción Consulta de '+ruta.nombre+'.');
  await consulta.click();
  informar('Consulta');
  const marco=await esperar(async()=>{
    const f=marcoDe(page,seccion);
    if(f && await f.locator('table, [role="table"], [role="grid"]').count())return f;
  },'La consulta de GNP no cargó su tabla.',30000);
  return marco;
}

// Elige una opción de un mat-select de Angular Material dentro del iframe.
async function elegir(marco,etiqueta,opcion) {
  // El selector correcto es el que está en el mismo bloque que la etiqueta (p. ej. «Estatus»),
  // descartando bloques que también tengan otras etiquetas (Vida tiene «Tipo de consulta» al lado).
  const indice=await marco.evaluate(nombre=>{
    const todos=[...document.querySelectorAll('mat-select')];
    for(let nivel=1;nivel<=5;nivel++){
      const encontrados=todos.map((s,i)=>{
        let n=s;for(let k=0;k<nivel && n.parentElement;k++)n=n.parentElement;
        const txt=n.innerText || '';
        return new RegExp(nombre,'i').test(txt) && n.querySelectorAll('mat-select').length===1?i:-1;
      }).filter(i=>i>=0);
      if(encontrados.length===1)return encontrados[0];
    }
    return todos.length===1?0:-1;
  },etiqueta);
  if(indice<0)throw new ConsultaIncompleta('No se encontró el filtro «'+etiqueta+'» en la consulta de GNP.');
  const selector=marco.locator('mat-select').nth(indice);
  await selector.click();
  const op=marco.getByRole('option',{name:new RegExp('^\\s*'+opcion.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','i')});
  await op.first().click();
  await marco.locator('.cdk-overlay-backdrop').click({timeout:1000}).catch(()=>{});
}

async function filasVisibles(marco) {
  return await marco.evaluate(()=>{
    const tabla=document.querySelector('table, [role="table"], [role="grid"]');
    if(!tabla)return null;
    const encabezados=[...tabla.querySelectorAll('th, [role="columnheader"]')].map(e=>e.innerText.replace(/Use left or right key.*$/is,'').replace(/\s+/g,' ').trim());
    const filas=[...tabla.querySelectorAll('tr, [role="row"]')]
      .map(r=>[...r.querySelectorAll('td, [role="gridcell"], [role="cell"]')].map(c=>c.innerText.replace(/\s+/g,' ').trim()))
      .filter(c=>c.length>=5);
    return {encabezados,filas};
  });
}

async function siguientePagina(marco) {
  return await marco.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/next page|p[aá]gina siguiente|siguiente/i.test(x.getAttribute('aria-label') || '') ||
      /^(chevron_right|navigate_next|keyboard_arrow_right)$/.test((x.innerText || '').trim()));
    if(!b || b.disabled || b.getAttribute('aria-disabled')==='true' || b.classList.contains('mat-button-disabled'))return false;
    b.click();return true;
  });
}

// Ejecuta la búsqueda y lee todas las páginas.
async function buscarYLeer(marco,seccion,fechaDesde,informar,estatus='Todas') {
  if(seccion==='gmm'){
    await elegir(marco,'Estatus',estatus);
    if(fechaDesde){
      const [a,m,d]=fechaDesde.split('-');
      const campo=marco.getByLabel(/^Fecha Inicial$/); // la «Consulta avanzada» tiene otro «Fecha inicial *»
      // En GNP este campo suele ser de solo lectura (se elige con el calendario). Si no se puede escribir,
      // se deja el rango por defecto (1 de enero a hoy) y el filtro «desde» se aplica al leer los trámites.
      if(await campo.count()===1 && await campo.isEditable({timeout:1000}).catch(()=>false)){
        await campo.fill(Number(d)+'/'+Number(m)+'/'+a,{timeout:5000}).catch(()=>{});
        await campo.press('Tab',{timeout:2000}).catch(()=>{});
      }
    }
  } else {
    await elegir(marco,'Estatus','TODAS');
  }
  await marco.getByRole('button',{name:/^\s*buscar\s*$/i}).first().click();
  informar('Búsqueda');
  // Esperar a que la tabla se estabilice.
  let previo='';
  await esperar(async()=>{
    const d=await filasVisibles(marco);
    const firma=JSON.stringify(d);
    const listo=firma===previo && d;
    previo=firma;
    await pausa(700);
    return listo;
  },'La tabla de GNP no terminó de cargar.',30000);
  const vistos=new Map();
  let encabezados=[];
  for(let pagina=0;pagina<60;pagina++){
    const d=await filasVisibles(marco);
    encabezados=d.encabezados;
    let nuevos=0;
    for(const celdas of d.filas){
      const t=mapearFila(seccion,encabezados,celdas);
      if(t.ot && !vistos.has(t.ot)){vistos.set(t.ot,t);nuevos++;}
    }
    if(!nuevos && pagina>0)break;
    const firma=JSON.stringify(d.filas[0] || []);
    if(!await siguientePagina(marco))break;
    await esperar(async()=>{const n=await filasVisibles(marco);return n && JSON.stringify(n.filas[0] || [])!==firma;},'La tabla no avanzó de página.',15000)
      .catch(()=>null);
  }
  informar(vistos.size+' trámites leídos');
  return [...vistos.values()];
}

// Abre el detalle de una OT (doble clic), lo lee y regresa a la consulta.
// El detalle puede abrirse dentro del mismo iframe o en una ventana nueva; se contemplan ambos casos.
async function leerObservaciones(page,marco,ot) {
  const contexto=page.context();
  const ventanasAntes=new Set(contexto.pages());
  const celda=marco.getByRole('gridcell',{name:ot,exact:true}).or(marco.locator('td').filter({hasText:new RegExp('^\\s*'+ot+'\\s*$')})).first();
  await celda.dblclick();
  // Se espera a que el detalle termine de cargar: debe mostrar la OT y el expediente, y el texto
  // debe quedarse igual al menos 1.5 s (las observaciones llegan después del resto de la pantalla).
  let previo='';
  const inicio=Date.now();
  const encontrado=await esperar(async()=>{
    for(const p of contexto.pages()){
      const f=p.frames().find(x=>DETALLE.test(x.url()) && x.url().includes('orden_id='+ot));
      if(!f)continue;
      const texto=await f.evaluate(()=>document.body.innerText).catch(()=>'');
      // Listo cuando ya hay observaciones cargadas; si el trámite no tiene ninguna, se acepta tras 20 s estable.
      const listo=texto.includes(ot) && /Observaciones Portal/i.test(texto) && /Expediente Digital/i.test(texto) &&
        (/INTRODUCIDO POR/.test(texto) || Date.now()-inicio>20000);
      if(listo && texto===previo)return {f,p,texto};
      previo=listo?texto:'';
      await pausa(1500);
    }
  },'No se abrió el detalle de la OT '+ot+'.',60000);
  const texto=encontrado.texto;
  if(!ventanasAntes.has(encontrado.p))await encontrado.p.close();
  return leerDetalle(texto);
}

// Lee las secciones pedidas. pedidos: {gmm:{fechaDesde,observaciones:boolean}, vida:{fechaDesde}}
const primeraLinea=error=>String(error?.message || error || '').split('\n')[0].replace(/https?:\/\/\S+/g,'[url]').slice(0,180);

// Lee las secciones pedidas. pedidos: {gmm:{fechaDesde,observaciones:boolean}, vida:{fechaDesde}}
// opciones.captura: ruta donde guardar una captura de pantalla si algo falla.
async function leerSecciones(env,pedidos,informarFuera=()=>{},opciones={}) {
  const browser=await chromium.launch({headless:true,...(env.CHROMIUM_EXECUTABLE_PATH?{executablePath:env.CHROMIUM_EXECUTABLE_PATH}:{})});
  const resultado={};
  let paso='inicio';
  const informar=texto=>{paso=texto;informarFuera(texto);};
  let page;
  const capturar=async()=>{
    if(!opciones.captura || !page)return;
    await page.screenshot({path:opciones.captura,fullPage:true,timeout:10000}).catch(()=>{});
  };
  try {
    const contexto=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:false,locale:'es-MX',timezoneId:'America/Monterrey'});
    page=await contexto.newPage();
    page.setDefaultTimeout(20000);
    try {await iniciarSesion(page,env);}
    catch {await capturar();throw new ConsultaIncompleta('No se pudo iniciar sesión en GNP (credenciales, reCAPTCHA o cambio en la pantalla de acceso).');}
    informar('Sesión iniciada');
    for(const [seccion,pedido] of Object.entries(pedidos)){
      try {
        let marco=await abrirConsulta(page,seccion,informar);
        let tramites=await buscarYLeer(marco,seccion,pedido.fechaDesde,informar);
        const avisosLectura=[];
        // En GMM, la búsqueda «Todas» de GNP no incluye los trámites «En Registro»: se buscan aparte.
        const enTabla=new Set(tramites.map(t=>t.ot));
        if(seccion==='gmm'){
          try {
            const registro=await buscarYLeer(marco,'gmm',pedido.fechaDesde,informar,'En Registro');
            tramites=tramites.concat(registro.filter(t=>!enTabla.has(t.ot)));
            await buscarYLeer(marco,'gmm',pedido.fechaDesde,()=>{});
          } catch(error) {
            avisosLectura.push('No se pudieron leer los trámites En Registro: '+primeraLinea(error));
            marco=await abrirConsulta(page,'gmm',()=>{});
            await buscarYLeer(marco,'gmm',pedido.fechaDesde,()=>{});
          }
        }
        if(seccion==='gmm' && pedido.observaciones){
          const abiertos=tramites.filter(t=>enTabla.has(t.ot)).filter(t=>esAbierto('gmm',t.estatus) && (!pedido.fechaDesde || !t.fechaRegistro || t.fechaRegistro>=pedido.fechaDesde)).slice(0,MAX_DETALLES);
          let fallas=0;
          for(const t of abiertos){
            if(fallas>=2){avisosLectura.push('Se omitieron observaciones restantes tras 2 fallas.');break;}
            try {
              informar('Observaciones de '+t.ot);
              Object.assign(t,await leerObservaciones(page,marco,t.ot));
              // Para volver a la tabla se reabre la consulta desde el menú (más confiable que «atrás»).
              marco=await abrirConsulta(page,'gmm',()=>{});
              await buscarYLeer(marco,'gmm',pedido.fechaDesde,()=>{});
            } catch(error) {
              fallas++;
              if(fallas===1)await capturar();
              avisosLectura.push('No se leyeron las observaciones de '+t.ot+': '+primeraLinea(error));
              try {
                marco=await abrirConsulta(page,'gmm',()=>{});
                await buscarYLeer(marco,'gmm',pedido.fechaDesde,()=>{});
              } catch {break;}
            }
          }
          informar('Observaciones leídas');
        }
        resultado[seccion]={ok:true,tramites,advertencias:avisosLectura};
      } catch(error) {
        await capturar();
        const base=error instanceof ConsultaIncompleta?error.message:'No se pudo leer '+seccion.toUpperCase()+' en GNP.';
        resultado[seccion]={ok:false,error:base+' Último paso: '+paso+'.'+(error instanceof ConsultaIncompleta?'':' Detalle: '+primeraLinea(error))};
      }
    }
    return resultado;
  } finally {await browser.close();}
}

module.exports={leerSecciones,leerDetalle,mapearFila,fechaIso};
