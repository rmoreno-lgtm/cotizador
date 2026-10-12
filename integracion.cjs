const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { leerPdf, dinero, calculo } = require('./leer-gnp.cjs');

function html(v) {
  return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function crearVista(d) {
  const A=d.niveles.find(n=>n.nivel==='A'), B=d.niveles.find(n=>n.nivel==='B');
  const gasto=Math.max(20000000,Math.max(A.deducible,B.deducible)+10000000);
  const a=calculo(gasto,A), b=calculo(gasto,B);
  const gastoTope=Math.max(100000000,A.deducible+Math.ceil(A.tope*100/A.porcentaje)+10000000);
  const tope=calculo(gastoTope,A);
  const v={...d};
  for(const k of ['nombre','plan','folio','acceso','tabulador','fecha','vence','agente']) v[k]=html(d[k]);
  for(const k of ['total','neta','derecho','iva','recargo','descuento']) v[k]=dinero(d.monto[k],true);
  v.suma=dinero(d.suma);
  const titular=d.asegurados[0];
  v.perfilHtml=`Titular de ${titular.edad} años · ${html(titular.genero)} · CP ${html(titular.cp)}.`;
  if(d.asegurados.length>1) v.perfilHtml += `<br>Familiares (${d.asegurados.length-1}): `+d.asegurados.slice(1).map((f,i)=>`F${i+1}: ${f.edad} años, ${f.genero==='Masculino'?'M':'F'}`).join(' · ')+'.';
  v.tablaHtml=d.niveles.map(n=>`<tr><td>${n.nivel}</td><td>$${dinero(n.deducible)}</td><td>${n.porcentaje}%</td><td>$${dinero(n.tope)}</td></tr>`).join('\n');
  const filas=[
    ['Deducible','$'+dinero(a.deducible),'$'+dinero(b.deducible)],
    ['Base después del deducible','$'+dinero(a.base),'$'+dinero(b.base)],
    ['Coaseguro',`${A.porcentaje}%: $${dinero(a.coaseguro)}`,`${B.porcentaje}%: $${dinero(b.coaseguro)}`],
    ['<b>Tu participación</b>',`<b>$${dinero(a.total)}</b>`,`<b>$${dinero(b.total)}</b>`]
  ];
  const diferencia=a.total-b.total;
  const frase=diferencia>0?`$${dinero(diferencia)} menos de participación en nivel B.`:diferencia<0?`$${dinero(-diferencia)} más de participación en nivel B.`:'la misma participación en ambos niveles.';
  v.comparacionHtml=`<div class="example comparison"><b>MISMO GASTO, DISTINTA PARTICIPACIÓN</b><p class="small">Ejemplo con $${dinero(gasto)} de gastos cubiertos y reconocidos.</p><table><tr><th>Concepto</th><th>Nivel A</th><th>Nivel B</th></tr>${filas.map(f=>'<tr>'+f.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')}</table><p class="difference"><b>En este ejemplo: ${frase}</b></p></div>`;
  const textoCoaseguro=a.bruto>A.tope || b.bruto>B.tope?' En esta comparación, el coaseguro se limita al tope cuando corresponde.':'';
  v.comparacionHtml=v.comparacionHtml.replace('reconocidos.</p>',`reconocidos.${textoCoaseguro}</p>`);
  v.topeHtml=`<div class="example"><b>EJEMPLO 2 · CUANDO SE ALCANZA EL TOPE, NIVEL A</b><table><tr><td>Gastos cubiertos</td><td class="amount">$${dinero(gastoTope)}</td></tr><tr><td>Coaseguro calculado: ${A.porcentaje}% × $${dinero(tope.base)}</td><td class="amount">$${dinero(tope.bruto)}</td></tr><tr><td>Coaseguro limitado al tope de este nivel</td><td class="amount">$${dinero(tope.coaseguro)}</td></tr><tr><td><b>Deducible $${dinero(tope.deducible)} + coaseguro $${dinero(tope.coaseguro)}</b></td><td class="amount"><b>$${dinero(tope.total)}</b></td></tr></table></div>`;
  v.adicionalesHtml=d.coberturas.length?d.coberturas.map(c=>'• '+html(c)+'.').join('<br>'):'El PDF no describe expresamente adicionales de esta lista; consulta el documento original.';
  v.beneficiosHtml = '';
  const destacados=[];
  if(d.coberturas.includes('Cero deducible por accidente cubierto')) {
    destacados.push('<div class="keybenefit"><h3>Cero deducible por accidente</h3><p>En accidente cubierto no pagas deducible.</p></div>');
  }
  v.altaHtml='';
  if(d.altaSolicitada || d.altaConfirmada) {
    destacados.push('<div class="keybenefit"><h3>Alta Tecnología y Medicina de Vanguardia</h3><p>Evita la participación adicional en determinados procedimientos e insumos especializados.</p></div>');
    v.altaHtml='<b>Alta Tecnología y Medicina de Vanguardia:</b> evita una participación adicional en cirugía robótica, determinados equipos neurológicos, implantes de válvula aórtica y prótesis especiales. Siguen aplicando deducible, coaseguro, límites y condiciones.';
  }
  if(destacados.length) v.beneficiosHtml='<div class="keybenefits">'+destacados.join('')+'</div>';
  if(d.solidezSolicitada && d.monto.descuento===0) v.altaHtml+='<br><b>Solidez Familiar:</b> solicitada, pero el PDF refleja descuento de $0.00; confirma su aplicación con GNP.';
  v.dentalHtml=d.asistencias.dental?'Revisión y diagnóstico, dos limpiezas al año y descuentos en servicios indicados por GNP.':'Beneficios dentales no verificados en este PDF. Consulta el alcance con GNP.';
  v.psicologicaHtml=d.asistencias.psicologica?'Dos videoconsultas mensuales durante la vigencia de la póliza.':'Frecuencia de apoyo psicológico no verificada en este PDF. Consulta el alcance con GNP.';
  v.movilHtml=d.asistencias.movil?'Orientación telefónica y videoconsultas ilimitadas sin costo. Domicilio y ambulancia con copago.':'Servicios de Médica Móvil no verificados en este PDF. Consulta el alcance con GNP.';
  return v;
}

async function generarDesdePdf(pdf,solicitud,opciones={}) {
  const datos=await leerPdf(pdf,solicitud);
  const hash=crypto.createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
  const carpeta=opciones.baseDir || __dirname;
  const salida=path.join(carpeta,'propuestas');
  await fs.mkdir(salida,{recursive:true});
  const nombre=`QUILLUM-${datos.folio}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const verificado={...datos,fuente:{pdf:path.resolve(pdf),sha256:hash},verificadoEn:new Date().toISOString()};
  await fs.writeFile(path.join(salida,nombre+'.verificado.json'),JSON.stringify(verificado,null,2));
  for(const aviso of datos.advertencias) console.warn('Pendiente de verificar:',aviso);
  const { generarPropuesta }=require('./propuesta.cjs');
  const archivo=await generarPropuesta(crearVista(datos),{
    baseDir:carpeta,nombreSalida:nombre,abrir:opciones.abrir!==false,
    executablePath:opciones.executablePath,logoPath:opciones.logoPath
  });
  console.log('Propuesta generada con datos del PDF:',archivo);
  return {archivo,datos:verificado};
}
if(require.main===module) {
  const [pdf,solicitud]=process.argv.slice(2);
  if(!pdf || !solicitud) {
    console.error('Uso: node integracion.cjs "cotizacion.pdf" "solicitud.json"');process.exitCode=1;
  } else fs.readFile(solicitud,'utf8').then(JSON.parse).then(s=>generarDesdePdf(pdf,s.solicitud||s)).catch(e=>{console.error(e.message);process.exitCode=1});
}
module.exports={generarDesdePdf,crearVista,html};
