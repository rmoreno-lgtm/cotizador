const crypto=require('node:crypto');
const multer=require('multer');
const {leer,ENFOQUES}=require('./modelo.cjs');
const {vista}=require('./vista.cjs');
const {paginas,formatoValido}=require('./recorrido.cjs');
const {sugerencias,sugerido,validarTitulo,validarFrase}=require('./titulos.cjs');
const {almacenLogos}=require('./logos.cjs');
const {redactar}=require('./redaccion.cjs');
const {generarPdf,camposFaltantes}=require('./pdf.cjs');
function registrar(app,{limpiarError,env,base}){
 const borradores=new Map();let leyendo=false,exportando=false,redactando=false,proximaRedaccion=0;
 const almacen=almacenLogos(base);
 const estado=logos=>({quillum:!!logos.quillum,gnp:!!logos.gnp});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:40*1024*1024,files:3,fields:1,fieldSize:100}}).fields([{name:'pdf',maxCount:1},{name:'quillum',maxCount:1},{name:'gnp',maxCount:1}]);
 const uploadLogos=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:2,fields:0}}).fields([{name:'quillum',maxCount:1},{name:'gnp',maxCount:1}]);
 const limpiar=()=>{for(const [id,b]of borradores)if(b.expira<Date.now())borradores.delete(id);};
 app.get('/api/retiro/redaccion',(req,res)=>res.json({disponible:!!env.OPENAI_API_KEY}));
 app.get('/api/retiro/logos',async(req,res)=>{try{res.json(estado(await almacen.leer()));}catch{res.status(500).json({error:'No se pudieron leer los logos guardados. Revisa el almacenamiento.'});}});
 app.post('/api/retiro/logos',uploadLogos,async(req,res)=>{
  try{const logos=await almacen.guardar({quillum:req.files?.quillum?.[0]?.buffer,gnp:req.files?.gnp?.[0]?.buffer});res.json({ok:true,...estado(logos)});}catch(e){res.status(400).json({error:limpiarError(e,env)});}
 });
 app.post('/api/retiro/preview',upload,async(req,res)=>{
  limpiar();if(leyendo)return res.status(429).json({error:'Hay una ilustración en lectura. Intenta de nuevo en unos momentos.'});
  if(borradores.size>=5)return res.status(429).json({error:'Cierra un borrador antes de cargar otra ilustración.'});
  const enfoque=req.body.enfoque||'retiro';if(typeof enfoque!=='string'||!Object.hasOwn(ENFOQUES,enfoque))return res.status(400).json({error:'Enfoque inválido.'});
  leyendo=true;
  try{
   const modelo=await leer(req.files?.pdf?.[0]?.buffer);
   const nuevos={quillum:req.files?.quillum?.[0]?.buffer,gnp:req.files?.gnp?.[0]?.buffer};
   const logos=nuevos.quillum||nuevos.gnp?await almacen.guardar(nuevos):await almacen.leer();
   const id=crypto.randomUUID();borradores.set(id,{modelo,titulos:{},frases:{},expira:Date.now()+30*60*1000});
   res.status(201).json({id,modelo,enfoque,titulos:sugerencias(modelo),logos:estado(logos),paginas:paginas(modelo),paginasPorFormato:{resumida:2,detallada:paginas(modelo)},datosListos:modelo.tablaValida&&camposFaltantes(modelo).length===0});
  }catch(e){res.status(400).json({error:limpiarError(e,env)});}finally{leyendo=false;}
 });
 function seleccion(req,res){
  limpiar();const b=borradores.get(req.params.id);if(!b){res.status(404).json({error:'La vista previa expiró. Vuelve a cargar la ilustración.'});return;}
  const enfoque=req.query.enfoque||'retiro';if(typeof enfoque!=='string'||!Object.hasOwn(ENFOQUES,enfoque)){res.status(400).json({error:'Enfoque inválido.'});return;}
  const formato=req.query.formato===undefined?'detallada':req.query.formato;if(!formatoValido(formato)){res.status(400).json({error:'Presentación inválida.'});return;}
  const anio=req.query.anio===undefined?undefined:Number(req.query.anio);
  if(anio!==undefined&&(!Number.isSafeInteger(anio)||!b.modelo.tablaValida||!b.modelo.tabla.some(f=>f.anio===anio))){res.status(400).json({error:'Año de ejemplo inválido.'});return;}
  return {modelo:b.modelo,enfoque,anio,formato,titulo:b.titulos[enfoque]||sugerido(b.modelo,enfoque),frase:b.frases[enfoque]||''};
 }
 app.post('/api/retiro/:id/sugerir',async(req,res)=>{
  limpiar();const b=borradores.get(req.params.id);if(!b)return res.status(404).json({error:'La vista previa expiró. Vuelve a cargar la ilustración.'});
  if(redactando||Date.now()<proximaRedaccion)return res.status(429).json({error:'Espera unos segundos antes de solicitar otra redacción.'});
  redactando=true;
  try{const textos=await redactar({modelo:b.modelo,enfoque:req.body?.enfoque,contexto:req.body?.contexto,env});proximaRedaccion=Date.now()+10000;res.json(textos);}catch(e){res.status(e.status||502).json({error:e.status?e.message:'No se pudo completar la redacción. Tus textos actuales se conservan.'});}finally{redactando=false;}
 });
 app.patch('/api/retiro/:id/titulo',(req,res)=>{
  limpiar();const b=borradores.get(req.params.id);if(!b)return res.status(404).json({error:'La vista previa expiró. Vuelve a cargar la ilustración.'});
  const enfoque=req.body?.enfoque;if(typeof enfoque!=='string'||!Object.hasOwn(ENFOQUES,enfoque))return res.status(400).json({error:'Enfoque inválido.'});
  try{const titulo=validarTitulo(req.body.titulo),frase=req.body.frase===undefined?b.frases[enfoque]||'':validarFrase(req.body.frase);b.frases[enfoque]=frase;if(titulo)b.titulos[enfoque]=titulo;else delete b.titulos[enfoque];res.json({titulo:b.titulos[enfoque]||sugerido(b.modelo,enfoque),frase:b.frases[enfoque]||''});}catch(e){res.status(400).json({error:e.message});}
 });
 app.get('/api/retiro/:id/vista',async(req,res)=>{
  const s=seleccion(req,res);if(!s)return;
  const pagina=req.query.pagina===undefined?undefined:Number(req.query.pagina),ancho=req.query.ancho===undefined?818:Number(req.query.ancho);
  if((pagina!==undefined&&(!Number.isInteger(pagina)||pagina<1||pagina>paginas(s.modelo,s.formato)))||!Number.isFinite(ancho)||ancho<280||ancho>2000)return res.status(400).json({error:'Vista previa inválida.'});
  try{const logos=await almacen.leer();res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox");res.type('html').send(vista(s.modelo,s.enfoque,logos,s.anio,{pagina,ancho,titulo:s.titulo,frase:s.frase,formato:s.formato}));}catch{res.status(500).send('No se pudo abrir la vista previa. Revisa los logos guardados.');}
 });
 app.get('/api/retiro/:id/pdf',async(req,res)=>{
  const s=seleccion(req,res);if(!s)return;
  if(exportando)return res.status(429).json({error:'Se está preparando otro PDF. Intenta de nuevo en unos momentos.'});
  exportando=true;
  try{
   const pdf=await generarPdf(s.modelo,s.enfoque,await almacen.leer(),s.anio,env,{titulo:s.titulo,frase:s.frase,formato:s.formato});
   res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Propuesta-QUILLUM-Vida-Retiro.pdf"'}).send(pdf);
  }catch(e){res.status(422).json({error:limpiarError(e,env)});}finally{exportando=false;}
 });
 app.delete('/api/retiro/:id',(req,res)=>{borradores.delete(req.params.id);res.json({ok:true});});
}
module.exports={registrar};
