const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {consultar,ConsultaIncompleta}=require('./portal.cjs');
const {crearVigilancias}=require('./vigilancias.cjs');
const {ReglaInvalida}=require('./reglas.cjs');

function registrarVigilancias(app,{env,base,leer,enviar,programar}) {
  const vigilancias=crearVigilancias({env,base,leer:leer || require('./lector.cjs').leerSecciones,...(enviar?{enviar}:{})});
  if(programar)vigilancias.iniciar();
  const manejar=fn=>async(req,res,next)=>{
    try {await fn(req,res);}
    catch(error){
      if(error instanceof ReglaInvalida)return res.status(400).json({error:error.message});
      next(error);
    }
  };
  app.get('/tramites.css',(req,res)=>res.sendFile(path.join(__dirname,'../web/tramites.css')));
  app.get('/api/tramites/vigilancias',manejar(async(req,res)=>res.json(await vigilancias.listar())));
  app.post('/api/tramites/vigilancias',manejar(async(req,res)=>res.status(201).json(await vigilancias.crear(req.body))));
  app.put('/api/tramites/vigilancias/:id',manejar(async(req,res)=>{
    const regla=await vigilancias.actualizar(req.params.id,req.body);
    regla?res.json(regla):res.status(404).json({error:'La regla no existe.'});
  }));
  app.delete('/api/tramites/vigilancias/:id',manejar(async(req,res)=>{
    (await vigilancias.eliminar(req.params.id))?res.sendStatus(204):res.status(404).json({error:'La regla no existe.'});
  }));
  app.get('/api/tramites/vigilancias/captura-error',(req,res)=>{
    res.set('Cache-Control','no-store');
    res.sendFile(vigilancias.captura,error=>{if(error && !res.headersSent)res.status(404).json({error:'No hay captura de error.'});});
  });
  app.get('/api/tramites/vigilancias/:id/tramites',manejar(async(req,res)=>res.json(await vigilancias.tramites(req.params.id))));
  app.post('/api/tramites/vigilancias/:id/ejecutar',manejar(async(req,res)=>{
    if(!env.GNP_USERNAME || !env.GNP_PASSWORD)return res.status(503).json({error:'La consulta requiere las credenciales de GNP en Railway.'});
    const r=await vigilancias.ejecutarAhora(req.params.id);
    if(r===null)return res.status(404).json({error:'La regla no existe.'});
    if(r===false)return res.status(409).json({error:'Ya hay una revisión en curso. Intenta en unos minutos.'});
    res.sendStatus(202);
  }));
  return vigilancias;
}

function registrar(app,{env,base,consultarPortal=consultar,leerPortal,enviarAviso,programar=env.NODE_ENV==='production'}) {
  registrarVigilancias(app,{env,base,leer:leerPortal,enviar:enviarAviso,programar});
  const archivo=path.join(base,'tramites-gnp.json');
  const configurado=Boolean(env.GNP_USERNAME && env.GNP_PASSWORD);
  let enCurso=false;
  let error=null;
  let exploracion=[];
  let vistaPrevia=null;
  let caducidadVista;

  async function actualizar(modo) {
    try {
      const resultado=await consultarPortal(env,paso=>exploracion.push(paso),modo);
      if(modo==='vista'){
        const vista={...resultado,exploracion,consultadoEn:new Date().toISOString()};
        vistaPrevia=vista;
        caducidadVista=setTimeout(()=>{vistaPrevia=null;},10*60*1000).unref();
        return;
      }
      const instantanea={...resultado,exploracion,consultadoEn:new Date().toISOString()};
      const temporal=archivo+'.'+randomUUID()+'.tmp';
      try {
        await fs.writeFile(temporal,JSON.stringify(instantanea),{mode:0o600});
        await fs.rename(temporal,archivo);
      } finally {
        await fs.rm(temporal,{force:true});
      }
    } catch(causa) {
      error=causa instanceof ConsultaIncompleta?causa.message:'No se pudo consultar GNP o guardar el resultado.';
    } finally {enCurso=false;}
  }

  app.get('/api/tramites',async(req,res)=>{
    let ultimaConsulta=null;
    try {ultimaConsulta=JSON.parse(await fs.readFile(archivo,'utf8'));}
    catch(causa) {if(causa.code!=='ENOENT')throw causa;}
    res.json({configurado,enCurso,error,exploracion:enCurso || error ? exploracion : vistaPrevia?.exploracion || ultimaConsulta?.exploracion || [],ultimaConsulta,vistaPrevia});
  });
  function iniciar(modo,res) {
    if(!configurado)return res.status(503).json({error:'La consulta requiere las credenciales de GNP en Railway.'});
    if(modo==='reporte' && !vistaPrevia)return res.status(409).json({error:'Abre primero la vista previa de la tabla en GNP.'});
    if(!enCurso) {
      enCurso=true;
      error=null;
      exploracion=[];
      if(modo==='vista'){
        clearTimeout(caducidadVista);
        vistaPrevia=null;
      }
      void actualizar(modo);
    }
    res.sendStatus(202);
  }
  app.post('/api/tramites/vista',(req,res)=>iniciar('vista',res));
  app.post('/api/tramites/actualizar',(req,res)=>iniciar('reporte',res));
}
module.exports={registrar};
