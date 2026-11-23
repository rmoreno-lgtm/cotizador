const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const express=require('express');
const reglas=require('../tramites/reglas.cjs');
const {leerDetalle,mapearFila,fechaIso}=require('../tramites/lector.cjs');
const {registrar}=require('../tramites/rutas.cjs');
const {crearVigilancias}=require('../tramites/vigilancias.cjs');
const {enviarAviso}=require('../tramites/avisos.cjs');

const base={nombre:'GMM abiertos',seccion:'gmm',estatus:['Activada','En Registro'],fechaDesde:'2026-11-23',cadaMinutos:180,
  horario:{dias:[1,2,3,4,5],desde:'08:00',hasta:'20:00'},correos:'equipo@quillum.com.mx',whatsapp:'5218180202414'};

test('valida reglas y rechaza datos incorrectos',()=>{
  const r=reglas.validarRegla(base);
  assert.deepEqual(r.estatus,['Activada','En Registro']);
  assert.deepEqual(r.correos,['equipo@quillum.com.mx']);
  assert.deepEqual(r.whatsapp,['5218180202414']);
  assert.equal(r.leerObservaciones,true);
  assert.throws(()=>reglas.validarRegla({...base,cadaMinutos:5}),reglas.ReglaInvalida);
  assert.throws(()=>reglas.validarRegla({...base,estatus:['Inventado']}),reglas.ReglaInvalida);
  assert.throws(()=>reglas.validarRegla({...base,correos:'no-es-correo'}),reglas.ReglaInvalida);
  assert.throws(()=>reglas.validarRegla({...base,horario:{dias:[1],desde:'20:00',hasta:'08:00'}}),reglas.ReglaInvalida);
  assert.throws(()=>reglas.validarRegla({...base,fechaDesde:'2026-02-30'}),reglas.ReglaInvalida);
  assert.equal(reglas.validarRegla({...base,seccion:'vida',estatus:['activada']}).leerObservaciones,false);
});

test('respeta el horario y los días en la zona del despacho',()=>{
  const r=reglas.validarRegla(base);
  // Lunes 23-nov-2026 10:00 en Monterrey = 16:00 UTC.
  assert.equal(reglas.enHorario(r,new Date('2026-11-23T16:00:00Z'),'America/Monterrey'),true);
  assert.equal(reglas.enHorario(r,new Date('2026-11-24T03:00:00Z'),'America/Monterrey'),false); // 21:00
  assert.equal(reglas.enHorario(r,new Date('2026-11-22T16:00:00Z'),'America/Monterrey'),false); // domingo
});

test('lee las Observaciones Portal y el expediente del detalle de GNP',()=>{
  const texto=`Orden de Trabajo\t26O12G2880\n Datos generales\nGastos Médicos Mayores\t\nRamo *\nMovimiento\t\nTipo de solicitud\nMigración a GNP Personaliza\t\nTipo de Movimiento\nAgregar Observaciones\nAgregar\nObservaciones Portal\n(INTRODUCIDO POR Empleado GNP - 2026-10-19 16:56 hrs)\n\nAdministrativa\nBuen día, se aprobó la Migración. Falta solicitud completa.\n\nSin solicitud, solicitud incompleta o ilegible\n\n(INTRODUCIDO POR Miguel Angel Rodriguez De Leon - 2026-10-12 12:43 hrs)\n\nFAVOR DE HACER MIGRACION\n\n Expediente Digital\nDocumentos Adjuntos\n Identificación oficial\t2026-10-12 12:43\t\t\n Movimientos H - 107\t2026-10-13 10:26\t\t\nTurnar\nSalir`;
  const d=leerDetalle(texto);
  assert.equal(d.tipoMovimiento,'Migración a GNP Personaliza');
  assert.equal(d.observaciones.length,2);
  assert.equal(d.observaciones[0].autor,'Empleado GNP');
  assert.equal(d.observaciones[0].fecha,'2026-10-19 16:56');
  assert.match(d.observaciones[0].texto,/Falta solicitud completa/);
  assert.match(d.observaciones[0].texto,/solicitud incompleta o ilegible/);
  assert.deepEqual(d.documentos.map(x=>x.nombre),['Identificación oficial','Movimientos H - 107']);
  assert.equal(reglas.ultimaObservacionGnp(d).fecha,'2026-10-19 16:56');
});

