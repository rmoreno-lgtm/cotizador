const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {Cola}=require('../cola.cjs');
const s={nombre:'Prueba'};
const esperar=async(fn)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('La cola no terminó.');};
test('una sola ejecución simultánea; solicitudes idénticas no se duplican',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-cola-'));let simultaneas=0,maximo=0,ejecuciones=0;
 const c=new Cola(dir,async()=>{ejecuciones++;maximo=Math.max(maximo,++simultaneas);await new Promise(r=>setTimeout(r,30));simultaneas--;return{ok:true};});await c.iniciar();
 try{
  const [a,b]=await Promise.all([c.crear(s,'pdf',Buffer.from('a'),'misma'),c.crear(s,'pdf',Buffer.from('a'),'misma')]);
  assert.equal(a.id,b.id);await c.crear(s,'pdf',Buffer.from('b'),'otra');
  await esperar(()=>[...c.jobs.values()].every(j=>j.estado==='completada'));
  assert.equal(maximo,1);assert.equal(ejecuciones,2);
  await assert.rejects(()=>c.crear({nombre:'Otra'},'pdf',Buffer.from('a'),'misma'),/distintos/);
 }finally{c.cerrada=true;await fs.rm(dir,{recursive:true,force:true});}
});
test('reinicio conserva la cola y marca trabajos interrumpidos para revisión',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-reinicio-'));
 const c=new Cola(dir,async()=>({ok:true}));c.cerrada=true;
 try{
  c.cerrada=false;c.ocupada=true;const a=await c.crear(s,'pdf',Buffer.from('x'),'a');
  const b=await c.crear(s,'pdf',Buffer.from('y'),'b');
  a.estado='procesando';await c.guardar(a);
  const nuevo=new Cola(dir,async()=>({ok:true}));await nuevo.iniciar();
  await esperar(()=>nuevo.jobs.get(b.id)?.estado==='completada');
  assert.equal(nuevo.jobs.get(a.id).estado,'error');assert.match(nuevo.jobs.get(a.id).error,/reinició/);
  await nuevo.reintentar(a.id);await esperar(()=>nuevo.jobs.get(a.id).estado==='completada');nuevo.cerrada=true;
 }finally{c.cerrada=true;await fs.rm(dir,{recursive:true,force:true});}
});
