const test=require('node:test');const assert=require('node:assert/strict');
const {analizar}=require('../retiro/modelo.cjs');const {vista}=require('../retiro/vista.cjs');
const texto=`Proyecta GNP
Apreciable: Persona de prueba
Edad del solicitante: 40 anos
Inflacion: 3.70%
Plazo: Edad 43 anos Plazo de pago: 2 anos
Moneda: Nacional
Con Proyecta, realizando una aportacion de $100 pesos anuales
Coberturas Contratadas Suma Asegurada Aportacion
Proteccion por Fallecimiento/Supervivencia $1,000 $90
Exencion de Pago de Primas por Invalidez Total y Permanente Amparada $10
Prima Anual Acumulada Valor en Efectivo Proyectado
1 40 $100 $100 $0 0% $1,000
2 41 $103.70 $203.70 $150 74% $1,037
3 42 $0 $203.70 $300 147% $300
Proteccion Contratada:Cantidad que se entregara al final del plazo contratado o antes si ocurre el fallecimiento del Asegurado`;
test('Ilustración separa efectivo proyectado, primas, protección y exención; muestra solo coberturas identificadas',()=>{
 const m=analizar(texto);assert.equal(m.tablaValida,true);assert.equal(m.tabla.length,3);assert.equal(m.campos.inflacion.valor,'3.7');assert.equal(m.campos.ahorro.valor,'30000');assert.equal(m.ahorroTipo,'proyectado');assert.equal(m.coberturas.find(c=>c.tipo==='exencion').aportacion,1000);assert.equal(m.generacionHabilitada,false);
 const html=vista(m,'retiro',{},2);assert.match(html,/data-anio="2"/);assert.match(html,/\$150/);assert.match(html,/año 2 · 41 años/);assert.match(html,/Exención de primas/);assert.doesNotMatch(html,/Invalidez Sin Espera/);assert.match(html,/\$300/);assert.match(html,/Valor proyectado/);assert.match(html,/<polyline/);
});
test('Ilustración rechaza tabla incompleta, duplicada, con acumulado incoherente o años incongruentes',()=>{
 for(const t of [texto.replace('2 41 $103.70 $203.70 $150 74% $1,037\n',''),texto.replace('3 42','2 42'),texto.replace('$203.70 $150','$500 $150'),texto.replace('3 42','3 43')]){
  const m=analizar(t);assert.equal(m.tablaValida,false);assert.equal(m.campos.ahorro,undefined);assert.doesNotMatch(vista(m),/<polyline/);
 }
});
test('Ilustración señala errores de OCR y no corrige cifras sin evidencia',()=>{
 const m=analizar(texto.replace('$150 74%','$150 4%'));assert.equal(m.tabla[1].recuperacion,null);assert.equal(m.tabla[1].recuperacionLeida,4);assert.ok(m.incidencias.some(i=>i.includes('porcentaje')));assert.equal(m.tabla[1].efectivo,15000);
 const diferente=analizar(texto.replace('3.70%','7.25%'));assert.equal(diferente.campos.inflacion.valor,'7.25');
});
test('Ilustración no interpreta una mención de invalidez como indemnización contratada',()=>{
 const m=analizar(texto+'\nInvalidez Sin Espera: sujeta a contratacion');assert.equal(m.coberturas.some(c=>c.tipo==='indemnizacion'),false);assert.ok(m.incidencias.some(i=>i.includes('Invalidez Sin Espera')));
 const sin=analizar(texto.replace('Exencion de Pago de Primas por Invalidez Total y Permanente Amparada $10',''));assert.doesNotMatch(vista(sin),/h4>Exención de primas/);
});

test("Ilustración reconoce unidades de años con errores OCR sin modificar importes",()=>{const m=analizar(texto.replace("2 anos","2 afhos").replace("43 anos","43 anhos"));assert.equal(m.tablaValida,true);assert.equal(m.campos.plazoPago.valor,"2");});

test('Suma la prima de Invalidez Sin Espera cuando su fila acredita contratación',()=>{
 const t=texto.replace('$1,000 $90','$1,000 $85').replace('Prima Anual Acumulada','Invalidez Sin Espera $700 $5\nIncremento Mujer 20% Amparada Sin Costo\nPrima Anual Acumulada');
 const m=analizar(t);assert.equal(m.tablaValida,true);assert.equal(m.coberturas.reduce((n,c)=>n+(c.aportacion||0),0),10000);
 const c=m.coberturas.find(c=>c.tipo==='invalidez');assert.equal(c.suma,70000);assert.equal(c.aportacion,500);assert.equal(c.ambitoSuma,'inicial');assert.equal(c.sumasPorAnio,null);assert.ok(m.coberturas.some(c=>c.tipo==='mujer'&&c.porcentaje===20));
 assert.ok(!m.incidencias.some(i=>i.includes('no coinciden')||i.includes('Se menciona Invalidez Sin Espera')));
 const escenario=require('../retiro/escenario-invalidez.cjs').escenarioInvalidez(m,m.tabla[1]);assert.match(escenario,/Invalidez Sin Espera/);assert.match(escenario,/\$700/);assert.match(escenario,/Exención de primas/);assert.match(escenario,/año 2 queda por verificar/);assert.doesNotMatch(escenario,/\$1,037/);
});
test('Una mención no acredita contratación y una prima faltante sigue impidiendo validar',()=>{
 const t=texto.replace('$1,000 $90','$1,000 $85')+'\nInvalidez Sin Espera No Contratada';const m=analizar(t);
 assert.equal(m.tablaValida,false);assert.equal(m.campos.ahorro,undefined);assert.ok(!m.coberturas.some(c=>c.tipo==='invalidez'));assert.ok(m.incidencias.some(i=>i.includes('no coinciden')));
 const caso=analizar(texto.replace('Exencion de Pago de Primas por Invalidez Total y Permanente Amparada $10','Invalidez Sin Espera $700 $10'));
 assert.equal(caso.tablaValida,true);const escenario=require('../retiro/escenario-invalidez.cjs').escenarioInvalidez(caso,caso.tabla[0]);assert.match(escenario,/Invalidez Sin Espera/);assert.doesNotMatch(escenario,/h4>Exención de primas/);
});
test('La vista conserva los 35 años en una sola tabla continua',()=>{
 const cabecera=texto.split('Prima Anual Acumulada')[0].replace('40 anos','25 anos').replace('43 anos','60 anos').replace('2 anos','10 anos');
 const filas=Array.from({length:35},(_,i)=>`${i+1} ${25+i} $${i<10?100:0} $${Math.min(i+1,10)*100} $${(i+1)*50} ${Math.round(100*(i+1)*50/(Math.min(i+1,10)*100))}% $${1000+i*10}`).join('\n');
 const m=analizar(cabecera+'Prima Anual Acumulada Valor en Efectivo Proyectado\n'+filas);assert.equal(m.tablaValida,true);assert.equal(m.tabla.length,35);
 const html=vista(m);assert.doesNotMatch(html,/tablas-anuales/);assert.equal((html.match(/<table /g)||[]).length,1);assert.equal((html.match(/data-anio=/g)||[]).length,35);assert.match(html,/<b>35<\/b><\/td><td>59<\/td>/);assert.match(html,/Última aportación/);assert.match(html,/aportación \$0/);
});
