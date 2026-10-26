const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const ejecutar=promisify(execFile);
async function ocr(parser,total){
 if(total<1 || total>10)throw Error('La lectura OCR admite hasta 10 páginas por ilustración.');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-ocr-'));const paginas=[];
 try{
  for(let numero=1;numero<=total;numero++){
   const imagen=await parser.getScreenshot({partial:[numero],desiredWidth:1836,imageDataUrl:false});
   const archivo=path.join(dir,numero+'.png');await fs.writeFile(archivo,imagen.pages[0].data,{mode:0o600});
   try{
    const {stdout}=await ejecutar('tesseract',[archivo,'stdout','-l','eng','--psm','3'],{env:{...process.env,OMP_THREAD_LIMIT:'1'},timeout:30000,maxBuffer:2*1024*1024});
    paginas.push(stdout);
   }catch(e){if(e.code==='ENOENT')throw Error('Este PDF necesita OCR. Instala Tesseract para leer las páginas escaneadas.');throw Error('No se pudo completar el OCR de la página '+numero+'.');}
   await fs.unlink(archivo);
  }
  return paginas.join('\n\n');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
module.exports={ocr};
