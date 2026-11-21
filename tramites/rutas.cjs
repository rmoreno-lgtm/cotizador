const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {consultar,ConsultaIncompleta}=require('./portal.cjs');

function registrar(app,{env,base,consultarPortal=consultar}) {
  const archivo=path.join(base,'tramites-gnp.json');
  const configurado=Boolean(env.GNP_USERNAME && env.GNP_PASSWORD);
  let enCurso=false;
  let error=null;
  let exploracion=[];

  async function actualizar() {
    try {
      const resultado=await consultarPortal(env,paso=>exploracion.push(paso));
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
    res.json({configurado,enCurso,error,exploracion:enCurso || error ? exploracion : ultimaConsulta?.exploracion || [],ultimaConsulta});
  });
  app.post('/api/tramites/actualizar',(req,res)=>{
    if(!configurado)return res.status(503).json({error:'La consulta requiere las credenciales de GNP en Railway.'});
    if(!enCurso) {
      enCurso=true;
      error=null;
      exploracion=[];
      void actualizar();
    }
    res.sendStatus(202);
  });
}
module.exports={registrar};
