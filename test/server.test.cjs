const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {crearApp,limpiarError}=require('../server.cjs');
const {solicitud}=require('../solicitud.cjs');
const secreto='clave-de-prueba-de-32-caracteres-minimo';
const s=()=>({nombre:'Cliente',edad:'45',genero:'Masculino',cp:'64000',familiares:[],deducible:'32000',tabulador:'D',acceso:'Amplio',alta:false});
test('normalización rechaza datos inválidos y no confía en verificación enviada por el cliente',()=>{
 const b=s();b.genero='masculino';b.acceso='amplio';b.altaVerificadaEnPortal=true;
 const r=solicitud(b);assert.equal(r.acceso,'Amplio');assert.equal(r.genero,'Masculino');assert.equal(r.altaVerificadaEnPortal,undefined);
 b.cp='6400';assert.throws(()=>solicitud(b),/CP/);
 const familia=s();familia.familiares=[1,2,3].map(e=>({edad:String(e),genero:'Femenino'}));assert.equal(solicitud(familia).solidez,true);
 const inv=s();inv.alta='true';assert.throws(()=>solicitud(inv),/sí o no/);
});
test('protege solicitudes y PDF, valida archivos y bloquea orígenes ajenos',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-http-'));
 const {app,cola}=await crearApp({env:{APP_SECRET:secreto,DATA_DIR:dir},ejecutor:async()=>({folio:'123'})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Bearer '+secreto};
 try{
  assert.equal((await fetch(base+'/healthz')).status,200);
  assert.equal((await fetch(base+'/api/jobs')).status,401);
  assert.equal((await fetch(base+'/api/jobs/abc/files/gnp')).status,401);
  assert.equal((await fetch(base+'/api/jobs',{method:'POST',headers:{...headers,Origin:'https://otro.example','Content-Type':'application/json'},body:JSON.stringify(s())})).status,403);
  const invalid=new FormData();invalid.append('logo',new Blob(['no png']),'logo.png');
  assert.equal((await fetch(base+'/api/logo',{method:'POST',headers,body:invalid})).status,400);
  assert.equal((await fetch(base+'/api/jobs',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(s())})).status,409);
  const login=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({clave:secreto}),redirect:'manual'});
  assert.equal(login.status,302);assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  const cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/config',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(base+'/api/config',{headers:{Cookie:cookie+'x'}})).status,401);
  assert.equal(limpiarError(new Error('Contraseña abc-clave'),{GNP_PASSWORD:'abc-clave'}),'Contraseña [oculto]');
 }finally{cola.cerrada=true;server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
