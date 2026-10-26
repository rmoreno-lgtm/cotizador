const test=require('node:test'),assert=require('node:assert/strict');
const {analizar,ejercicio}=require('../ppr/modelo.cjs');const {vista,paginas}=require('../ppr/vista.cjs');
const importe=n=>'$'+n.toLocaleString('en-US');
function documento({pago=5,compacta=false,edad=55}={}){
 const n=65-edad;let acumulado=0;
 const filas=Array.from({length:n},(_,i)=>{const a=i<pago?200000:0,d=i<pago?192824:0;acumulado+=a;return `${i+1} ${edad+i} ${importe(a)} ${compacta?'':importe(acumulado)+' '}${importe(i*100000)} ${compacta?'':'0% '}${importe(1000000+i*50000)} ${importe(d)}`;}).join('\n');
 return `Consolida GNP\nApreciable: Persona de prueba\nEdad del solicitante: ${edad} anos\nPlazo: Edad 65 anos\n${compacta?'':'Plazo de pago: '+pago+' anos\n'}Inflacion: 3.50%\nMoneda: Nacional\nCon Consolida, realizando una aportacion de $200,000 pesos anuales, durante ${pago} anos obtienes\nProteccion por Fallecimiento/Supervivencia $1,000,000 $200,000\nMonto Deducible al Art. 151 (PPR)\n${filas}\n${compacta?'':'DISTRIBUCION DE LA PRIMA DE RETIRO\nPrima de retiro: $192,824\nArt 93 (No deducible) 0% $0\nArt 151 fracc. V LISR 100% $192,824\nArt 185 LISR 0% $0'}`;
}
test('Consolida separa prima y monto deducible: ejercicio supuesto 30%, no descuento ni devolución',()=>{
 const m=analizar(documento()),original=JSON.stringify(m);assert.equal(m.tablaValida,true);const e=ejercicio(m),f=e.filas[0];assert.equal(f.aportacion,20000000);assert.equal(f.deducible,19282400);assert.equal(f.beneficio,5784720);assert.equal(f.neto,14215280);assert.equal(e.tasa,30);assert.equal(e.totales.neto,e.totales.aportacion-e.totales.beneficio);assert.equal(JSON.stringify(m),original);
 const html=vista(m);assert.match(html,/No es una devolución garantizada/);assert.match(html,/GNP recibe la prima completa/);assert.match(html,/142,152.8/);assert.match(html,/EJERCICIO ILUSTRATIVO/);assert.equal((html.match(/<section class="hoja/g)||[]).length,3);
});
test('Lee pagos de 5, 10 y hasta el vencimiento, sin usar un plazo o inflación fijos',()=>{
 for(const opciones of [{pago:5},{pago:10},{pago:9,edad:56,compacta:true}]){const m=analizar(documento(opciones));assert.equal(m.tablaValida,true);assert.equal(+m.campos.plazoPago.valor,opciones.pago);assert.equal(m.campos.inflacion.valor,'3.5');assert.equal(m.tabla.filter(f=>f.aportacion>0).length,opciones.pago);const e=ejercicio(m);for(const f of e.filas.filter(f=>f.anio>opciones.pago)){assert.equal(f.beneficio,0);assert.equal(f.neto,0);}}
 const compacta=analizar(documento({compacta:true}));assert.equal(compacta.formatoTabla,'compacta');assert.equal(compacta.tabla[1].acumulado,40000000);assert.ok(compacta.incidencias.some(i=>i.includes('sumando')));
});
test('Rechaza tablas incompletas, deducciones mayores que la prima, distribución contradictoria y mezcla con 185',()=>{
 const t=documento();for(const roto of [t.replace('2 56 $200,000 $400,000 $100,000 0% $1,050,000 $192,824\n',''),t.replace('$192,824\n2 56','$300,000\n2 56'),t.replace('$400,000 $100,000','$999,999 $100,000'),t.replace('Art 151 fracc. V LISR 100% $192,824','Art 151 fracc. V LISR 100% $190,000'),t.replace('Art 185 LISR 0% $0','Art 185 LISR 10% $100'),t.replace('Moneda: Nacional','Moneda: USD'),t.replace('Plazo de pago: 5 anos','Plazo de pago: 4 anos'),t.replace('Edad 65 anos','Edad 64 anos')]){const m=analizar(roto);assert.equal(m.tablaValida,false);assert.throws(()=>ejercicio(m));assert.throws(()=>vista(m));}
 assert.throws(()=>analizar(t.replaceAll('Art. 151','Art. 185')),/columna/);assert.throws(()=>analizar(t.replaceAll('Consolida','Proyecta')),/Consolida/);
});
test('Redondea el beneficio a centavos y conserva neto positivo y la contribución original',()=>{
 const e=ejercicio({tablaValida:true,tabla:[{aportacion:10,deducible:5},{aportacion:0,deducible:0}]});assert.equal(e.filas[0].beneficio,2);assert.equal(e.filas[0].neto,8);assert.equal(e.filas[1].beneficio,0);
});
test('Ambos formatos conservan el ejercicio y escapan nombres; el detallado incluye cada año',()=>{
 const m=analizar(documento());m.campos.cliente.valor='<script>alert(1)</script>';
 for(const formato of ['resumida','detallada']){const html=vista(m,{}, {formato});assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/57,847.2/);assert.match(html,/30%/);assert.equal((html.match(/<section class="hoja/g)||[]).length,formato==='resumida'?2:3);assert.equal(/<table>/.test(html),formato==='detallada');}
 assert.equal(paginas({tabla:Array(30)},'detallada'),4);assert.throws(()=>paginas(m,'otro'));
});
test('La API de PPR requiere sesión y valida archivos y borradores',async()=>{
 const fs=require('node:fs/promises'),{crearApp}=require('../server.cjs'),dir=await fs.mkdtemp('/tmp/ppr-test-');const {app,cola}=await crearApp({env:{APP_SECRET:'secreto-local-de-prueba-no-utilizar-en-produccion',DATA_DIR:dir}}),s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));const base='http://127.0.0.1:'+s.address().port,headers={Authorization:'Bearer secreto-local-de-prueba-no-utilizar-en-produccion'};
 try{assert.equal((await fetch(base+'/api/ppr/preview',{method:'POST'})).status,401);assert.equal((await fetch(base+'/api/ppr/x/pdf')).status,401);assert.equal((await fetch(base+'/api/ppr/x/vista')).status,401);assert.equal((await fetch(base+'/api/ppr/x/vista',{headers})).status,404);const form=new FormData();form.append('pdf',new Blob(['sin pdf']),'x.pdf');assert.equal((await fetch(base+'/api/ppr/preview',{method:'POST',headers,body:form})).status,400);}finally{cola.cerrada=true;s.closeAllConnections();await new Promise(r=>s.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
