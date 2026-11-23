// Vigilancias de trámites: guarda las reglas, las ejecuta según su frecuencia y horario,
// compara contra la corrida anterior y envía avisos por correo y WhatsApp.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const reglas=require('./reglas.cjs');
const avisos=require('./avisos.cjs');

const MAX_AVISOS=200;

function crearVigilancias({env,base,leer,enviar=avisos.enviarAviso,reloj=()=>new Date()}) {
  const archivo=path.join(base,'tramites-vigilancias.json');
  const zona=env.AVISOS_ZONA_HORARIA || 'America/Monterrey';
  let datos=null;
  let escritura=Promise.resolve();
  let ocupado=false;
  let progreso=[];
  let temporizador=null;

  async function cargar() {
    if(datos)return datos;
    try {datos=JSON.parse(await fs.readFile(archivo,'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;datos={version:1,reglas:[],estados:{},avisos:[]};}
    return datos;
  }
  function guardar() {
    escritura=escritura.then(async()=>{
      const temporal=archivo+'.'+randomUUID()+'.tmp';
      try {
        await fs.writeFile(temporal,JSON.stringify(datos),{mode:0o600});
        await fs.rename(temporal,archivo);
      } finally {await fs.rm(temporal,{force:true});}
    });
    return escritura;
  }

  function resumen(r) {
    const estado=datos.estados[r.id];
    return {...r,tramitesEnVista:estado?Object.keys(estado.tramites).length:0};
  }
  async function listar() {
    await cargar();
    return {
      reglas:datos.reglas.map(resumen),
      avisos:datos.avisos.slice(0,50),
      canales:avisos.canales(env),
      configurado:Boolean(env.GNP_USERNAME && env.GNP_PASSWORD),
      ocupado,progreso,
      secciones:Object.fromEntries(Object.entries(reglas.SECCIONES).map(([k,v])=>[k,{nombre:v.nombre,estatus:v.estatus,abiertos:reglas.ABIERTOS[k]}])),
      zona
    };
  }
  async function crear(entrada) {
    await cargar();
    if(datos.reglas.length>=30)throw new reglas.ReglaInvalida('Máximo 30 reglas.');
    const regla={id:randomUUID(),...reglas.validarRegla(entrada),creada:reloj().toISOString(),
      ultimaEjecucion:null,proximaEjecucion:reloj().toISOString(),ultimoResultado:null};
    datos.reglas.push(regla);
    await guardar();
    return resumen(regla);
  }
  async function actualizar(id,entrada) {
    await cargar();
    const regla=datos.reglas.find(r=>r.id===id);
    if(!regla)return null;
    const nueva=reglas.validarRegla(entrada);
    // Si cambian los filtros, la siguiente corrida se toma como nueva línea base.
    const filtros=['seccion','estatus','fechaDesde','claveAgente'];
    if(filtros.some(k=>JSON.stringify(regla[k])!==JSON.stringify(nueva[k])))delete datos.estados[id];
    Object.assign(regla,nueva,{proximaEjecucion:reloj().toISOString()});
    await guardar();
    return resumen(regla);
  }
  async function eliminar(id) {
    await cargar();
    const antes=datos.reglas.length;
    datos.reglas=datos.reglas.filter(r=>r.id!==id);
    delete datos.estados[id];
    if(datos.reglas.length===antes)return false;
    await guardar();
    return true;
  }
  async function tramites(id) {
    await cargar();
    const estado=datos.estados[id];
    return estado?{actualizado:estado.actualizado,tramites:Object.values(estado.tramites)}:{actualizado:null,tramites:[]};
  }

  // Ejecuta las reglas indicadas en una sola sesión de GNP.
  async function ejecutar(lista,{forzar=false}={}) {
    if(ocupado || !lista.length)return false;
    if(!env.GNP_USERNAME || !env.GNP_PASSWORD)return false;
    ocupado=true;
    progreso=[];
    try {
      const pedidos={};
      for(const r of lista){
        const p=pedidos[r.seccion] ||= {fechas:[],observaciones:false};
        p.fechas.push(r.fechaDesde || '');
        p.observaciones ||= r.leerObservaciones;
      }
      // Se consulta desde la fecha más antigua que pida alguna regla ('' = sin límite).
      for(const p of Object.values(pedidos)){
        p.fechaDesde=p.fechas.includes('')?'':p.fechas.sort()[0];
        delete p.fechas;
      }
      let leido;
      try {leido=await leer(env,pedidos,paso=>progreso.push(paso));}
      catch(error){leido=Object.fromEntries(Object.keys(pedidos).map(s=>[s,{ok:false,error:error.message || 'No se pudo consultar GNP.'}]));}
      const ahora=reloj();
      for(const r of lista){
        const regla=datos.reglas.find(x=>x.id===r.id);
        if(!regla)continue;
        regla.ultimaEjecucion=ahora.toISOString();
        regla.proximaEjecucion=new Date(ahora.getTime()+regla.cadaMinutos*60000).toISOString();
        const seccion=leido[regla.seccion];
        if(!seccion?.ok){
          regla.ultimoResultado={ok:false,error:seccion?.error || 'Sin respuesta de GNP.'};
          continue;
        }
        const vista=Object.fromEntries(reglas.filtrar(regla,seccion.tramites).map(t=>[t.ot,reglas.instantanea(t)]));
        const anterior=datos.estados[regla.id];
        const inicial=!anterior;
        const cambios=inicial?[]:reglas.comparar(regla,anterior.tramites,vista);
        datos.estados[regla.id]={actualizado:ahora.toISOString(),tramites:vista};
        regla.ultimoResultado={ok:true,cambios:cambios.length,enVista:Object.keys(vista).length,inicial};
        if(inicial || cambios.length){
          const aviso=reglas.armarAviso(regla,{cambios,vista,inicial,fecha:ahora,zona});
          const envio=(regla.correos.length || regla.whatsapp.length)?await enviar(env,regla,aviso):{correo:null,whatsapp:[]};
          datos.avisos.unshift({id:randomUUID(),regla:regla.id,nombre:regla.nombre,fecha:ahora.toISOString(),
            asunto:aviso.asunto,lineas:inicial?[]:cambios.map(reglas.describirCambio),envio,forzado:forzar});
          datos.avisos.length=Math.min(datos.avisos.length,MAX_AVISOS);
        }
      }
      await guardar();
      return true;
    } finally {ocupado=false;}
  }

  async function revisar() {
    await cargar();
    const ahora=reloj();
    const pendientes=datos.reglas.filter(r=>r.activa && (!r.proximaEjecucion || new Date(r.proximaEjecucion)<=ahora) && reglas.enHorario(r,ahora,zona));
    await ejecutar(pendientes);
  }
  async function ejecutarAhora(id) {
    await cargar();
    const regla=datos.reglas.find(r=>r.id===id);
    if(!regla)return null;
    if(ocupado)return false;
    void ejecutar([regla],{forzar:true}).catch(()=>{});
    return true;
  }
  function iniciar(intervaloMs=60000) {
    if(temporizador)return;
    temporizador=setInterval(()=>{void revisar().catch(()=>{});},intervaloMs);
    temporizador.unref?.();
  }
  function detener(){clearInterval(temporizador);temporizador=null;}

  return {listar,crear,actualizar,eliminar,tramites,ejecutar,revisar,ejecutarAhora,iniciar,detener,estaOcupado:()=>ocupado};
}

module.exports={crearVigilancias};
