const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const firma=Buffer.from([137,80,78,71,13,10,26,10]);
function validar(buffer){
 if(!buffer || buffer.length>2*1024*1024 || buffer.length<45 || !buffer.subarray(0,8).equals(firma) || buffer.toString('ascii',12,16)!=='IHDR' || buffer.toString('ascii',buffer.length-8,buffer.length-4)!=='IEND')throw Error('Los logos deben ser archivos PNG completos, máximo 2 MB cada uno.');
 const ancho=buffer.readUInt32BE(16),alto=buffer.readUInt32BE(20);
 if(!ancho||!alto||ancho>6000||alto>6000)throw Error('El logo debe medir entre 1 y 6000 píxeles por lado.');
}
function almacenLogos(base){
 const rutas={quillum:path.join(base,'logo-quillum.png'),gnp:path.join(base,'logo-gnp.png')};
 async function leer(){
  const logos={};for(const [marca,ruta]of Object.entries(rutas))try{const b=await fs.readFile(ruta);validar(b);logos[marca]='data:image/png;base64,'+b.toString('base64');}catch(e){if(e.code!=='ENOENT')throw e;}
  return logos;
 }
 async function guardar(archivos){
  const entradas=Object.entries(archivos).filter(([,b])=>b);
  if(!entradas.length)throw Error('Selecciona al menos un logo para guardar.');
  for(const [marca,b]of entradas){if(!rutas[marca])throw Error('Logo no reconocido.');validar(b);}
  await fs.mkdir(base,{recursive:true});
  for(const [marca,b]of entradas){const temp=rutas[marca]+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,b);await fs.rename(temp,rutas[marca]);}finally{await fs.rm(temp,{force:true});}}
  return leer();
 }
 return {leer,guardar};
}
module.exports={almacenLogos,validar};
