const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {crearApp}=require('../server.cjs');const {Cola}=require('../cola.cjs');
const clave='clave-de-prueba-para-historial-32-caracteres';
const solicitud=nombre=>({nombre,edad:'45',genero:'Masculino',cp:'64000',familiares:[],tabulador:'D',deducible:'32000',acceso:'Amplio',alta:false,solidez:false});
test('historial: deducibles, detalles, búsqueda, paginación y eliminación real de documentos',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-historial-'));
 const {app,cola}=await crearApp({env:{APP_SECRET:clave,DATA_DIR:dir},ejecutor:async()=>({})});cola.cerrada=true;
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Bearer '+clave};let elegido;
 try{
  for(let i=0;i<12;i++){
   const id=require('crypto').randomUUID();const job={id,estado:i===0?'error':'completada',tipo:'pdf',solicitud:solicitud('Cliente '+String(i).padStart(2,'0')),creadaEn:new Date(1700000000000+i*1000).toISOString(),resultado:i===0?undefined:{folio:'FOLIO'+i,propuesta:'propuestas/cliente.pdf'}};
   await cola.guardar(job);cola.jobs.set(id,job);await fs.mkdir(path.join(cola.carpeta(id),'propuestas'),{recursive:true});
   await fs.writeFile(path.join(cola.carpeta(id),'gnp.pdf'),'%PDF-original');await fs.writeFile(path.join(cola.carpeta(id),'propuestas/cliente.pdf'),'%PDF-propuesta');
   if(i===11){elegido=job;await fs.writeFile(path.join(cola.carpeta(id),'propuestas/cliente.verificado.json'),JSON.stringify({folio:job.resultado.folio,monto:{total:1234567,descuento:10000},niveles:[],descuentoIncluidoEnNeta:true}));}
  }
  const config=await(await fetch(base+'/api/config',{headers})).json();assert.deepEqual(config.deducibles,['21000','32000','45000','56000','68000','87000','111000','128000','175000','233000']);
  const uno=await(await fetch(base+'/api/jobs?page=1',{headers})).json();assert.equal(uno.total,12);assert.equal(uno.items.length,10);assert.equal(uno.pages,2);
  assert.equal(uno.items[0].resultado.totalAnual,1234567);assert.equal(uno.items[0].solicitud.cp,'64000');
  const dos=await(await fetch(base+'/api/jobs?page=2',{headers})).json();assert.equal(dos.items.length,2);
  const buscado=await(await fetch(base+'/api/jobs?page=1&q=FOLIO11',{headers})).json();assert.equal(buscado.total,1);assert.equal(buscado.items[0].id,elegido.id);
  const errores=await(await fetch(base+'/api/jobs?page=1&estado=error',{headers})).json();assert.equal(errores.total,1);
  assert.equal((await fetch(base+'/api/jobs/'+elegido.id,{method:'DELETE'})).status,401);
  assert.equal((await fetch(base+'/api/jobs/'+elegido.id,{method:'DELETE',headers})).status,400);
  assert.equal((await fetch(base+'/api/jobs/'+elegido.id,{method:'DELETE',headers:{...headers,Origin:'https://otro.example','Content-Type':'application/json'},body:JSON.stringify({confirmar:true})})).status,403);
  const borrado=await fetch(base+'/api/jobs/'+elegido.id,{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({confirmar:true})});assert.equal(borrado.status,200);
  await assert.rejects(()=>fs.access(cola.carpeta(elegido.id)));
  assert.equal((await fetch(base+'/api/jobs/'+elegido.id+'/files/gnp',{headers})).status,404);
  const nuevo=new Cola(dir,async()=>({}));nuevo.cerrada=true;await nuevo.iniciar();assert.equal(nuevo.jobs.has(elegido.id),false);
 }finally{cola.cerrada=true;server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('no borra pendientes/procesando y termina una eliminación interrumpida al reiniciar',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-no-borrar-'));const c=new Cola(dir,async()=>({}));c.cerrada=true;
 try{
  for(const estado of ['pendiente','procesando']){const j={id:require('crypto').randomUUID(),estado,solicitud:solicitud('Prueba'),creadaEn:new Date().toISOString()};await c.guardar(j);c.jobs.set(j.id,j);await assert.rejects(()=>c.eliminar(j.id),/termine/);await fs.access(c.carpeta(j.id));}
  const id=require('crypto').randomUUID();const borrando=path.join(dir,'trabajos','.eliminando-'+id);await fs.mkdir(borrando);await fs.writeFile(path.join(borrando,'gnp.pdf'),'pdf');
  const reinicio=new Cola(dir,async()=>({}));reinicio.cerrada=true;await reinicio.iniciar();await assert.rejects(()=>fs.access(borrando));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
