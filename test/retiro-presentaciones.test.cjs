const test=require('node:test'),assert=require('node:assert/strict');
const {vista}=require('../retiro/vista.cjs'),{paginas}=require('../retiro/recorrido.cjs');
const {ENFOQUES}=require('../retiro/modelo.cjs');
function modelo(n=35){return {campos:{cliente:{valor:'Persona de prueba'},edad:{valor:'25'},plazoPago:{valor:'10'},edadVencimiento:{valor:String(25+n)},ahorro:{valor:'640908500'}},tablaValida:true,tabla:Array.from({length:n},(_,i)=>({anio:i+1,edad:25+i,aportacion:i<10?10000:0,acumulado:Math.min(i+1,10)*10000,efectivo:i*20000,proteccion:500000+i*10000})),coberturas:[{tipo:'exencion'}],ahorroTipo:'proyectado'};}
test('Resumida conserva cifras y escenarios en dos páginas y detallada mantiene la tabla completa',()=>{
 const m=modelo(),antes=JSON.stringify(m);
 const resumida=vista(m,'retiro',{},6,{formato:'resumida',frase:'Tu frase de cierre.'}),detallada=vista(m,'retiro',{},6,{formato:'detallada'});
 assert.equal(paginas(m,'resumida'),2);assert.equal(paginas(m),3);assert.equal((resumida.match(/<section class="hoja/g)||[]).length,2);assert.doesNotMatch(resumida,/<table\b/);assert.match(resumida,/Tu frase de cierre/);assert.match(resumida,/2\/2/);
 for(const html of [resumida,detallada]){assert.match(html,/6,409,085/);assert.match(html,/año 6, a tus 30 años/);assert.match(html,/Exención de primas/);assert.match(html,/<polyline/);}
 assert.equal((detallada.match(/data-anio=/g)||[]).length,35);assert.equal(JSON.stringify(m),antes);
});
test('Resumida no comprime la tabla y el formato detallado continúa para planes largos',()=>{
 const m=modelo(60);assert.equal(paginas(m,'resumida'),2);assert.equal(paginas(m,'detallada'),4);assert.equal((vista(m,'retiro',{},6,{formato:'detallada'}).match(/data-anio=/g)||[]).length,60);assert.throws(()=>paginas(m,'otro'),/Presentación/);assert.throws(()=>vista(m,'retiro',{},6,{formato:'otro'}),/Presentación/);
});
test('Los cuatro enfoques mantienen cifras y cambian meta, texto e identidad visual',()=>{
 const m=modelo();for(const [clave,e]of Object.entries(ENFOQUES)){const html=vista(m,clave,{},6,{formato:'resumida'});assert.ok(html.includes(e.meta));assert.ok(html.includes(e.texto));assert.ok(html.includes(e.escenario));assert.match(html,/6,409,085/);}
});

test('El párrafo conecta la portada con el cliente y la exención suma las aportaciones posteriores',()=>{
 const m=modelo();
 m.tabla[7].aportacion=12500;
 m.tabla[8].aportacion=14000;
 m.tabla[9].aportacion=17550;
 const parrafo='Planea tus aportaciones para tu proyecto de <diseño>.';
 for(const formato of ['resumida','detallada']){
  const html=vista(m,'retiro',{},7,{parrafo,formato});
  assert.match(html,/PASO 1 · TU PROYECTO/);
  assert.match(html,/proyecto de &lt;diseño&gt;/);
  assert.match(html,/anualidad del año 7 ya pagada/);
  assert.match(html,/<b>3 aportaciones<\/b> \(años 8 al 10\)/);
  assert.match(html,/\$440.5/);
 }
 const despues=vista(m,'retiro',{},10,{parrafo});
 assert.match(despues,/no quedan aportaciones programadas/);
});
