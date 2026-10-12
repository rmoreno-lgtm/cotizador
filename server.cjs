const express=require('express');
const multer=require('multer');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Cola,idValido}=require('./cola.cjs');
const {solicitud}=require('./solicitud.cjs');

const png=b=>b && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
const iguales=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length && crypto.timingSafeEqual(x,y);};
function limpiarError(error,env) {
  let mensaje=String(error?.message || 'No se pudo completar la solicitud.');
  for(const valor of [env.GNP_USERNAME,env.GNP_PASSWORD,env.APP_SECRET,env.APP_PASSWORD]) if(valor) mensaje=mensaje.split(valor).join('[oculto]');
  return mensaje.slice(0,1800);
}
async function crearApp({env=process.env,ejecutor}={}) {
  const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
  const base=path.resolve(env.DATA_DIR || path.join(__dirname,'data'));
  await fs.mkdir(base,{recursive:true});
  const secreto=String(env.APP_SECRET||'');
  const secretValido=secreto.length>=32;
  const usuario=String(env.APP_USERNAME||'quillum').trim();
  const password=env.APP_PASSWORD===undefined || env.APP_PASSWORD===''?secreto:String(env.APP_PASSWORD);
  const loginValido=secretValido && /^[\p{L}\p{N}._@-]{1,80}$/u.test(usuario) && password.length>=12;
  const sesionVersion=crypto.createHmac('sha256',secreto).update(usuario+'\0'+password).digest('base64url');
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:40*1024*1024,files:1,fields:2,fieldSize:20000}});
  const uploadLogo=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:0}});
  const logoPath=path.join(base,'logo-quillum.png');
  let version=env.RAILWAY_GIT_COMMIT_SHA || '';
  try{const release=JSON.parse(await fs.readFile(path.join(__dirname,'release.json'),'utf8'));if(/^[a-f0-9]{40}$/.test(release.commit||''))version=release.commit;}catch{}
  const puedeLogo=async()=>{try{return png(await fs.readFile(logoPath));}catch{return false;}};
  const ejecutar=ejecutor || (async(job,dir)=>{
    if(job.solicitud.modalidad==='comparativo') return require('./comparativo.cjs').ejecutarComparativo(job,dir,{env,logoPath});
    let s=job.solicitud;
    const pdf=path.join(dir,'gnp.pdf');
    if(job.tipo==='gnp') s=await require('./cotizador-gnp.cjs').cotizar(s,pdf,env);
    await fs.writeFile(path.join(dir,'solicitud.json'),JSON.stringify({schemaVersion:1,solicitud:s},null,2));
    const resultado=await require('./integracion.cjs').generarDesdePdf(pdf,s,{
      baseDir:dir,logoPath,abrir:false,executablePath:env.CHROMIUM_EXECUTABLE_PATH
    });
    return {propuesta:path.relative(dir,resultado.archivo),folio:resultado.datos.folio,advertencias:resultado.datos.advertencias,totalAnual:resultado.datos.monto.total,descuentoFamiliar:resultado.datos.monto.descuento,descuentoIncluidoEnNeta:resultado.datos.descuentoIncluidoEnNeta,niveles:resultado.datos.niveles};
  });
  const cola=new Cola(base,async(j,d)=>{
    try{return await ejecutar(j,d);}catch(e){throw new Error(limpiarError(e,env));}
  });
  const firma=p=>crypto.createHmac('sha256',secreto).update(p).digest('base64url');
  const cookieValida=req=>{
    if(!secretValido)return false;
    const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('quillum='));
    if(!cookie)return false;
    const [p,sign,...extra]=cookie.slice(8).split('.');
    if(!p || !sign || extra.length || !iguales(sign,firma(p)))return false;
    try{const data=JSON.parse(Buffer.from(p,'base64url').toString());return loginValido && data.v===sesionVersion && typeof data.exp==='number' && Date.now()<data.exp;}catch{return false;}
  };
  const auth=req=>cookieValida(req) || (secretValido && iguales(req.get('Authorization')||'','Bearer '+secreto));
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'"});
    if(['POST','PUT','PATCH','DELETE'].includes(req.method) && req.get('Origin')) {
      let host;try{host=new URL(req.get('Origin')).host;}catch{return res.status(403).json({error:'Origen no permitido.'});}
      if(host!==req.get('Host'))return res.status(403).json({error:'Origen no permitido.'});
    }
    next();
  });
  app.use(express.json({limit:'20kb'}));
  app.use(express.urlencoded({extended:false,limit:'20kb'}));
  app.get('/healthz',(req,res)=>res.json({ok:true,configurada:loginValido,version}));
  app.get('/style.css',(req,res)=>res.sendFile(path.join(__dirname,'web/style.css')));
  app.get('/login',(req,res)=>auth(req)?res.redirect('/'):res.sendFile(path.join(__dirname,'web/login.html')));
  const intentos=new Map();
  app.post('/login',(req,res)=>{
    if(!secretValido)return res.status(503).send('Configura APP_SECRET con al menos 32 caracteres en Variables de Railway.');
    if(!loginValido)return res.status(503).send('Configura APP_PASSWORD con al menos 12 caracteres y un APP_USERNAME válido en Railway.');
    const ip=req.ip || 'sin-ip';const ahora=Date.now();const t=intentos.get(ip);
    if(t && t.hasta>ahora && t.cantidad>=10)return res.status(429).send('Demasiados intentos. Espera 15 minutos.');
    const recibido=String(req.body?.usuario||(env.APP_PASSWORD?'':usuario));
    if(!iguales(recibido,usuario) || !iguales(req.body?.clave||'',password)){
      if(!t || t.hasta<=ahora)intentos.set(ip,{cantidad:1,hasta:ahora+900000});else t.cantidad++;
      return res.status(401).send('Usuario o contraseña incorrectos. Vuelve a /login e intenta nuevamente.');
    }
    intentos.delete(ip);
    for(const [key,v] of intentos)if(v.hasta<ahora)intentos.delete(key);
    const duracion=req.body?.recordar==='si'?30*86400000:86400000;
    const token=Buffer.from(JSON.stringify({exp:Date.now()+duracion,v:sesionVersion,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');
    res.cookie('quillum',token+'.'+firma(token),{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',maxAge:duracion,path:'/'});
    res.redirect('/');
  });
  app.use((req,res,next)=>auth(req)?next():req.path.startsWith('/api/')?res.status(401).json({error:'Inicia sesión.'}):res.redirect('/login'));
  app.post('/logout',(req,res)=>{res.clearCookie('quillum',{path:'/'});res.redirect('/login');});
  app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'web/index.html')));
  app.get('/app.js',(req,res)=>res.sendFile(path.join(__dirname,'web/app.js')));
  app.get('/api/config',async(req,res)=>res.json({
    logo:await puedeLogo(),gnpConfigurado:Boolean(env.GNP_USERNAME && env.GNP_PASSWORD),
    deducibles:['21000','32000','45000','56000','68000','87000','111000','128000','175000','233000'],tabuladores:['A','B','C','D'],accesos:['Esencial','Amplio'],
    nota:'Las opciones disponibles se validan en GNP al cotizar. WhatsApp todavía no está conectado.'
  }));
  app.post('/api/logo',uploadLogo.single('logo'),async(req,res)=>{
    if(!png(req.file?.buffer))return res.status(400).json({error:'Adjunta tu logo como PNG real, de hasta 2 MB.'});
    const temp=logoPath+'.'+crypto.randomUUID();await fs.writeFile(temp,req.file.buffer);await fs.rename(temp,logoPath);res.json({ok:true});
  });
  const historial=new Map();
  async function resumen(j) {
    let resultado=j.resultado?{...j.resultado}:undefined;
    // Leer los datos verificados de propuestas anteriores, sin regenerarlas ni modificarlas.
    if(j.estado==='completada' && resultado?.propuesta && resultado.totalAnual===undefined) {
      const clave=j.id+':'+resultado.propuesta;
      let datos=historial.get(clave);
      if(!datos) {
        const dir=cola.carpeta(j.id);
        const archivo=path.resolve(dir,resultado.propuesta.replace(/\.pdf$/i,'.verificado.json'));
        if(archivo.startsWith(dir+path.sep)) {
          try{const d=JSON.parse(await fs.readFile(archivo,'utf8'));if(d.folio===resultado.folio && Number.isSafeInteger(d.monto?.total) && d.monto.total>=0){datos=d;historial.set(clave,d);}}catch{}
        }
      }
      if(datos) resultado={...resultado,totalAnual:datos.monto.total,descuentoFamiliar:datos.monto.descuento,descuentoIncluidoEnNeta:datos.descuentoIncluidoEnNeta,niveles:datos.niveles};
    }
    return {id:j.id,estado:j.estado,nombre:j.solicitud.nombre,tipo:j.tipo,creadaEn:j.creadaEn,iniciadaEn:j.iniciadaEn,terminadaEn:j.terminadaEn,error:j.error,solicitud:j.solicitud,resultado};
  }
  app.get('/api/jobs',async(req,res)=>{
    const q=String(req.query.q||'').trim().toLocaleLowerCase('es-MX').slice(0,120);
    const estado=String(req.query.estado||'');
    if(estado && !['pendiente','procesando','completada','error'].includes(estado))return res.status(400).json({error:'Estado inválido.'});
    const completo=[...cola.jobs.values()].sort((a,b)=>b.creadaEn.localeCompare(a.creadaEn)||b.id.localeCompare(a.id));
    const filtrado=completo.filter(j=>(!estado || j.estado===estado) && (!q || [j.solicitud.nombre,j.resultado?.folio,j.solicitud.cp].some(v=>String(v||'').toLocaleLowerCase('es-MX').includes(q))));
    // Mantener el formato anterior para clientes que no soliciten paginación.
    if(req.query.page===undefined)return res.json(await Promise.all(filtrado.slice(0,30).map(resumen)));
    const page=Number(req.query.page), limite=10;
    if(!Number.isSafeInteger(page) || page<1 || page>1000000)return res.status(400).json({error:'Página inválida.'});
    res.json({items:await Promise.all(filtrado.slice((page-1)*limite,page*limite).map(resumen)),total:filtrado.length,page,pages:Math.max(1,Math.ceil(filtrado.length/limite))});
  });
  app.get('/api/jobs/:id',async(req,res)=>{
    const j=cola.jobs.get(req.params.id);if(!j)return res.status(404).json({error:'Solicitud no encontrada.'});res.json(await resumen(j));
  });
  async function crear(req,res,tipo,pdf) {
    if(!await puedeLogo())return res.status(409).json({error:'Carga primero el logo de QUILLUM.'});
    if(tipo==='gnp' && (!env.GNP_USERNAME || !env.GNP_PASSWORD))return res.status(409).json({error:'Faltan las credenciales de GNP en Variables de Railway.'});
    let s;
    try{s=solicitud(tipo==='pdf'?JSON.parse(req.body.solicitud):req.body);}catch(e){return res.status(400).json({error:limpiarError(e,env)});}
    if(tipo==='pdf' && s.modalidad==='comparativo')return res.status(400).json({error:'El comparativo requiere cotizar en GNP; un solo PDF no contiene las otras opciones.'});
    const key=req.get('Idempotency-Key');
    if(key && !/^[A-Za-z0-9_-]{1,100}$/.test(key))return res.status(400).json({error:'Identificador de solicitud inválido.'});
    try{const j=await cola.crear(s,tipo,pdf,key);res.status(202).json(await resumen(j));}catch(e){res.status(409).json({error:limpiarError(e,env)});}
  }
  app.post('/api/jobs',(req,res)=>crear(req,res,'gnp'));
  app.post('/api/pdf',upload.single('pdf'),(req,res)=>{
    if(!req.file?.buffer.subarray(0,5).equals(Buffer.from('%PDF-')))return res.status(400).json({error:'Adjunta un PDF de GNP válido.'});
    return crear(req,res,'pdf',req.file.buffer);
  });
  app.post('/api/jobs/:id/retry',async(req,res)=>{
    try{res.status(202).json(await resumen(await cola.reintentar(req.params.id)));}catch(e){res.status(409).json({error:limpiarError(e,env)});}
  });
  app.delete('/api/jobs/:id',async(req,res)=>{
    if(req.body?.confirmar!==true)return res.status(400).json({error:'Confirma la eliminación de la solicitud y de sus archivos.'});
    if(!cola.jobs.has(req.params.id))return res.status(404).json({error:'Solicitud no encontrada.'});
    try{
      const resultado=await cola.eliminar(req.params.id);
      for(const key of historial.keys())if(key.startsWith(req.params.id+':'))historial.delete(key);
      res.json(resultado);
    }catch(e){res.status(409).json({error:limpiarError(e,env)});}
  });
  app.get('/api/jobs/:id/files/:tipo',async(req,res)=>{
    const {id,tipo}=req.params;const j=cola.jobs.get(id);
    if(!idValido(id) || !j || !['gnp','gnp-1','gnp-2','gnp-3','propuesta'].includes(tipo))return res.status(404).json({error:'Archivo no encontrado.'});
    const dir=cola.carpeta(id);
    const numero=/^gnp-([123])$/.exec(tipo);
    const relativo=numero && j.solicitud.modalidad==='comparativo' && Number(numero[1])<=j.solicitud.opciones.length?'opcion-'+numero[1]+'/gnp.pdf':tipo==='gnp' && j.solicitud.modalidad!=='comparativo'?'gnp.pdf':tipo==='propuesta' && j.estado==='completada'?j.resultado?.propuesta:null;
    if(!relativo)return res.status(404).json({error:'El documento aún no está disponible.'});
    const archivo=path.resolve(dir,relativo);
    if(!archivo.startsWith(dir+path.sep))return res.status(404).json({error:'Archivo no encontrado.'});
    try{await fs.access(archivo);}catch{return res.status(404).json({error:'Archivo no encontrado.'});}
    res.download(archivo,tipo.startsWith('gnp')?'Cotizacion-GNP-'+(numero?.[1]||'individual')+'.pdf':j.solicitud.modalidad==='comparativo'?'Comparativo-QUILLUM.pdf':`Propuesta-QUILLUM-${j.resultado.folio}.pdf`);
  });
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error instanceof multer.MulterError?400:error.status===400?400:500;
    res.status(status).json({error:status===400?'Revisa el archivo (PDF hasta 40 MB; logo hasta 2 MB) y los datos enviados.':'No se pudo completar la solicitud.'});
  });
  await cola.iniciar();
  return {app,cola};
}
if(require.main===module) {
  crearApp().then(({app,cola})=>{
    const port=Number(process.env.PORT || 3000);
    const servidor=app.listen(port,'0.0.0.0',()=>console.log('QUILLUM escuchando en el puerto',port));
    process.on('SIGTERM',()=>{cola.cerrada=true;servidor.close();});
  }).catch(()=>{console.error('No se pudo iniciar el servicio. Revisa DATA_DIR y sus permisos.');process.exitCode=1;});
}
module.exports={crearApp,limpiarError};
