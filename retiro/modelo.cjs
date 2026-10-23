const {PDFParse}=require('pdf-parse');
const crypto=require('node:crypto');
const {ilustracion}=require('./ilustracion.cjs');
const {ocr}=require('./ocr.cjs');
const ENFOQUES={
 retiro:{nombre:'Retiro personal',titulo:'construyamos un plan para tu retiro.',subtitulo:'Ahorro y protección para tu futuro.',texto:'Un patrimonio para disfrutar tu futuro con tranquilidad.',icono:'☀'},
 independencia:{nombre:'Independencia',titulo:'demos forma a tu independencia.',subtitulo:'Ahorro y protección para tus decisiones.',texto:'Un plan para ampliar tus posibilidades y elegir tu camino.',icono:'↗'},
 personas:{nombre:'Personas importantes',titulo:'cuidemos el futuro de quienes más quieres.',subtitulo:'Ahorro y protección para sus proyectos.',texto:'Una meta que nace de las personas que más te importan.',icono:'♡'},
 patrimonio:{nombre:'Patrimonio',titulo:'construyamos tu patrimonio paso a paso.',subtitulo:'Ahorro y protección para tus objetivos.',texto:'Una estrategia para dar forma a tus objetivos de largo plazo.',icono:'◇'}
};
function analizar(texto) {
 if(typeof texto!=='string' || texto.length>1500000)throw Error('El documento excede el límite de lectura.');
 if(!/proyecta/i.test(texto) || !/\bGNP\b/i.test(texto))throw Error('No se identifica una ilustración de Proyecta GNP. Revisa el documento.');
 const completo=ilustracion(texto);if(completo)return completo;
 const campos={};const incidencias=[];
 // Solo etiquetas explícitas. No se asignan columnas de protección o valores sin una muestra validada.
 const extraer=(nombre,regex)=>{
  const hallazgos=[...texto.matchAll(regex)].map(m=>({valor:m[1].trim(),fuente:m[0].trim()}));
  const valores=[...new Set(hallazgos.map(h=>h.valor))];
  if(valores.length===1)campos[nombre]=hallazgos[0];
  else incidencias.push(valores.length?'Valores contradictorios: '+nombre+'.':'Pendiente de identificar: '+nombre+'.');
 };
 extraer('cliente',/(?:Nombre del (?:cliente|asegurado)|Asegurado)\s*:\s*([^\n\r]{2,100})/gi);
 extraer('edad',/Edad(?: de contrataci[oó]n)?\s*:\s*(\d{1,3})\s*a[nñ]os\b/gi);
 extraer('inflacion',/Inflaci[oó]n(?: (?:anual|supuesta|estimada))?\s*:\s*(\d{1,2}(?:[.,]\d+)?)\s*%/gi);
 extraer('plazoPago',/Plazo de (?:pago|aportaciones)\s*:\s*(\d{1,3})\s*a[nñ]os\b/gi);
 extraer('plazoPlan',/Plazo (?:del plan|de seguro)\s*:\s*(\d{1,3})\s*a[nñ]os\b/gi);
 extraer('aportacion',/Aportaci[oó]n inicial anual\s*:\s*(\$\s*[\d,]+\.\d{2})/gi);
 extraer('moneda',/Moneda\s*:\s*(MXN|USD|UDIS|Pesos mexicanos|D[oó]lares)/gi);
 for(const k of ['edad','plazoPago','plazoPlan'])if(campos[k] && (+campos[k].valor<1 || +campos[k].valor>120)){delete campos[k];incidencias.push('Valor fuera de rango: '+k+'.');}
 if(campos.plazoPago && campos.plazoPlan && +campos.plazoPago.valor>+campos.plazoPlan.valor){delete campos.plazoPago;delete campos.plazoPlan;incidencias.push('El plazo de pago excede el plazo del plan.');}
 incidencias.push('Tabla anual, ahorro al vencimiento y su carácter proyectado o garantizado: requieren validar las columnas del PDF.', 'Coberturas contratadas, suma de invalidez por año y condiciones de fallecimiento: requieren verificación documental.');
 return {campos,incidencias,estado:'borrador',generacionHabilitada:false};
}
async function leer(buffer){
 if(!buffer?.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Adjunta un PDF válido.');
 const parser=new PDFParse({data:buffer});
 try{
  const info=await parser.getInfo();if(info.total>10)throw Error('La ilustración admite hasta 10 páginas.');
  const out=await parser.getText();
  // PDF escaneado o mixto: no confundir marcadores de página con texto extraíble.
  const requiereOcr=out.pages.some(p=>p.text.replace(/\s/g,'').length<30);
  const texto=requiereOcr?await ocr(parser,info.total):out.text;
  const modelo=analizar(texto);
  if(requiereOcr)modelo.incidencias.unshift('Lectura mediante OCR: revisar cifras y coberturas contra el PDF original antes de emitir.');
  return {...modelo,metodoLectura:requiereOcr?'ocr':'texto',sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
 }finally{await parser.destroy();}
}
module.exports={analizar,leer,ENFOQUES};
