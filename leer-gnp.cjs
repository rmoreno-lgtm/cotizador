const fs = require('node:fs/promises');
const { PDFParse } = require('pdf-parse');

function obligatorio(texto, regex, campo) {
  const match = texto.match(regex);
  if (!match) throw new Error(`No se pudo verificar ${campo} en el PDF de GNP.`);
  return match[1].trim();
}
function centavos(valor) {
  const s = String(valor).trim();
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?$/.test(s)) {
    throw new Error(`Formato monetario no reconocido: ${s}`);
  }
  const [entero, decimal='00'] = s.replaceAll(',','').split('.');
  const n = Number(entero)*100+Number(decimal);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Importe fuera de rango.');
  return n;
}
function dinero(n, decimales=false) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Importe calculado inválido.');
  const entero = Math.floor(n/100).toLocaleString('en-US');
  return entero + (decimales || n%100 ? '.'+String(n%100).padStart(2,'0') : '');
}
const cantidad = '((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})?)';
function importe(texto, etiqueta, campo) {
  return centavos(obligatorio(texto,new RegExp(etiqueta+'\\s*[:+\\-]?\\s*\\$\\s*'+cantidad,'i'),campo));
}
function fecha(v) {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const ingles = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const m=v.match(/^(\d{1,2})\/(\d{1,2}|[a-z]{3})\/(\d{4})$/i);
  if(!m) throw new Error('Fecha no reconocida en GNP.');
  const mes=/^\d+$/.test(m[2])?Number(m[2])-1:ingles.indexOf(m[2].toLowerCase());
  const d=Number(m[1]), y=Number(m[3]);
  const f=new Date(Date.UTC(y,mes,d));
  if(mes<0 || mes>11 || f.getUTCFullYear()!==y || f.getUTCMonth()!==mes || f.getUTCDate()!==d) throw new Error('Fecha inválida en GNP.');
  return `${String(d).padStart(2,'0')}/${meses[mes]}/${y}`;
}
function mismo(a,b,campo) {
  const normal = v=>String(v).trim().toLocaleLowerCase('es-MX');
  if(normal(a)!==normal(b)) throw new Error(`El ${campo} del PDF no coincide con la solicitud. Revisa GNP antes de emitir la propuesta.`);
}
function validarSolicitud(s) {
  if(!s || typeof s.nombre!=='string' || !s.nombre.trim() || s.nombre.trim().length>100) throw new Error('Falta el nombre del cliente (1 a 100 caracteres).');
  if(!['Masculino','Femenino'].includes(s.genero) || !/^\d{5}$/.test(String(s.cp))) throw new Error('Solicitud sin género o CP válidos.');
  if(!Array.isArray(s.familiares) || s.familiares.length>6) throw new Error('Solicitud sin familiares válidos.');
  for(const a of [s,...s.familiares]) {
    if(!/^\d+$/.test(String(a.edad)) || Number(a.edad)>120 || !['Masculino','Femenino'].includes(a.genero)) throw new Error('Edad o género de un asegurado no válidos.');
  }
  if(typeof s.alta!=='boolean' || typeof s.solidez!=='boolean' || !s.tabulador || !s.acceso || !/^\d+$/.test(String(s.deducible)) || Number(s.deducible)<=0) throw new Error('Faltan condiciones de la solicitud.');
  if(s.solidez && s.familiares.length+1<4) throw new Error('Solidez Familiar solicitada con menos de cuatro asegurados.');
  return s;
}

