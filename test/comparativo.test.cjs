const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {solicitud}=require('../solicitud.cjs');
const {ejecutarComparativo,validarComparacion,documentoComparativo}=require('../comparativo.cjs');
const base={nombre:'Cliente <prueba>',edad:'40',genero:'Masculino',cp:'64990',familiares:[],tabulador:'A',deducible:'32000',acceso:'Amplio',alta:false,modalidad:'comparativo',opciones:[{deducible:'32000',tabulador:'A'},{deducible:'56000',tabulador:'B'},{deducible:'87000',tabulador:'D'}]};
const datos=s=>({schemaVersion:1,nombre:s.nombre,folio:'folio-'+s.deducible,plan:'Personaliza Variable',asegurados:[{edad:40,genero:s.genero,cp:s.cp}],acceso:s.acceso,suma:9328000000,altaSolicitada:s.alta,altaConfirmada:false,solidezSolicitada:false,tabulador:s.tabulador,vence:'26/Oct/2026',monto:{total:Number(s.deducible)*20},niveles:['A','B','C','D'].map((nivel,i)=>({nivel,deducible:Number(s.deducible)*100-i*100000,porcentaje:20-i*5,tope:9400000-i*1000000})),advertencias:[],coberturas:[],asistencias:{}});
test('valida opciones distintas y conserva perfil único',()=>{
 const s=solicitud(base);assert.equal(s.opciones.length,3);assert.equal(s.tabulador,'A');
 assert.throws(()=>solicitud({...base,opciones:[base.opciones[0],base.opciones[0]]}),/distintas/);
 assert.throws(()=>solicitud({...base,opciones:[{deducible:'1',tabulador:'Z'},base.opciones[0]]}),/Revisa/);
 assert.throws(()=>validarComparacion([datos(base),{...datos(base),acceso:'Esencial'}]),/mismo perfil/);
});
test('cotiza tres opciones secuenciales, guarda originales y no genera PDF con fallo parcial',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'comparativo-'));const llamadas=[];let generado=false;
 const dependencias={env:{},cotizar:async(s,p)=>{llamadas.push(s);await fs.writeFile(p,'%PDF-prueba');return s;},leer:async(p,s)=>datos(s),generar:async(d,o)=>{generado=true;assert.equal(d.opciones.length,3);assert.ok(documentoComparativo('logo','qr',d).includes('Cliente &lt;prueba&gt;'));return path.join(dir,'propuestas','comparativo.pdf');}};
 try{
  const r=await ejecutarComparativo({id:'prueba',solicitud:solicitud(base)},dir,dependencias);assert.equal(r.opciones.length,3);assert.equal(generado,true);assert.equal(llamadas.length,3);assert.ok(llamadas.every(s=>!s.opciones&&s.cp===base.cp));
  for(let i=1;i<=3;i++)assert.equal(await fs.readFile(path.join(dir,'opcion-'+i,'gnp.pdf'),'utf8'),'%PDF-prueba');
  generado=false;let n=0;
  await assert.rejects(ejecutarComparativo({id:'otra',solicitud:solicitud(base)},dir,{...dependencias,cotizar:async(s,p)=>{if(++n===2)throw new Error('portal no disponible');return dependencias.cotizar(s,p);}}),/Opción 2/);assert.equal(generado,false);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
module.exports={base,datos};
test('API protege y entrega cada original; PDF único no puede simular comparativo',async()=>{
 const {crearApp}=require('../server.cjs');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'api-comparativo-'));const secreto='q'.repeat(40);await fs.writeFile(path.join(dir,'logo-quillum.png'),Buffer.from([137,80,78,71,13,10,26,10]));
 const {app,cola}=await crearApp({env:{APP_SECRET:secreto,DATA_DIR:dir,GNP_USERNAME:'prueba',GNP_PASSWORD:'prueba'},ejecutor:async(j,d)=>{
  for(let i=1;i<=3;i++){await fs.mkdir(path.join(d,'opcion-'+i));await fs.writeFile(path.join(d,'opcion-'+i,'gnp.pdf'),'%PDF-opcion-'+i);}
  await fs.writeFile(path.join(d,'comparativo.pdf'),'%PDF-comparativo');return {propuesta:'comparativo.pdf',folio:'1 / 2 / 3',opciones:[],advertencias:[]};
 }});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;const headers={Authorization:'Bearer '+secreto,'Content-Type':'application/json'};
 try{
  const creado=await fetch(url+'/api/jobs',{method:'POST',headers,body:JSON.stringify(base)});assert.equal(creado.status,202);const j=await creado.json();
  for(let i=0;i<50&&cola.jobs.get(j.id).estado!=='completada';i++)await new Promise(r=>setTimeout(r,10));assert.equal(cola.jobs.get(j.id).estado,'completada');
  assert.equal((await fetch(url+'/api/jobs/'+j.id+'/files/gnp-1')).status,401);
  for(let i=1;i<=3;i++)assert.equal(await (await fetch(url+'/api/jobs/'+j.id+'/files/gnp-'+i,{headers})).text(),'%PDF-opcion-'+i);
  const pdf=await fetch(url+'/api/jobs/'+j.id+'/files/propuesta',{headers});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-disposition'),/Comparativo-QUILLUM.pdf/);
  assert.equal((await fetch(url+'/api/jobs/'+j.id+'/files/gnp-4',{headers})).status,404);
  const form=new FormData();form.append('solicitud',JSON.stringify(base));form.append('pdf',new Blob(['%PDF-prueba']),'gnp.pdf');assert.equal((await fetch(url+'/api/pdf',{method:'POST',headers:{Authorization:headers.Authorization},body:form})).status,400);
 }finally{cola.cerrada=true;server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
