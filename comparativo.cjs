const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {dinero,calculo,leerPdf}=require('./leer-gnp.cjs');
const {html}=require('./integracion.cjs');
function validarComparacion(datos) {
  if(datos.length<2 || datos.length>3)throw new Error('Se requieren dos o tres cotizaciones verificadas.');
  const base=datos[0];
  for(const d of datos) {
    if(JSON.stringify(d.asegurados)!==JSON.stringify(base.asegurados) || d.nombre!==base.nombre || d.plan!==base.plan || d.acceso!==base.acceso || d.suma!==base.suma || d.altaSolicitada!==base.altaSolicitada || d.solidezSolicitada!==base.solidezSolicitada || JSON.stringify(d.coberturas)!==JSON.stringify(base.coberturas) || JSON.stringify(d.asistencias)!==JSON.stringify(base.asistencias) || d.altaConfirmada!==base.altaConfirmada)throw new Error('Las cotizaciones no tienen el mismo perfil y coberturas comunes. Requieren revisión.');
    if(!d.niveles.some(n=>n.nivel==='A') || !d.niveles.some(n=>n.nivel==='B'))throw new Error('Faltan niveles hospitalarios para comparar.');
  }
}
function cambiosOpcion(base,d) {
  const diferencias=[];
  if(d.niveles.find(n=>n.nivel==='A').deducible!==base.niveles.find(n=>n.nivel==='A').deducible)diferencias.push('deducible');
  if(d.tabulador!==base.tabulador)diferencias.push('tabulador médico');
  return diferencias;
}
function documentoComparativo(logo,qr,{opciones:ds}) {
  validarComparacion(ds);
  const {crearVista}=require('./integracion.cjs');
  const base=ds[0],v=crearVista(base),precio=x=>'$'+dinero(x,true),nivel=(d,n)=>d.niveles.find(x=>x.nivel===n);
  const estilo=require('node:fs').readFileSync(path.join(__dirname,'comparativo-estilo.css'),'utf8');
  const encabezado=`<header><img class="logo" src="${logo}" alt="QUILLUM Seguros y Fianzas"><div class="insurer">PROPUESTA COMPARATIVA<br><b>Aseguradora: GNP</b><br>Seguro Médico ${html(base.plan)}</div></header>`;
  const pie=n=>`<footer>QUILLUM · Folios GNP ${ds.map(d=>html(d.folio)).join(' / ')} · Propuesta informativa<span>${n} / 4</span></footer>`;
  const tabla=filas=>`<table class="compare-table"><thead><tr><th>Concepto</th>${ds.map((_,i)=>'<th>Opción '+(i+1)+'</th>').join('')}</tr></thead><tbody>${filas.map(([titulo,fn,resaltar])=>`<tr${titulo==='Tu participación total'?' class="total-participacion"':''}><td>`+titulo+'</td>'+ds.map((d,i)=>`<td${i&&resaltar&&resaltar(d)?' class="changed"':''}>`+fn(d)+'</td>').join('')+'</tr>').join('')}</tbody></table>`;
  const cambioPrima=d=>{
    const delta=d.monto.total-base.monto.total;
    return delta===0?'Misma prima anual que opción 1.':`${precio(Math.abs(delta))} ${delta<0?'menos':'más'} al año que opción 1.`;
  };
  const tarjetas=ds.map((d,i)=>{
    const cambios=cambiosOpcion(base,d);
    const etiqueta=i===0?'Opción de referencia':cambios.length?'Cambia '+cambios.join(' y '):'Mismo deducible y tabulador';
    return `<div class="option"><h3>OPCIÓN ${i+1}</h3><span class="change">${etiqueta}</span><strong>${precio(d.monto.total)}</strong><p>Inversión anual total · MXN</p><p><b>Deducible base:</b> ${precio(nivel(d,'A').deducible)}<br><b>Tabulador médico:</b> ${html(d.tabulador)}</p>${i?'<p>'+cambioPrima(d)+'</p>':'<p>Las diferencias de las otras opciones se muestran respecto a esta configuración.</p>'}</div>`;
  }).join('');
  const gasto=Math.max(20000000,...ds.flatMap(d=>['A','B'].map(n=>nivel(d,n).deducible+10000000)));
  const diferenciaParticipacion=(d,n)=>{
    const delta=calculo(gasto,nivel(d,n)).total-calculo(gasto,nivel(base,n)).total;
    return delta===0?'Misma participación':precio(Math.abs(delta))+(delta<0?' menos':' más');
  };
  const ejemplo=n=>`<h2>Mismo gasto en nivel hospitalario ${n}</h2>`+tabla([
    ['1. Deducible a tu cargo',d=>precio(calculo(gasto,nivel(d,n)).deducible),d=>nivel(d,n).deducible!==nivel(base,n).deducible],
    ['2. Gasto restante',d=>precio(calculo(gasto,nivel(d,n)).base)],
    ['3. Coaseguro / tope',d=>nivel(d,n).porcentaje+'% / '+precio(nivel(d,n).tope)],
    ['Coaseguro a tu cargo',d=>precio(calculo(gasto,nivel(d,n)).coaseguro)],
    ['Tu participación total',d=>precio(calculo(gasto,nivel(d,n)).total)],
    ['Frente a opción 1',d=>d===base?'Referencia':diferenciaParticipacion(d,n)]
  ]);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Comparativo QUILLUM</title><style>${estilo}</style><body>
<section class="page">${encabezado}<div class="eyebrow">01 / PROTECCIÓN Y ACOMPAÑAMIENTO</div>
<h1>Tu protección médica,<br>con el respaldo de QUILLUM.</h1><p>Preparada para <b>${html(base.nombre)}</b>.<br>${v.perfilHtml}</p>
${v.beneficiosHtml}
<div class="row"><div class="card"><h3>Suma asegurada básica</h3><strong>${precio(base.suma)}</strong><p>Por año póliza, por asegurado.</p></div><div class="card"><h3>Protección en todas las opciones</h3><strong>Acceso ${html(base.acceso)}</strong><p>Mismos asegurados y coberturas comunes. Comparamos deducibles y tabuladores.</p></div></div>
<h2>También te acompaña en el día a día</h2><div class="row asistencias"><div class="card"><h3>Asistencia dental</h3><p>${v.dentalHtml}</p></div><div class="card"><h3>Apoyo psicológico</h3><p>${v.psicologicaHtml}</p></div><div class="card"><h3>Médica Móvil</h3><p>${v.movilHtml}</p></div></div><p class="small">Aplican condiciones, disponibilidad y alcance de cada servicio.</p>
<div class="strip"><h3>El respaldo de QUILLUM, cuando más lo necesitas</h3><p>Te acompañamos en la programación de cirugías, la gestión de reembolsos y el seguimiento durante tu hospitalización.</p></div>
<h2>Una misma protección, distintas formas de participar</h2><p>En las siguientes páginas encontrarás ${ds.length} opciones, sus diferencias de precio y ejemplos de lo que pagarías al usar tu seguro.</p>${pie(1)}</section>
<section class="page">${encabezado}<div class="eyebrow">02 / ELIGE TU CONFIGURACIÓN</div><h1>¿Qué cambia entre tus opciones?</h1><p>Cada opción adicional se compara con la opción 1. Los campos resaltados en naranja muestran cambios.</p><div class="options">${tarjetas}</div>
${tabla([
 ['Deducible base · nivel A',d=>precio(nivel(d,'A').deducible),d=>nivel(d,'A').deducible!==nivel(base,'A').deducible],
 ['Tabulador médico',d=>html(d.tabulador),d=>d.tabulador!==base.tabulador],
 ['Acceso hospitalario',d=>html(d.acceso)],['Folio GNP',d=>html(d.folio)],['Válida hasta',d=>html(d.vence)]
])}
<div class="strip"><h3>Si cambia el deducible</h3><p>Cambia la cantidad inicial que asumes en una enfermedad cubierta. Un deducible mayor puede reducir la prima, pero el precio mostrado es el que cotizó GNP.</p></div>
<div class="strip"><h3>Si cambia el tabulador médico</h3><p>Cambian los límites de honorarios médicos reconocidos por GNP. No es el nivel hospitalario A–D. Confirma si los honorarios de tu médico están dentro del tabulador elegido.</p></div><p class="small">Las primas anuales incluyen los conceptos reflejados en cada PDF original de GNP. Ninguna opción se presenta como la mejor para todos: revisa tu presupuesto y médicos de preferencia.</p>${pie(2)}</section>
<section class="page participation">${encabezado}<div class="eyebrow">03 / CUÁNTO PARTICIPARÍAS AL USAR TU SEGURO</div><h1>El mismo gasto,<br>distintas participaciones.</h1><p>Ejemplo con <b>${precio(gasto)}</b> de gastos cubiertos y reconocidos en cada opción.</p><p class="small"><b>Tu participación = deducible + coaseguro.</b> El coaseguro se calcula sobre el gasto restante y se limita al tope del nivel hospitalario.</p>${ejemplo('A')}${ejemplo('B')}
<p class="difference">Si solo cambia el tabulador y la tabla de deducible y coaseguro es igual, este ejemplo muestra la misma participación. La diferencia de honorarios médicos se revisa aparte con el médico y GNP.</p><p class="small">Ejemplo para una enfermedad cubierta, sin deducible previamente pagado. Considera gastos reconocidos; diferencias de honorarios y gastos no cubiertos se pagan aparte. La prima anual es el precio del seguro y no está incluida en la participación de este ejemplo. Aplican condiciones de GNP.</p>${pie(3)}</section>
<section class="page">${encabezado}<div class="eyebrow">04 / TU PLAN Y EL SERVICIO DE TU DESPACHO</div><h1>Respaldo para tu salud.<br>Acompañamiento para ti.</h1><h2>Coberturas descritas en tus cotizaciones</h2><p>La cobertura básica contempla diagnóstico, honorarios médicos, hospitalización, cirugía, medicamentos y rehabilitación, conforme a condiciones y límites.</p><div class="card"><h3>Adicionales expresamente descritos por GNP</h3><p>${v.adicionalesHtml}</p></div><p class="small">${v.altaHtml}</p><h2>El respaldo de QUILLUM</h2><p>Te acompañamos en la programación de cirugías, la gestión de reembolsos y el seguimiento durante tu hospitalización.</p><p>Contamos con convenios con <b>Grupo Muguerza, Grupo Auna, Grupo Ángeles y Hospitaria, entre otros</b>, que nos permiten coordinar la atención y facilitar la gestión de trámites.</p><p class="small">El acceso y la cobertura están sujetos al plan contratado, al hospital y a la autorización de GNP. Los convenios del despacho no amplían la cobertura de la póliza.</p><div class="contact"><img src="${qr}" alt="QR de WhatsApp"><div><h3>Revisemos juntos tus opciones</h3><p>Escanea el QR o pulsa el número.</p><a href="https://wa.me/528180202414">81 80 20 24 14</a></div></div><p class="small">Antes de contratar, confirma hospitales, coberturas, exclusiones y periodos de espera. Conserva los originales de GNP junto con este comparativo; es informativo y no es una póliza. La aceptación, tarifa y alcance están sujetos a suscripción y condiciones contractuales.</p>${pie(4)}</section></body></html>`;
}
async function ejecutarComparativo(job,dir,{env,logoPath,cotizar,crearSesion,leer,generar}={}) {
  crearSesion=crearSesion||require('./cotizador-gnp.cjs').crearSesion;leer=leer||leerPdf;generar=generar||require('./propuesta.cjs').generarPropuesta;
  const resultados=[];let sesion;
  try {
  for(const [i,o] of job.solicitud.opciones.entries()) {
    const carpeta=path.join(dir,'opcion-'+(i+1));await fs.mkdir(carpeta,{recursive:true});
    const pdf=path.join(carpeta,'gnp.pdf');const s={...job.solicitud,...o};delete s.opciones;delete s.modalidad;
    try {
      let verificada,datosGuardados;
      try {
        const previa=JSON.parse(await fs.readFile(path.join(carpeta,'solicitud.json'),'utf8'));
        const registro=JSON.parse(await fs.readFile(path.join(carpeta,'verificado.json'),'utf8'));
        const {solicitud}=require('./solicitud.cjs');
        const stat=await fs.stat(pdf);
        const hash=crypto.createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
        if(JSON.stringify(solicitud(previa))===JSON.stringify(solicitud(s)) && registro.fuente?.sha256===hash && Date.now()-stat.mtimeMs<3600000) {
          datosGuardados=await leer(pdf,previa);verificada=previa;
        }
      }catch{}
      if(!datosGuardados) {
        console.log('Comparativo: cotizando opción '+(i+1)+' de '+job.solicitud.opciones.length+' en sesión compartida.');
        if(!cotizar && !sesion)sesion=await crearSesion(env);
        verificada=await (cotizar?cotizar(s,pdf,env):sesion.cotizar(s,pdf));
      }
      await fs.writeFile(path.join(carpeta,'solicitud.json'),JSON.stringify(verificada,null,2));
      if(datosGuardados)console.log('Comparativo: reutilizando PDF verificado de opción '+(i+1)+'.');
      const datos=datosGuardados || await leer(pdf,verificada);
      datos.fuente={sha256:crypto.createHash('sha256').update(await fs.readFile(pdf)).digest('hex')};
      await fs.writeFile(path.join(carpeta,'verificado.json'),JSON.stringify(datos,null,2));resultados.push(datos);
    } catch(e){throw new Error('Opción '+(i+1)+': '+e.message+' No se generó el comparativo completo.');}
  }
  }finally{if(sesion)await sesion.cerrar();}
  validarComparacion(resultados);
  const nombre='QUILLUM-Comparativo-'+job.id;
  const archivo=await generar({schemaVersion:1,folio:resultados.map(d=>d.folio).join('-'),opciones:resultados},{baseDir:dir,nombreSalida:nombre,abrir:false,logoPath,executablePath:env?.CHROMIUM_EXECUTABLE_PATH,documento:documentoComparativo});
  await fs.writeFile(path.join(dir,'comparativo.verificado.json'),JSON.stringify(resultados,null,2));
  return {propuesta:path.relative(dir,archivo),folio:resultados.map(d=>d.folio).join(' / '),advertencias:resultados.flatMap((d,i)=>d.advertencias.map(a=>'Opción '+(i+1)+': '+a)),opciones:resultados.map(d=>({folio:d.folio,deducible:String(d.niveles.find(n=>n.nivel==='A').deducible/100),tabulador:d.tabulador,totalAnual:d.monto.total,niveles:d.niveles}))};
}
module.exports={ejecutarComparativo,documentoComparativo,validarComparacion,cambiosOpcion};