function analizarPaginas(paginas, solicitud) {
  validarSolicitud(solicitud);
  const textos = paginas.map(p=>typeof p==='string'?p:p.text);
  const todo = textos.join('\n').replace(/[\t\u00a0]/g,' ');
  const portada = textos.find(t=>/Pago anual de\s*\$/.test(t));
  const participacion = textos.find(t=>/Tope de coaseguro/i.test(t));
  if(!portada || !participacion) throw new Error('Este PDF no contiene el resumen anual y la tabla de participación esperados. No se generó la propuesta.');
  const p = portada.replace(/[\t\u00a0]/g,' ');
  if(!/Seguro Médico GNP Personaliza/.test(p) || !/Variable con\s*\$/.test(p)) throw new Error('El PDF no acredita Personaliza Variable.');
  const folio = obligatorio(todo,/Cotización núm\.\s*(\d+)/i,'folio');
  const folios = [...todo.matchAll(/Folio de cotización:\s*(\d+)/gi)].map(m=>m[1]);
  if(!folios.length || folios.some(f=>f!==folio)) throw new Error('El folio del desglose no coincide o está ausente.');
  const monto = {
    total: importe(p,'Pago anual de','prima total'),
    neta: importe(p,'Prima neta anual','prima neta'),
    recargo: importe(p,'Recargo\\s+por pago\\s+fraccionado','recargo'),
    derecho: importe(p,'Derecho\\s+de Póliza','derecho de póliza'),
    descuento: importe(p,'Descuento\\s+por solidez\\s+familiar','descuento familiar'),
    iva: importe(p,'I\\.?V\\.?A\\.?','IVA')
  };
  const totalConNeta=monto.neta+monto.recargo+monto.derecho+monto.iva;
  // GNP puede presentar la prima neta ya descontada. No restar ese beneficio dos veces.
  const descuentoIncluidoEnNeta=monto.descuento>0 && totalConNeta===monto.total;
  if(totalConNeta!==monto.total && totalConNeta-monto.descuento!==monto.total) {
    throw new Error('Los importes de GNP no cuadran al centavo. No se generó la propuesta.');
  }
  const acceso = obligatorio(p,/Acceso hospitalario\s*\n\s*([^\n]+)/i,'acceso hospitalario');
  const tabulador = obligatorio(p,/Nivel de tabulador\s*\n\s*([^\n]+)/i,'tabulador');
  const deducible = importe(p,'Variable con','deducible elegido');
  mismo(acceso,solicitud.acceso,'acceso hospitalario');
  mismo(tabulador,solicitud.tabulador,'tabulador');
  mismo(deducible,Number(solicitud.deducible)*100,'deducible');
  const asegurados=[...todo.matchAll(/Edad:\s*(\d+)\s+Género:\s*([MF])\s+Riesgo:\s*[^\n]*?C\.?P\s*:\s*(\d{5})/gi)].map(m=>({edad:Number(m[1]),genero:m[2].toUpperCase()==='M'?'Masculino':'Femenino',cp:m[3]}));
  const esperados=[solicitud,...solicitud.familiares];
  if(asegurados.length!==esperados.length) throw new Error('El número de asegurados del PDF no coincide con la solicitud o no pudo leerse.');
  asegurados.forEach((a,i)=>{
    mismo(a.edad,esperados[i].edad,`edad del asegurado ${i+1}`);
    mismo(a.genero,esperados[i].genero,`género del asegurado ${i+1}`);
    mismo(a.cp,solicitud.cp,`CP del asegurado ${i+1}`);
  });
  const inicioDesglose=textos.findIndex(t=>/Desglose de Cotización/i.test(t));
  if(inicioDesglose<0) throw new Error('Falta el desglose por asegurado de GNP.');
  const desglose=textos.slice(inicioDesglose).join('\n').replace(/[\t\u00a0]/g,' ');
  const sumarDesglose=(etiqueta,campo)=>{
    const re=new RegExp(etiqueta+'\\s*:\\s*\\$\\s*'+cantidad,'gi');
    const valores=[...desglose.matchAll(re)].map(m=>centavos(m[1]));
    if(valores.length!==asegurados.length) throw new Error(`No se pudo verificar ${campo} para todos los asegurados.`);
    return valores.reduce((a,b)=>a+b,0);
  };
  const totalDesglose=sumarDesglose('Importe Total Anual','el total anual');
  const netaDesglose=sumarDesglose('Prima Neta','la prima neta');
  const recargoDesglose=sumarDesglose('Recargo por pago Fraccionado','el recargo');
  const derechoDesglose=sumarDesglose('Derecho de Póliza','el derecho de póliza');
  const ivaDesglose=sumarDesglose('I\\.?V\\.?A\\.?','el IVA');
  const netaEsperada=descuentoIncluidoEnNeta || monto.descuento===0?monto.neta:monto.neta-monto.descuento;
  if(totalDesglose!==monto.total || netaDesglose!==netaEsperada || recargoDesglose!==monto.recargo || derechoDesglose!==monto.derecho || ivaDesglose!==monto.iva) {
    throw new Error('El resumen de GNP no coincide con la suma del desglose de todos los asegurados. No se generó la propuesta.');
  }
  const tabla = participacion.replace(/[\t\u00a0]/g,' ');
  const regex = new RegExp('(?:^|\\n)\\s*([ABCD])\\s+\\$\\s*'+cantidad+'\\s*\\(I\\)\\s+(\\d+(?:\\.\\d+)?)%\\s+\\$\\s*'+cantidad,'g');
  const niveles = [...tabla.matchAll(regex)].map(m=>({nivel:m[1],deducible:centavos(m[2]),porcentaje:Number(m[3]),tope:centavos(m[4])}));
  if(niveles.length!==4 || niveles.map(n=>n.nivel).join('')!=='ABCD' || niveles.some(n=>n.porcentaje<=0 || n.porcentaje>100)) throw new Error('No se pudo verificar completa la tabla hospitalaria A–D.');
  mismo(niveles[0].deducible,deducible,'deducible de nivel A');
  if(!/Por año por padecimiento/i.test(tabla) || !/Por año P[oó]liza por asegurado/i.test(tabla)) throw new Error('No se pudieron verificar los periodos de deducible y suma asegurada.');
  const adicionales = textos.find(t=>/Coberturas Adicionales que seleccionaste/i.test(t)) || '';
  const coberturas = [];
  for(const [nombre,re] of [
    ['Cero deducible por accidente cubierto',/Cero deducible por accidente\s+•\s*No pagarás/i],
    ['Emergencia médica en el extranjero',/Emergencia médica en el extranjero\s+•\s*Atención médica/i],
    ['Ampliación hospitalaria nacional',/Ampliación hospitalaria nacional\s+•\s*Atención médica/i]
  ]) if(re.test(adicionales.replace(/\t/g,' '))) coberturas.push(nombre);
  const altaConfirmada = /Alta Tecnología y Medicina de\s+vanguardia\s+•/i.test(adicionales);
  if(altaConfirmada && !solicitud.alta) throw new Error('El PDF incluye Alta Tecnología y la solicitud la excluye.');
  const advertencias=[];
  if(solicitud.alta && !altaConfirmada) advertencias.push('Alta Tecnología fue solicitada, pero no está detallada expresamente en el PDF.');
  if(solicitud.solidez && monto.descuento===0) advertencias.push('Solidez Familiar fue solicitada, pero el PDF refleja descuento de $0.00.');
  if(!solicitud.solidez && monto.descuento>0) throw new Error('El PDF refleja descuento de Solidez Familiar no solicitado.');
  const fuenteAsistencias = textos.find(t=>/diferentes Asistencias/i.test(t)) || '';
  const asistencias = {
    dental:/2\s+limpiezas dentales al año/i.test(fuenteAsistencias) && /Revisión y diagnóstico/i.test(fuenteAsistencias),
    psicologica:/2\s+videoconsultas mensuales/i.test(fuenteAsistencias),
    movil:/Médica Móvil/i.test(fuenteAsistencias) && /videoconsultas ilimitadas sin costo/i.test(fuenteAsistencias) && /copago/i.test(fuenteAsistencias)
  };
  const basic=todo.replace(/\s+/g,' ');
  if(!/Honorarios médicos/.test(basic) || !/Gastos hospitalarios/.test(basic) || !/Rehabilitación/.test(basic)) throw new Error('No se pudo verificar la descripción de cobertura básica.');
  return {
    schemaVersion:1, nombre:solicitud.nombre.trim(), folio,plan:'Personaliza Variable',
    fecha:fecha(obligatorio(p,/Fecha de cotización:\s*([^\s]+)/i,'fecha de cotización')),
    vence:fecha(obligatorio(p,/Válida hasta:\s*([^\s]+)/i,'vigencia')),
    agente:obligatorio(p,/Agente:\s*([^\n]+)/i,'asesor'),
    acceso,tabulador,asegurados,niveles,monto,descuentoIncluidoEnNeta,
    suma:importe(tabla,'Suma Asegurada Cobertura Básica','suma asegurada'),
    coberturas,altaSolicitada:solicitud.alta,altaConfirmada,altaVerificadaEnPortal:solicitud.altaVerificadaEnPortal===true,asistencias,advertencias,
    solidezSolicitada:solicitud.solidez
  };
}
async function leerPdf(archivo,solicitud) {
  const buffer=await fs.readFile(archivo);
  if(buffer.length>40*1024*1024 || !buffer.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new Error('PDF inválido o mayor a 40 MB.');
  const lector=new PDFParse({data:buffer});
  try { return analizarPaginas((await lector.getText()).pages,solicitud); }
  finally { await lector.destroy(); }
}
function calculo(gasto,nivel) {
  const deducible=Math.min(gasto,nivel.deducible);
  const base=gasto-deducible;
  const bruto=Math.round(base*nivel.porcentaje/100);
  const coaseguro=Math.min(bruto,nivel.tope);
  return {gasto,deducible,base,bruto,coaseguro,total:deducible+coaseguro};
}
module.exports={leerPdf,analizarPaginas,validarSolicitud,centavos,dinero,calculo};