test('mapea las columnas de GMM y Vida',()=>{
  const gmm=mapearFila('gmm',['OT','Usuario Creador','Estatus','Fecha Compromiso','Póliza','Agente','Contratante','Tipo de Solicitud','Producto','No. de Guía','Fecha de registro','Primer Ingreso a GNP','Último Ingreso a GNP','Medio de Apertura','Rol'],
    ['26O27G5338','M','Activada','-','00000756812152','0073178001','Tellez Salas Rosa Maria','Movimiento','-','-','27/10/2026 15:53:25 hrs.','27/10/2026 15:53:25 hrs.','27/10/2026 15:53:25 hrs.','WF DA´s','Coordinador']);
  assert.equal(gmm.ot,'26O27G5338');
  assert.equal(gmm.fechaRegistro,'2026-10-27');
  assert.equal(gmm.fechaCompromiso,'');
  assert.equal(gmm.agente,'0073178001');
  const vida=mapearFila('vida',['RAMO','OT','ESTATUS','TIPO DE SOLICITUD','CAPITALIZA PPR','FECHA COMPROMISO','PÓLIZA','NOMBRE AGENTE','NOMBRE DEL CONTRATANTE','ÁREA','PRODUCTO','ORIGEN','GUÍA','FECHA Y HORA DE PRIMER INGRESO','FECHA Y HORA DEL ÚLTIMO INGRESO'],
    ['Vida','26N13V4332','TERMINADA','MOVIMIENTOS','NO','2026/11/24','00000586879157','R','Vanessa','Línea','TRASCIENDE','WF','','2026/11/13','2026/11/13']);
  assert.equal(vida.estatus,'TERMINADA');
  assert.equal(vida.fechaRegistro,'2026-11-13');
  assert.equal(fechaIso('2026-01-05'),'2026-01-05');
});

test('compara corridas: nuevos, estatus, observación de GNP y salidas',()=>{
  const r=reglas.validarRegla(base);
  const t=(ot,estatus,extra={})=>reglas.instantanea({ot,estatus,contratante:'Cliente '+ot,tipo:'Movimiento',fechaRegistro:'2026-11-24',observaciones:[],...extra});
  const antes={A:t('A','En Registro'),B:t('B','Activada'),C:t('C','Activada')};
  const ahora={A:t('A','Activada'),B:t('B','Activada',{observaciones:[{autor:'Empleado GNP',fecha:'2026-11-25 09:00',texto:'Adjuntar H107 firmado'}]}),D:t('D','En Registro')};
  const cambios=reglas.comparar(r,antes,ahora);
  assert.deepEqual(cambios.map(c=>c.tipo+':'+c.tramite.ot).sort(),['estatus:A','nuevo:D','observacion:B','salida:C']);
  const aviso=reglas.armarAviso(r,{cambios,vista:ahora,inicial:false,fecha:new Date('2026-11-25T16:00:00Z'),zona:'America/Monterrey'});
  assert.match(aviso.asunto,/4 cambios/);
  assert.match(aviso.texto,/En Registro → Activada/);
  assert.match(aviso.texto,/Adjuntar H107 firmado/);
  assert.doesNotMatch(aviso.whatsapp,/\n/);
  assert.ok(aviso.whatsapp.length<=1000);
  assert.doesNotMatch(aviso.html,/<script/);
});

test('filtra por estatus, fecha y clave de agente',()=>{
  const r=reglas.validarRegla({...base,claveAgente:'0073178001'});
  const lista=[
    {ot:'1',estatus:'Activada',fechaRegistro:'2026-11-24',agente:'0073178001'},
    {ot:'2',estatus:'Activada',fechaRegistro:'2026-11-20',agente:'0073178001'},
    {ot:'3',estatus:'Terminada',fechaRegistro:'2026-11-24',agente:'0073178001'},
    {ot:'4',estatus:'En Registro',fechaRegistro:'2026-11-24',agente:'0049326001'}
  ];
  assert.deepEqual(reglas.filtrar(r,lista).map(t=>t.ot),['1']);
});

async function escuchar(app,t) {
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port;
}

