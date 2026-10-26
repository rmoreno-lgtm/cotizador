const {PDFParse}=require('pdf-parse');
const crypto=require('node:crypto');
const {ocr}=require('../retiro/ocr.cjs');
const {money}=require('../retiro/ilustracion.cjs');
const TASA_ISR=30;
const normal=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Inflaci[6oe]n/gi,'Inflacion').replace(/Protecci[6oe]n/gi,'Proteccion');
function analizar(texto){
 if(typeof texto!=='string'||texto.length>1500000)throw Error('Documento demasiado extenso.');
 const t=normal(texto);if(!/Consolida/i.test(t)||!/GNP/i.test(t))throw Error('Selecciona una ilustración de Consolida GNP.');
 if(!/Monto\s+Deducible[\s\S]{0,160}Art\.?\s*151/i.test(t))throw Error('No se identifica la columna de monto deducible del artículo 151. Revisa el esquema fiscal.');
 const campos={},incidencias=[];let tablaValida=true;
 const error=mensaje=>{tablaValida=false;incidencias.push(mensaje);};
 function campo(k,re,convert=v=>v.trim()){
  const ms=[...t.matchAll(re)],vs=ms.map(m=>convert(m[1]));
  if(!vs.length||vs.some(v=>String(v).trim()==='')||new Set(vs.map(String)).size!==1){error('Dato ausente o contradictorio: '+k+'.');return;}
  campos[k]={valor:String(vs[0]),fuente:ms[0][0].trim()};
 }
 const unidad='a(?:n|fi|fh|nh|h|ri|f|ii|ji)?os\\b';
 campo('cliente',/(?:A?preciable|Nombre del cliente)\s*:\s*([^\n\r]{2,100})/gi);
 campo('edad',new RegExp('Edad del solicitante\\s*:\\s*(\\d{1,3})\\s*'+unidad,'gi'),Number);
 campo('edadVencimiento',new RegExp('Plazo\\s*:\\s*Edad\\s*(\\d{1,3})\\s*'+unidad,'gi'),Number);
 campo('plazoPago',new RegExp('(?:Plazo de pago\\s*:\\s*|durante\\s+)(\\d{1,3})\\s*'+unidad,'gi'),Number);
 campo('inflacion',/(?:Tasa de )?Inflacion\s*:?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/gi,v=>Number(v.replace(',','.')));
 campo('moneda',/Moneda\s*:\s*(Nacional|MXN|USD|UDIS|Dolares)/gi,v=>/Nacional|MXN/i.test(v)?'MXN':v.toUpperCase());
 campo('aportacion',/aportaci[oe6]n de\s*(\$[\d,]+(?:\.\d{2})?)\s*pesos anuales/gi,money);
 const tabla=[],importe='(\\$[\\d,]+(?:\\.\\d{2})?)';
 const larga=new RegExp('^\\s*(\\d{1,3})\\s+(\\d{1,3})\\s+'+importe+'\\s+'+importe+'\\s+'+importe+'\\s+(\\d+(?:\\.\\d+)?)%\\s+'+importe+'\\s+'+importe+'\\s*$','gm');
 const corta=new RegExp('^\\s*(\\d{1,3})\\s+(\\d{1,3})\\s+'+importe+'\\s+'+importe+'\\s+'+importe+'\\s+'+importe+'\\s*$','gm');
 for(const m of t.matchAll(larga))tabla.push({anio:+m[1],edad:+m[2],aportacion:money(m[3]),acumulado:money(m[4]),efectivo:money(m[5]),proteccion:money(m[7]),deducible:money(m[8]),fuente:m[0].trim()});
 const formato=tabla.length?'completa':'compacta';
 if(!tabla.length)for(const m of t.matchAll(corta))tabla.push({anio:+m[1],edad:+m[2],aportacion:money(m[3]),efectivo:money(m[4]),proteccion:money(m[5]),deducible:money(m[6]),fuente:m[0].trim()});
 const edad=+campos.edad?.valor,vencimiento=+campos.edadVencimiento?.valor,pago=+campos.plazoPago?.valor;
 if(!Number.isInteger(edad)||!Number.isInteger(vencimiento)||!Number.isInteger(pago)||edad<18||vencimiento>120||vencimiento<=edad||pago<1||pago>vencimiento-edad)error('Edades o plazos incompatibles.');
 if(vencimiento!==65)error('Esta versión identifica Consolida con vencimiento a los 65 años; revisa el esquema de otro vencimiento.');
 if(!tabla.length||tabla.length!==vencimiento-edad)error('La tabla anual no coincide con el plazo del plan.');
 let acumuladoCalculado=0;
 for(let i=0;i<tabla.length;i++){
  const f=tabla[i];acumuladoCalculado+=f.aportacion;if(!Number.isSafeInteger(acumuladoCalculado))error('El total excede el rango de cálculo.');
  if(f.anio!==i+1||f.edad!==edad+i)error('Secuencia de años o edades inconsistente en la fila '+(i+1)+'.');
  if(formato==='compacta')f.acumulado=acumuladoCalculado;
  else if(Math.abs(f.acumulado-(tabla[i-1]?.acumulado||0)-f.aportacion)>100)error('Acumulado inconsistente en el año '+f.anio+'.');
  if((f.anio<=pago&&f.aportacion<=0)||(f.anio>pago&&f.aportacion!==0))error('Aportaciones incompatibles con el plazo en el año '+f.anio+'.');
  if(f.deducible>f.aportacion||(f.anio>pago&&f.deducible!==0))error('Monto deducible incompatible con la aportación en el año '+f.anio+'.');
  if(f.proteccion<=0)error('Protección no válida en el año '+f.anio+'.');
 }
 if(tabla[0]&&+campos.aportacion?.valor!==tabla[0].aportacion)error('La aportación inicial difiere de la primera fila.');
 if(campos.moneda?.valor!=='MXN')error('El ejercicio fiscal requiere importes en MXN; no se supone un tipo de cambio.');
 if(!tabla.some(f=>f.deducible>0))error('No hay una base positiva para el ejercicio del artículo 151.');
 const distribucion=[];
 if(/DISTRIBUCION DE LA PRIMA DE RETIRO/i.test(t)){
  for(const articulo of [93,151,185]){
   const re=new RegExp('^\\s*Art\\s+'+articulo+'\\b[^\\n]*?(\\d+(?:\\.\\d+)?)%\\s+'+importe+'\\s*$','mi'),m=re.exec(t);
   if(!m){error('Distribución fiscal incompleta: artículo '+articulo+'.');continue;}
   distribucion.push({articulo,porcentaje:+m[1],monto:money(m[2]),fuente:m[0].trim()});
  }
  const primaRetiro=/Prima de retiro\s*:\s*(\$[\d,]+(?:\.\d{2})?)/i.exec(t);
  if(!primaRetiro||distribucion.reduce((n,d)=>n+d.monto,0)!==money(primaRetiro[1]))error('La distribución no coincide con la prima de retiro.');
  const d151=distribucion.find(d=>d.articulo===151),d185=distribucion.find(d=>d.articulo===185);
  if(distribucion.length===3&&Math.abs(distribucion.reduce((n,d)=>n+d.porcentaje,0)-100)>0.01)error('La distribución fiscal no suma 100%.');
  if(d151&&tabla[0]&&d151.monto!==tabla[0].deducible)error('La distribución fiscal difiere del primer monto deducible.');
  if(d185?.monto>0)error('Esta versión no combina el ejercicio del artículo 151 con aportaciones al artículo 185.');
 }
 const cobertura=/^.*Proteccion por Fallecimiento\s*\/\s*Supervivencia\s+(\$[\d,]+(?:\.\d{2})?)\s+(\$[\d,]+(?:\.\d{2})?)\s*$/mi.exec(t);
 if(!cobertura)error('No se identifica la cobertura principal del plan.');
 else if(tabla[0]&&(money(cobertura[1])!==tabla[0].proteccion||money(cobertura[2])!==tabla[0].aportacion))error('La cobertura inicial difiere de la tabla.');
 if(tablaValida){campos.ahorro={valor:String(tabla.at(-1).efectivo),fuente:tabla.at(-1).fuente};campos.plazoPlan={valor:String(vencimiento-edad),fuente:'Edades contrastadas con la tabla.'};}
 incidencias.push('Ejercicio ilustrativo: se aplica un ISR supuesto del 30% al monto señalado para deducción. La deducción efectiva está sujeta a los límites y a la situación fiscal del cliente.','No determina ISR real, devolución ni retenciones al vencimiento. Las cifras de recuperación y protección son proyectadas.');
 if(formato==='completa'&&tabla.length&&acumuladoCalculado!==tabla.at(-1).acumulado)incidencias.push('La suma de las primas anuales difiere del acumulado mostrado por redondeos; los totales del ejercicio suman las anualidades.');
 if(formato==='compacta')incidencias.push('El acumulado se obtiene sumando las primas de la tabla compacta; no aparece como columna en el documento.');
 return {producto:'Consolida GNP',campos,tabla,tablaValida,formatoTabla:formato,distribucion,regimen:'151',tasaSupuesto:TASA_ISR,ahorroTipo:'proyectado',incidencias};
}
function ejercicio(modelo){
 if(!modelo.tablaValida)throw Error('Revisa las inconsistencias antes de calcular el ejercicio.');
 const filas=modelo.tabla.map(f=>{const beneficio=Number((BigInt(f.deducible)*BigInt(TASA_ISR)+50n)/100n);return {...f,beneficio,neto:f.aportacion-beneficio};});
 const suma=k=>filas.reduce((n,f)=>n+f[k],0);
 return {tasa:TASA_ISR,filas,totales:{aportacion:suma('aportacion'),deducible:suma('deducible'),beneficio:suma('beneficio'),neto:suma('neto')}};
}
async function leer(buffer){
 if(!buffer?.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Adjunta un PDF válido.');
 const parser=new PDFParse({data:buffer});try{const info=await parser.getInfo();if(info.total>10)throw Error('Se admiten hasta 10 páginas.');const out=await parser.getText();const escaneado=out.pages.some(p=>p.text.replace(/\s/g,'').length<30);const m=analizar(escaneado?await ocr(parser,info.total):out.text);if(escaneado)m.incidencias.unshift('Lectura OCR: contrasta los datos con el original antes de emitir.');return {...m,metodoLectura:escaneado?'ocr':'texto',sha256:crypto.createHash('sha256').update(buffer).digest('hex')};}finally{await parser.destroy();}
}
module.exports={analizar,leer,ejercicio,TASA_ISR};
