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
function documentoComparativo(logo,qr,{opciones:ds}) {
  validarComparacion(ds);
  const base=ds[0], precio=x=>'$'+dinero(x,true);
  const encabezado=`<header><img src="${logo}" alt="QUILLUM"><div>COMPARATIVO PERSONALIZADO<br>Aseguradora: GNP</div></header>`;
  const pie=n=>`<footer>QUILLUM · Propuesta informativa · Folios ${ds.map(d=>html(d.folio)).join(' / ')}<span>${n} / 3</span></footer>`;
  const tabla=filas=>`<table><thead><tr><th>Concepto</th>${ds.map((_,i)=>'<th>Opción '+(i+1)+'</th>').join('')}</tr></thead><tbody>${filas.map(([titulo,fn])=>'<tr><td>'+titulo+'</td>'+ds.map(d=>'<td>'+fn(d)+'</td>').join('')+'</tr>').join('')}</tbody></table>`;
  const nivel=(d,n)=>d.niveles.find(x=>x.nivel===n);
  const filas=[['Prima anual',d=>'<b>'+precio(d.monto.total)+'</b>'],['Deducible base · nivel A',d=>precio(nivel(d,'A').deducible)],['Tabulador médico',d=>html(d.tabulador)],['Acceso hospitalario',d=>html(d.acceso)],['Suma asegurada',d=>precio(d.suma)],['Alta Tecnología',d=>d.altaConfirmada?'Confirmada en PDF':d.altaSolicitada?'Solicitada; revisar original':'No solicitada'],['Folio GNP',d=>html(d.folio)],['Vigencia de cotización',d=>html(d.vence)]];
  const gasto=Math.max(20000000,...ds.flatMap(d=>['A','B'].map(n=>nivel(d,n).deducible+10000000)));
  const ejemplo=n=>`<h2>Nivel hospitalario ${n}</h2>`+tabla([['Deducible',d=>precio(nivel(d,n).deducible)],['Coaseguro / tope',d=>nivel(d,n).porcentaje+'% / '+precio(nivel(d,n).tope)],['Coaseguro en este ejemplo',d=>precio(calculo(gasto,nivel(d,n)).coaseguro)],['Tu participación estimada',d=>'<b>'+precio(calculo(gasto,nivel(d,n)).total)+'</b>']]);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Comparativo QUILLUM</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0a3052;print-color-adjust:exact}.page{width:210mm;height:297mm;padding:14mm 15mm 20mm;position:relative;break-after:page}.page:last-child{break-after:auto}header{height:85px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #f68a21}header img{width:135px;height:78px;object-fit:contain}header div{font-size:10px;text-align:right;line-height:1.7}h1{font-size:27px;margin:20px 0 10px}h2{font-size:17px;margin:20px 0 10px}p{font-size:12px;line-height:1.6;color:#506276}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}th{background:#0a3052;color:white}td,th{padding:10px 7px;border-bottom:1px solid #dce5ed;text-align:left;overflow-wrap:anywhere}th:first-child,td:first-child{width:31%}tbody tr:nth-child(odd){background:#f3f7fa}b{color:#0a3052}.beneficio{background:#fff3e6;padding:12px;border-left:4px solid #f68a21;font-size:12px;line-height:1.6}.small{font-size:10px}footer{position:absolute;bottom:10mm;left:15mm;right:15mm;border-top:1px solid #dce5ed;padding-top:8px;font-size:8px}footer span{float:right}.qr{width:100px;height:100px}
</style><body><section class="page">${encabezado}<h1>Más opciones para decidir con claridad</h1><h2>${html(base.nombre)}</h2><p>${html(base.plan)} · ${base.asegurados.length} asegurado(s) · CP ${html(base.asegurados[0].cp)}</p><p>Comparamos ${ds.length} configuraciones para las mismas personas. Revisa el precio y la participación que eliges asumir.</p>${tabla(filas)}${ds.every(d=>d.coberturas.includes('Cero deducible por accidente cubierto'))?'<p class="beneficio"><b>Cero deducible por accidente</b><br>En accidente cubierto no pagas deducible.</p>':''}<p class="small">Importes anuales según los PDF originales de GNP. La cotización está sujeta a aceptación y condiciones de contratación.</p>${pie(1)}</section>
<section class="page">${encabezado}<h1>El mismo gasto, distintas opciones</h1><p>Ejemplo con <b>${precio(gasto)}</b> de gastos cubiertos y reconocidos, en cada opción.</p>${ejemplo('A')}${ejemplo('B')}<p class="beneficio">Deducible: la cantidad inicial que pagas. Coaseguro: el porcentaje del gasto restante, hasta el tope que corresponde al nivel hospitalario.</p><p class="small">Ejemplo de una enfermedad cubierta, empezando con el deducible pendiente. Considera solamente deducible y coaseguro. Diferencias de honorarios respecto al tabulador y otros gastos no reconocidos pueden aumentar lo que pagas. El tabulador médico y el nivel hospitalario son conceptos distintos. Aplican condiciones de GNP.</p>${pie(2)}</section>
<section class="page">${encabezado}<h1>Te acompañamos cuando más lo necesitas</h1><h2>La diferencia de QUILLUM</h2><p>Atención personalizada para programación de cirugías, reembolsos y seguimiento durante tu hospitalización.</p><h2>Antes de elegir</h2><p><b>Deducible:</b> compara cuánto puedes asumir ante una enfermedad cubierta.</p><p><b>Tabulador médico:</b> define los límites de honorarios reconocidos por GNP. Cambiarlo puede modificar la diferencia que pagues al médico.</p><p><b>Acceso y nivel hospitalario:</b> consulta que tus hospitales de preferencia correspondan a la configuración elegida.</p>${ds.every(d=>d.altaSolicitada||d.altaConfirmada)?'<p class="beneficio"><b>Alta Tecnología y Medicina de Vanguardia</b><br>Evita la participación adicional en determinados procedimientos e insumos especializados. Aplican condiciones de GNP.</p>':''}<h2>Beneficios para tu día a día</h2><p>${ds.every(d=>d.asistencias.dental)?'Asistencia dental: revisión y diagnóstico, dos limpiezas al año y descuentos.':'Consulta el alcance de asistencia dental en los originales.'}</p><p>${ds.every(d=>d.asistencias.psicologica)?'Apoyo psicológico: dos videoconsultas mensuales durante la vigencia.':'Consulta el alcance de apoyo psicológico en los originales.'}</p><p>${ds.every(d=>d.asistencias.movil)?'Médica Móvil: orientación telefónica y videoconsultas ilimitadas sin costo. Domicilio y ambulancia con copago.':'Consulta el alcance de Médica Móvil en los originales.'}</p><h2>¿Cuál opción prefieres?</h2><p>WhatsApp: <b>81 80 20 24 14</b> · Te ayudamos a revisar las diferencias.</p><img class="qr" src="${qr}" alt="WhatsApp QUILLUM"><p class="small">El comparativo resume los documentos originales; no sustituye las condiciones de la póliza.</p>${pie(3)}</section></body></html>`;
}
async function ejecutarComparativo(job,dir,{env,logoPath,cotizar,leer,generar}={}) {
  cotizar=cotizar||require('./cotizador-gnp.cjs').cotizar;leer=leer||leerPdf;generar=generar||require('./propuesta.cjs').generarPropuesta;
  const resultados=[];
  for(const [i,o] of job.solicitud.opciones.entries()) {
    const carpeta=path.join(dir,'opcion-'+(i+1));await fs.mkdir(carpeta,{recursive:true});
    const pdf=path.join(carpeta,'gnp.pdf');const s={...job.solicitud,...o};delete s.opciones;delete s.modalidad;
    try {
      const verificada=await cotizar(s,pdf,env);
      await fs.writeFile(path.join(carpeta,'solicitud.json'),JSON.stringify(verificada,null,2));
      const datos=await leer(pdf,verificada);
      datos.fuente={sha256:crypto.createHash('sha256').update(await fs.readFile(pdf)).digest('hex')};
      await fs.writeFile(path.join(carpeta,'verificado.json'),JSON.stringify(datos,null,2));resultados.push(datos);
    } catch(e){throw new Error('Opción '+(i+1)+': '+e.message+' No se generó el comparativo completo.');}
  }
  validarComparacion(resultados);
  const nombre='QUILLUM-Comparativo-'+job.id;
  const archivo=await generar({schemaVersion:1,folio:resultados.map(d=>d.folio).join('-'),opciones:resultados},{baseDir:dir,nombreSalida:nombre,abrir:false,logoPath,executablePath:env?.CHROMIUM_EXECUTABLE_PATH,documento:documentoComparativo});
  await fs.writeFile(path.join(dir,'comparativo.verificado.json'),JSON.stringify(resultados,null,2));
  return {propuesta:path.relative(dir,archivo),folio:resultados.map(d=>d.folio).join(' / '),advertencias:resultados.flatMap((d,i)=>d.advertencias.map(a=>'Opción '+(i+1)+': '+a)),opciones:resultados.map(d=>({folio:d.folio,deducible:String(d.niveles.find(n=>n.nivel==='A').deducible/100),tabulador:d.tabulador,totalAnual:d.monto.total,niveles:d.niveles}))};
}
module.exports={ejecutarComparativo,documentoComparativo,validarComparacion};
