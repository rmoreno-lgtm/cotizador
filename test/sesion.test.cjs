const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');
const {crearApp}=require('../server.cjs');
const secreto='secreto-interno-de-prueba-de-32-caracteres';
const password='contraseña-de-prueba-2026';
async function iniciar(dir,extra={}) {
 const {app,cola}=await crearApp({env:{APP_SECRET:secreto,APP_USERNAME:'ricardo',APP_PASSWORD:password,DATA_DIR:dir,NODE_ENV:'production',...extra}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 return{url:'http://127.0.0.1:'+server.address().port,cerrar:async()=>{cola.cerrada=true;server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
const entrar=(url,datos)=>fetch(url+'/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(datos),redirect:'manual'});
test('usuario/contraseña y recordar 30 días; la cookie sirve después de reiniciar',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-sesion-'));let app=await iniciar(dir);
 try{
  assert.equal((await entrar(app.url,{usuario:'otro',clave:password})).status,401);
  assert.equal((await entrar(app.url,{usuario:'ricardo',clave:secreto})).status,401);
  const normal=await entrar(app.url,{usuario:'ricardo',clave:password});assert.match(normal.headers.get('set-cookie'),/Max-Age=86400/);
  const r=await entrar(app.url,{usuario:'ricardo',clave:password,recordar:'si'});assert.equal(r.status,302);
  const header=r.headers.get('set-cookie');assert.match(header,/Max-Age=2592000/);assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Lax/);
  const cookie=header.split(';')[0];await app.cerrar();app=await iniciar(dir);
  assert.equal((await fetch(app.url+'/api/config',{headers:{Cookie:cookie}})).status,200);
  const login=await fetch(app.url+'/login',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(login.status,302);assert.equal(login.headers.get('location'),'/');
  await app.cerrar();app=await iniciar(dir,{APP_PASSWORD:'otra-contraseña-2026'});
  assert.equal((await fetch(app.url+'/api/config',{headers:{Cookie:cookie}})).status,401);
  assert.equal((await fetch(app.url+'/api/config',{headers:{Authorization:'Bearer '+secreto}})).status,200);
 }finally{await app.cerrar();await fs.rm(dir,{recursive:true,force:true});}
});
test('sesión caducada requiere entrar nuevamente',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-caducada-'));const app=await iniciar(dir);
 try{
  const r=await entrar(app.url,{usuario:'ricardo',clave:password,recordar:'si'});
  const raw=r.headers.get('set-cookie').split(';')[0].slice(8);const [payload]=raw.split('.');const d=JSON.parse(Buffer.from(payload,'base64url').toString());d.exp=Date.now()-1;
  const p=Buffer.from(JSON.stringify(d)).toString('base64url');const firma=crypto.createHmac('sha256',secreto).update(p).digest('base64url');
  assert.equal((await fetch(app.url+'/api/config',{headers:{Cookie:'quillum='+p+'.'+firma}})).status,401);
 }finally{await app.cerrar();await fs.rm(dir,{recursive:true,force:true});}
});
