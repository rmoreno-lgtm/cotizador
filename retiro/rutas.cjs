const crypto=require('node:crypto');
const multer=require('multer');
const {leer,ENFOQUES}=require('./modelo.cjs');
const {vista}=require('./vista.cjs');
function registrar(app,{limpiarError,env}){
 const borradores=new Map();let leyendo=false;
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:40*1024*1024,files:3,fields:1,fieldSize:100}}).fields([{name:'pdf',maxCount:1},{name:'quillum',maxCount:1},{name:'gnp',maxCount:1}]);
 const limpiar=()=>{for(const [id,b]of borradores)if(b.expira<Date.now())borradores.delete(id);};
 app.post('/api/retiro/preview',upload,async(req,res)=>{
  limpiar();if(leyendo)return res.status(429).json({error:'Hay una ilustración en lectura. Intenta de nuevo en unos momentos.'});
  if(borradores.size>=5)return res.status(429).json({error:'Cierra un borrador antes de cargar otra ilustración.'});
  const enfoque=req.body.enfoque||'retiro';if(!ENFOQUES[enfoque])return res.status(400).json({error:'Enfoque inválido.'});
  const logos={};for(const k of ['quillum','gnp'])if(req.files?.[k]?.[0]){
   const b=req.files[k][0].buffer;
   if(b.length>2*1024*1024 || !b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return res.status(400).json({error:'Los logotipos deben ser PNG, máximo 2 MB cada uno.'});
   logos[k]='data:image/png;base64,'+b.toString('base64');
  }
  leyendo=true;
  try{
   const modelo=await leer(req.files?.pdf?.[0]?.buffer);
   const id=crypto.randomUUID();borradores.set(id,{modelo,logos,expira:Date.now()+30*60*1000});
   res.status(201).json({id,modelo,enfoque,logos:{quillum:!!logos.quillum,gnp:!!logos.gnp}});
  }catch(e){res.status(400).json({error:limpiarError(e,env)});}finally{leyendo=false;}
 });
 app.get('/api/retiro/:id/vista',(req,res)=>{
  limpiar();const b=borradores.get(req.params.id);if(!b)return res.status(404).send('El borrador expiró. Vuelve a cargar la ilustración.');
  const enfoque=req.query.enfoque||'retiro';if(!ENFOQUES[enfoque])return res.status(400).send('Enfoque inválido.');
  res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox");
  res.type('html').send(vista(b.modelo,enfoque,b.logos));
 });
 app.delete('/api/retiro/:id',(req,res)=>{borradores.delete(req.params.id);res.json({ok:true});});
}
module.exports={registrar};