test('API de reglas: crear, revisar, avisar solo cuando hay cambios y eliminar',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-vig-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const app=express();
  app.use(express.json());
  let lectura=[{ot:'26N24G0001',estatus:'En Registro',contratante:'Cliente Uno',tipo:'Movimiento',fechaRegistro:'2026-11-24',agente:'0073178001'}];
  const enviados=[];
  registrar(app,{base:dir,env:{GNP_USERNAME:'u',GNP_PASSWORD:'p'},programar:false,
    leerPortal:async(env,pedidos)=>{
      assert.deepEqual(Object.keys(pedidos),['gmm']);
      assert.equal(pedidos.gmm.fechaDesde,'2026-11-23');
      return {gmm:{ok:true,tramites:lectura.map(x=>({...x}))}};
    },
    enviarAviso:async(env,regla,aviso)=>{enviados.push(aviso);return {correo:{ok:true},whatsapp:[]};}});
  const url=await escuchar(app,t);
  const json={'Content-Type':'application/json'};
  const malo=await fetch(url+'/api/tramites/vigilancias',{method:'POST',headers:json,body:JSON.stringify({...base,cadaMinutos:1})});
  assert.equal(malo.status,400);
  const creada=await (await fetch(url+'/api/tramites/vigilancias',{method:'POST',headers:json,body:JSON.stringify(base)})).json();
  assert.ok(creada.id);
  const esperarFin=async()=>{for(let i=0;i<100;i++){const d=await (await fetch(url+'/api/tramites/vigilancias')).json();if(!d.ocupado)return d;await new Promise(r=>setTimeout(r,10));}};
  assert.equal((await fetch(url+'/api/tramites/vigilancias/'+creada.id+'/ejecutar',{method:'POST'})).status,202);
  let estado=await esperarFin();
  assert.equal(estado.reglas[0].ultimoResultado.inicial,true);
  assert.equal(enviados.length,1);
  assert.match(enviados[0].asunto,/vigilancia iniciada \(1 trámites\)/);
  // Sin cambios: no se avisa.
  await fetch(url+'/api/tramites/vigilancias/'+creada.id+'/ejecutar',{method:'POST'});
  estado=await esperarFin();
  assert.equal(enviados.length,1);
  assert.equal(estado.reglas[0].ultimoResultado.cambios,0);
  // Cambio de estatus: se avisa.
  lectura[0].estatus='Activada';
  await fetch(url+'/api/tramites/vigilancias/'+creada.id+'/ejecutar',{method:'POST'});
  estado=await esperarFin();
  assert.equal(enviados.length,2);
  assert.match(enviados[1].texto,/En Registro → Activada/);
  assert.equal(estado.avisos.length,2);
  const vista=await (await fetch(url+'/api/tramites/vigilancias/'+creada.id+'/tramites')).json();
  assert.equal(vista.tramites[0].estatus,'Activada');
  assert.equal((await fetch(url+'/api/tramites/vigilancias/'+creada.id,{method:'DELETE'})).status,204);
  assert.equal((await (await fetch(url+'/api/tramites/vigilancias')).json()).reglas.length,0);
});

test('el programador solo corre reglas activas, vencidas y dentro de horario',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-vig-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  let ahora=new Date('2026-11-23T16:00:00Z'); // lunes 10:00 Monterrey
  let lecturas=0;
  const v=crearVigilancias({env:{GNP_USERNAME:'u',GNP_PASSWORD:'p'},base:dir,reloj:()=>ahora,
    leer:async()=>{lecturas++;return {gmm:{ok:true,tramites:[]}};},enviar:async()=>({correo:null,whatsapp:[]})});
  await v.crear(base);
  await v.crear({...base,nombre:'Pausada',activa:false});
  await v.revisar();
  assert.equal(lecturas,1);
  ahora=new Date(ahora.getTime()+60*60000); // 1 h después: aún no le toca
  await v.revisar();
  assert.equal(lecturas,1);
  ahora=new Date('2026-11-24T03:30:00Z'); // 21:30: fuera de horario
  await v.revisar();
  assert.equal(lecturas,1);
  ahora=new Date('2026-11-24T14:05:00Z'); // martes 08:05
  await v.revisar();
  assert.equal(lecturas,2);
  // Un error de GNP queda registrado en la regla sin romper el programador.
  const v2=crearVigilancias({env:{GNP_USERNAME:'u',GNP_PASSWORD:'p'},base:dir,reloj:()=>ahora,
    leer:async()=>{throw new Error('reCAPTCHA');}});
  ahora=new Date('2026-11-25T14:05:00Z');
  await v2.revisar();
  const lista=await v2.listar();
  assert.equal(lista.reglas[0].ultimoResultado.ok,false);
  assert.match(lista.reglas[0].ultimoResultado.error,/reCAPTCHA/);
});

test('avisos: correo y WhatsApp usan sus APIs y reportan canales sin configurar',async()=>{
  const regla=reglas.validarRegla(base);
  const aviso={asunto:'A',texto:'T',html:'<p>T</p>',whatsapp:'W'};
  const sin=await enviarAviso({},regla,aviso,async()=>{throw new Error('no debe llamarse');});
  assert.equal(sin.correo.ok,false);
  assert.equal(sin.whatsapp[0].ok,false);
  const llamadas=[];
  const env={RESEND_API_KEY:'k',AVISOS_CORREO_REMITENTE:'Avisos <avisos@quillum.com.mx>',WHATSAPP_TOKEN:'t',WHATSAPP_PHONE_ID:'123',WHATSAPP_PLANTILLA:'aviso_tramites'};
  const r=await enviarAviso(env,regla,aviso,async(url,op)=>{llamadas.push({url,body:JSON.parse(op.body)});return {ok:true,status:200,json:async()=>({})};});
  assert.equal(r.correo.ok,true);
  assert.equal(r.whatsapp[0].ok,true);
  assert.equal(llamadas[0].url,'https://api.resend.com/emails');
  assert.deepEqual(llamadas[0].body.to,['equipo@quillum.com.mx']);
  assert.match(llamadas[1].url,/graph\.facebook\.com\/v21\.0\/123\/messages$/);
  assert.equal(llamadas[1].body.template.name,'aviso_tramites');
  assert.equal(llamadas[1].body.to,'5218180202414');
});
