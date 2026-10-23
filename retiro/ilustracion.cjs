const money=s=>{const limpio=s.replace(/[$,\s]/g,'');if(!/^\d+(?:\.\d{2})?$/.test(limpio))throw Error('Importe no reconocido.');const n=Math.round(Number(limpio)*100);if(!Number.isSafeInteger(n))throw Error('Importe fuera de rango.');return n;};
const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Protecci[6oe]n/gi,'Proteccion').replace(/Exenci[6oe]n/gi,'Exencion');
function ilustracion(texto){
 const t=normal(texto);if(!/Prima\s+Anual\s+Acumulada/i.test(t) || !/Valor en Efectivo[\s\S]{0,100}Proyectado/i.test(t))return null;
 const campos={},incidencias=[];const fuentes={};
 function campo(k,re,convert=v=>v.trim()){
  const matches=[...t.matchAll(re)];const valores=matches.map(m=>convert(m[1]));
  if(!valores.length || new Set(valores.map(String)).size!==1){incidencias.push('Dato ausente o contradictorio: '+k+'.');return;}
  campos[k]={valor:String(valores[0]),fuente:matches[0][0].trim()};
 }
 campo('cliente',/(?:A?preciable|Nombre del cliente)\s*:\s*([^\r\n]{2,100})/gi);
 campo('edad',/Edad del solicitante\s*:\s*(\d{1,3})\s*a(?:n|fi|fh|nh|h|ri|f|ii)?os\b/gi,Number);
 campo('inflacion',/(?:Tasa de )?Inflacion\s*:?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/gi,v=>Number(v.replace(',','.')));
 campo('plazoPago',/Plazo de pago\s*:\s*(\d{1,3})\s*a(?:n|fi|fh|nh|h|ri|f|ii)?os\b/gi,Number);
 campo('edadVencimiento',/Plazo\s*:\s*Edad\s*(\d{1,3})\s*a(?:n|fi|fh|nh|h|ri|f|ii)?os\b/gi,Number);
 campo('moneda',/Moneda\s*:\s*_*\s*(Nacional|MXN|USD|UDIS|Dolares)/gi,v=>/Nacional|MXN/i.test(v)?'MXN':v.toUpperCase());
 campo('aportacion',/aportacion de\s*(\$[\d,]+(?:\.\d{2})?)\s*pesos anuales/gi,v=>'$'+(money(v)/100).toLocaleString('en-US'));
 const tabla=[];const importe='(\\$[\\d,]+(?:\\.\\d{2})?)';
 const re=new RegExp('^\\s*(\\d{1,3})\\s+(\\d{1,3})\\s+'+importe+'\\s+'+importe+'\\s+'+importe+'\\s+(\\d+(?:\\.\\d+)?)%\\s+'+importe+'\\s*$','gm');
 for(const m of t.matchAll(re)){
  const fila={anio:Number(m[1]),edad:Number(m[2]),aportacion:money(m[3]),acumulado:money(m[4]),efectivo:money(m[5]),recuperacion:Number(m[6]),proteccion:money(m[7]),fuente:m[0].trim()};
  tabla.push(fila);
 }
 let tablaValida=tabla.length>0;
 const error=mensaje=>{tablaValida=false;incidencias.push(mensaje);};
 if(!tabla.length)error('No se pudo leer la tabla anual completa.');
 const edad=Number(campos.edad?.valor),pago=Number(campos.plazoPago?.valor),vencimiento=Number(campos.edadVencimiento?.valor);
 if(!Number.isInteger(edad)||!Number.isInteger(pago)||!Number.isInteger(vencimiento)||edad<18||vencimiento>120||pago<1||pago>vencimiento-edad)error('Revisar edades y plazos de la ilustración.');
 if(tabla.length!==vencimiento-edad)error('El número de filas no coincide con el plazo hasta el vencimiento.');
 for(let i=0;i<tabla.length;i++){
  const r=tabla[i],anterior=tabla[i-1];
  if(r.anio!==i+1 || r.edad!==edad+i)error('Secuencia de años o edades inconsistente en la fila '+(i+1)+'.');
  if(Math.abs(r.acumulado-(anterior?.acumulado||0)-r.aportacion)>100)error('Prima acumulada inconsistente en el año '+r.anio+'.');
  if((r.anio<=pago && r.aportacion<=0)||(r.anio>pago && r.aportacion!==0))error('Aportaciones incompatibles con el plazo de pago en el año '+r.anio+'.');
  if(r.acumulado && Math.abs(r.recuperacion-100*r.efectivo/r.acumulado)>1){r.recuperacionLeida=r.recuperacion;r.recuperacion=null;incidencias.push('Revisar porcentaje de recuperación leído en el año '+r.anio+'; no se usa para calcular importes.');}
 }
 if(tabla.length && campos.aportacion && money(campos.aportacion.valor)!==tabla[0].aportacion)error('La aportación inicial difiere de la primera fila.');
 const coberturas=[];
 const exencion=/^.*Exencion de Pago de Primas por Invalidez Total y Permanente\s+Amparada\s+(\$[\d,]+(?:\.\d{2})?)\s*$/mi.exec(t);
 if(exencion)coberturas.push({tipo:'exencion',nombre:'Exención de pago de primas por invalidez total y permanente',aportacion:money(exencion[1]),fuente:exencion[0]});
 for(const [tipo,nombre,re]of [
  ['invalidez','Invalidez Sin Espera',/^\s*Invalidez Sin Espera\s+(\$[\d,]+(?:\.\d{2})?)\s+(\$[\d,]+(?:\.\d{2})?)\s*$/mi],
  ['fallecimiento','Protección por fallecimiento / supervivencia',/^.*Proteccion por Fallecimiento\s*\/\s*Supervivencia\s+(\$[\d,]+(?:\.\d{2})?)\s+(\$[\d,]+(?:\.\d{2})?)\s*$/mi],
  ['seguridad','Seguridad en Vida',/^.*Seguridad en Vida\*?\s+(\$[\d,]+(?:\.\d{2})?)\s+Sin Costo\s*$/mi],
  ['gastos','Cláusula de Últimos Gastos',/^.*Clausula de Ultimos Gastos\*?\s+(\$[\d,]+(?:\.\d{2})?)\s+Sin Costo\s*$/mi]
 ]){const m=re.exec(t);if(m)coberturas.push({tipo,nombre,suma:money(m[1]),...(m[2]?{aportacion:money(m[2])}:{}),fuente:m[0].trim()});}
 for(const [tipo,nombre]of [['noFumador','Incremento No Fumador'],['mujer','Incremento Mujer']]){
  const incremento=new RegExp('^.*'+nombre+'\\s+(\\d{1,2}(?:\\.\\d+)?)%\\s+Amparada\\s+Sin Costo\\s*$','mi').exec(t);
  if(incremento)coberturas.push({tipo,nombre,porcentaje:Number(incremento[1]),fuente:incremento[0].trim()});
 }
 const invalidez=coberturas.find(c=>c.tipo==='invalidez');
 if(invalidez){invalidez.ambitoSuma='inicial';invalidez.sumasPorAnio=null;}
 const inicial=coberturas.find(c=>c.tipo==='fallecimiento');
 if(inicial && tabla[0] && inicial.suma!==tabla[0].proteccion)error('La protección inicial no coincide con la tabla.');
 if(inicial?.aportacion!==undefined && tabla[0]){
  const aportaciones=coberturas.filter(c=>c.aportacion!==undefined).reduce((total,c)=>total+c.aportacion,0);
  if(Math.abs(aportaciones-tabla[0].aportacion)>100)error('Las aportaciones de coberturas identificadas no coinciden con la prima inicial; revisar si falta leer otra cobertura.');
 }
 // No convertir ninguna columna de protección por fallecimiento en suma de invalidez.
 if(/Invalidez Sin Espera/i.test(t) && !coberturas.some(c=>c.tipo==='invalidez'))incidencias.push('Se menciona Invalidez Sin Espera: revisar contratación y sumas por año antes de mostrar una indemnización.');
 if(!coberturas.length)incidencias.push('No se identificaron filas completas de coberturas contratadas.');
 const definicion=/Proteccion Contratada\s*:\s*Cantidad que se entregara al final del plazo contratado o antes si ocurre el fallecimiento del Asegurado/i.exec(t);
 fuentes.fallecimiento=definicion?.[0]||null;
 const ultimo=tabla.at(-1);
 if(tablaValida){
  campos.plazoPlan={valor:String(vencimiento-edad),fuente:'Diferencia entre edad de vencimiento y edad inicial, contrastada con '+tabla.length+' filas.'};
  campos.proteccionInicial={valor:String(tabla[0].proteccion),fuente:tabla[0].fuente};
  campos.ahorro={valor:String(ultimo.efectivo),fuente:'Valor en Efectivo Proyectado · '+ultimo.fuente};
 }
 incidencias.push('La ilustración no sustituye la póliza. Pendiente verificar condiciones de invalidez, fallecimiento posterior a invalidez y terminación del plan.');
 return {campos,tabla,tablaValida,coberturas,fuentes,ahorroTipo:'proyectado',incidencias,estado:'borrador',generacionHabilitada:false};
}
module.exports={ilustracion,money};
