const test=require('node:test');const assert=require('node:assert/strict');
const {analizar,ENFOQUES}=require('../retiro/modelo.cjs');const {vista}=require('../retiro/vista.cjs');
const texto='Proyecta GNP\nNombre del cliente: Cliente de prueba\nEdad: 52 años\nInflación: 3.7%\nPlazo de pago: 10 años\nPlazo del plan: 13 años\nAportación inicial anual: $100,000.00\nMoneda: MXN';
test('Retiro lee solo etiquetas explícitas, conserva evidencia y no fija inflación ni cifras de Oliver',()=>{
 const m=analizar(texto);assert.equal(m.campos.inflacion.valor,'3.7');assert.match(m.campos.inflacion.fuente,/3.7%/);assert.equal(m.campos.plazoPago.valor,'10');
 assert.equal(m.generacionHabilitada,false);assert.equal(m.campos.ahorro,undefined);assert.equal(m.campos.invalidez,undefined);
 const html=vista(m);assert.match(html,/3.7%/);assert.doesNotMatch(html,/2,341,111|5,894,970|344,184/);
});
test('Retiro no asigna protección por fallecimiento a invalidez ni infiere contratación por una mención',()=>{
 const m=analizar('Proyecta GNP\nProtección por fallecimiento: $3,000,000.00\nInvalidez Sin Espera no contratada\nExención de primas no contratada');
 assert.deepEqual(m.campos,{});assert.match(vista(m),/pendiente de contrastar/);assert.equal(m.generacionHabilitada,false);
});
test('Retiro señala contradicciones, plazos inválidos y documentos ajenos',()=>{
 const m=analizar(texto+'\nInflación: 5%');assert.equal(m.campos.inflacion,undefined);assert.ok(m.incidencias.some(i=>i.includes('contradictorios: inflacion')));
 const plazos=analizar(texto.replace('13 años','8 años'));assert.equal(plazos.campos.plazoPago,undefined);assert.ok(plazos.incidencias.some(i=>i.includes('excede')));
 assert.throws(()=>analizar('Personaliza GNP'),/Proyecta/);
});
test('Retiro ofrece cuatro enfoques, tres páginas y escapa datos del PDF',()=>{
 const m=analizar(texto.replace('Cliente de prueba','<script>alert(1)</script>'));
 for(const [k,e]of Object.entries(ENFOQUES)){const html=vista(m,k);assert.match(html,new RegExp(e.subtitulo.replace('.','\\.')));assert.equal((html.match(/<section class="hoja/g)||[]).length,3);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);}
 assert.throws(()=>vista(m,'otro'),/Enfoque/);
});
test('Retiro protege la carga y la vista previa y valida archivos y enfoques',async()=>{
 const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const {crearApp}=require('../server.cjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'retiro-'));const secreto='prueba-local-retiro-no-usar-en-produccion';
 const {app,cola}=await crearApp({env:{APP_SECRET:secreto,DATA_DIR:dir}});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;const headers={Authorization:'Bearer '+secreto};
 try{
 assert.equal((await fetch(base+'/api/retiro/preview',{method:'POST'})).status,401);
 assert.equal((await fetch(base+'/api/retiro/x/vista')).status,401);
 const form=new FormData();form.append('pdf',new Blob(['no pdf']),'x.pdf');assert.equal((await fetch(base+'/api/retiro/preview',{method:'POST',headers,body:form})).status,400);
 const bad=new FormData();bad.append('enfoque','<script>');assert.equal((await fetch(base+'/api/retiro/preview',{method:'POST',headers,body:bad})).status,400);
 assert.equal((await fetch(base+'/api/retiro/x/vista',{headers})).status,404);
 }finally{cola.cerrada=true;server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
