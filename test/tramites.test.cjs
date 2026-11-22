const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const express=require('express');
const {crearApp}=require('../server.cjs');
const {registrar}=require('../tramites/rutas.cjs');
const {ConsultaIncompleta}=require('../tramites/portal.cjs');

test('Trámites exige autenticación y usa la configuración de GNP existente',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-tramites-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const clave='clave-local-de-pruebas-de-tramites';
  const {app}=await crearApp({env:{APP_SECRET:clave,DATA_DIR:dir}});
  const server=await escuchar(app,t);
  assert.equal((await fetch(server+'/api/tramites')).status,401);
  const headers={Authorization:'Bearer '+clave};
  assert.deepEqual(await (await fetch(server+'/api/tramites',{headers})).json(),{
    configurado:false,enCurso:false,error:null,exploracion:[],ultimaConsulta:null,vistaPrevia:null
  });
  assert.equal((await fetch(server+'/api/tramites/actualizar',{method:'POST',headers})).status,503);
});

async function escuchar(app,t) {
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port;
}

test('consolida actualizaciones simultáneas y conserva el último resultado tras un fallo',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-tramites-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const app=express();
  let consultas=0;
  let completar;
  const muestra={columnas:['Folio','Estado','Columna adicional'],filas:[['A-1','En proceso','Sintético'],['A-2','Cerrado','Sintético']]};
  const esperado={tramites:[{folio:'A-1',estado:'En proceso'}],paginas:1};
  registrar(app,{base:dir,env:{GNP_USERNAME:'prueba',GNP_PASSWORD:'prueba'},consultarPortal:async(env,paso,modo)=>{
    paso('Servicios asistidos');
    if(modo==='vista')return muestra;
    consultas++;
    if(consultas>1)throw new ConsultaIncompleta('La tabla cambió.');
    return await new Promise(resolve=>{completar=resolve;});
  }});
  const base=await escuchar(app,t);
  const actualizar=()=>fetch(base+'/api/tramites/actualizar',{method:'POST'});
  const estado=async()=>await (await fetch(base+'/api/tramites')).json();
  assert.equal((await actualizar()).status,409);
  assert.equal((await fetch(base+'/api/tramites/vista',{method:'POST'})).status,202);
  const previa=await estado();
  assert.deepEqual(previa.vistaPrevia.filas,muestra.filas);
  assert.equal(previa.ultimaConsulta,null);
  await assert.rejects(fs.access(path.join(dir,'tramites-gnp.json')),{code:'ENOENT'});
  assert.deepEqual((await Promise.all([actualizar(),actualizar()])).map(r=>r.status),[202,202]);
  assert.equal(consultas,1);
  assert.equal((await estado()).enCurso,true);
  completar(esperado);
  let resultado=await estado();
  for(let i=0;i<50 && resultado.enCurso;i++) {
    await new Promise(r=>setTimeout(r,10));
    resultado=await estado();
  }
  assert.equal(resultado.enCurso,false);
  assert.deepEqual(resultado.ultimaConsulta.tramites,esperado.tramites);
  assert.equal(await actualizar().then(r=>r.status),202);
  const fallo=await estado();
  assert.equal(fallo.error,'La tabla cambió.');
  assert.deepEqual(fallo.ultimaConsulta,resultado.ultimaConsulta);
  assert.deepEqual(fallo.exploracion,['Servicios asistidos']);
});
