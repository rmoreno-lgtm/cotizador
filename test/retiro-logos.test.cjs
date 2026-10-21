const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const {almacenLogos}=require('../retiro/logos.cjs');const {crearApp}=require('../server.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test('guarda logos para próximas propuestas, comparte QUILLUM con GMM y conserva el otro logo al reemplazar uno',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'logos-retiro-'));
 try{const almacen=almacenLogos(dir);await fs.writeFile(path.join(dir,'logo-quillum.png'),png);assert.ok((await almacen.leer()).quillum);await almacen.guardar({gnp:png});const siguiente=almacenLogos(dir);const logos=await siguiente.leer();assert.ok(logos.gnp&&logos.quillum);await siguiente.guardar({quillum:png});assert.equal((await siguiente.leer()).gnp,logos.gnp);
 await assert.rejects(siguiente.guardar({quillum:Buffer.from('no PNG'),gnp:png}),/PNG/);assert.deepEqual(await siguiente.leer(),logos);await assert.rejects(siguiente.guardar({quillum:png.subarray(0,45)}),/PNG/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('API de logos requiere sesión, persiste tras reiniciar la app y la descarga está protegida',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'logos-http-'));const env={APP_SECRET:'clave-sintetica-de-prueba-de-al-menos-32',DATA_DIR:dir};let servidor,cola;
 async function iniciar(){const app=await crearApp({env});cola=app.cola;servidor=app.app.listen(0,'127.0.0.1');await new Promise(r=>servidor.once('listening',r));return 'http://127.0.0.1:'+servidor.address().port;}
 async function cerrar(){cola.cerrada=true;servidor.closeAllConnections();await new Promise(r=>servidor.close(r));}
 try{let base=await iniciar();const headers={Authorization:'Bearer '+env.APP_SECRET};assert.equal((await fetch(base+'/api/retiro/logos')).status,401);assert.equal((await fetch(base+'/api/retiro/x/pdf')).status,401);
 const form=new FormData();for(const marca of ['quillum','gnp'])form.append(marca,new Blob([png],{type:'image/png'}),marca+'.png');assert.equal((await fetch(base+'/api/retiro/logos',{method:'POST',headers,body:form})).status,200);await cerrar();base=await iniciar();assert.deepEqual(await(await fetch(base+'/api/retiro/logos',{headers})).json(),{quillum:true,gnp:true});assert.equal((await fetch(base+'/api/retiro/x/pdf',{headers})).status,404);
 }finally{await cerrar();await fs.rm(dir,{recursive:true,force:true});}
});
