const crypto=require('node:crypto');
const multer=require('multer');
const {leer,ejercicio}=require('./modelo.cjs');
const {vista,paginas}=require('./vista.cjs');
const {almacenLogos}=require('../retiro/logos.cjs');
const {renderizarPdf}=require('../documento-pdf.cjs');
function registrar(app,{base,env,limpiarError}){
 const borradores=new Map(),logos=almacenLogos(base);let leyendo=false,exportando=false;
 const limpiar=()=>{for(const [id,b]of borradores)if(b.expira<Date.now())borradores.delete(id);};
 const estado=l=>({quillum:!!l.quillum,gnp:!!l.gnp});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:40*1024*1024,files:1,fields:0}}).single('pdf');
 app.get('/ppr.js',(req,res)=>res.sendFile(require('node:path').join(__dirname,'../web/ppr.js')));
 app.post('/api/ppr/preview',upload,async(req,res)=>{
  limpiar();if(leyendo)return res.status(429).json({error:'Hay una ilustración PPR en lectura. Intenta de nuevo en unos momentos.'});
  if(borradores.size>=5)return res.status(429).json({error:'Cierra un borrador PPR antes de cargar otra ilustración.'});
  leyendo=true;try{const modelo=await leer(req.file?.buffer),id=crypto.randomUUID();borradores.set(id,{modelo,expira:Date.now()+30*60000});const l=await logos.leer();res.status(201).json({id,modelo,ejercicio:modelo.tablaValida?ejercicio(modelo):undefined,datosListos:modelo.tablaValida,logos:estado(l),paginasPorFormato:{resumida:2,detallada:paginas(modelo)}});}catch(e){res.status(400).json({error:limpiarError(e,env)});}finally{leyendo=false;}
 });
 function seleccion(req,res){
  limpiar();const b=borradores.get(req.params.id);if(!b){res.status(404).json({error:'El borrador PPR expiró. Vuelve a cargar la ilustración.'});return;}
  const formato=req.query.formato===undefined?'detallada':req.query.formato;if(!['detallada','resumida'].includes(formato)){res.status(400).json({error:'Presentación inválida.'});return;}
  const anio=req.query.anio===undefined?undefined:Number(req.query.anio);if(anio!==undefined&&(!Number.isSafeInteger(anio)||!b.modelo.tablaValida||!b.modelo.tabla.some(f=>f.anio===anio&&f.aportacion>0))){res.status(400).json({error:'Elige un año con aportaciones para el ejercicio fiscal.'});return;}
  return {modelo:b.modelo,opciones:{formato,anio}};
 }
 app.get('/api/ppr/:id/vista',async(req,res)=>{
  const s=seleccion(req,res);if(!s)return;const pagina=req.query.pagina===undefined?1:Number(req.query.pagina),ancho=req.query.ancho===undefined?818:Number(req.query.ancho);
  if(!Number.isInteger(pagina)||pagina<1||pagina>paginas(s.modelo,s.opciones.formato)||!Number.isFinite(ancho)||ancho<280||ancho>2000)return res.status(400).json({error:'Vista previa inválida.'});
  try{res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox");res.type('html').send(vista(s.modelo,await logos.leer(),{...s.opciones,pagina,ancho}));}catch(e){res.status(422).type('text').send(limpiarError(e,env));}
 });
 app.get('/api/ppr/:id/pdf',async(req,res)=>{
  const s=seleccion(req,res);if(!s)return;if(exportando)return res.status(429).json({error:'Se está preparando otro PPR. Intenta en unos momentos.'});
  exportando=true;try{const l=await logos.leer();if(!l.quillum||!l.gnp)throw Error('Guarda los logos de QUILLUM y GNP antes de descargar.');const pdf=await renderizarPdf(vista(s.modelo,l,s.opciones),env);res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Propuesta-QUILLUM-PPR.pdf"'}).send(pdf);}catch(e){res.status(422).json({error:limpiarError(e,env)});}finally{exportando=false;}
 });
 app.delete('/api/ppr/:id',(req,res)=>{borradores.delete(req.params.id);res.json({ok:true});});
}
module.exports={registrar};
