const {chromium}=require('playwright');
const {vista}=require('./vista.cjs');
function camposFaltantes(modelo){return ['cliente','edad','inflacion','plazoPago','moneda','edadVencimiento','ahorro'].filter(k=>!modelo.campos[k]);}
async function generarPdf(modelo,enfoque,logos,anio,env,opciones={}){
 if(!modelo.tablaValida || camposFaltantes(modelo).length)throw Error('Revisa los datos pendientes de la ilustración antes de descargar la propuesta.');
 if(!logos.quillum||!logos.gnp)throw Error('Guarda los logos de QUILLUM y GNP antes de descargar la propuesta.');
 const browser=await chromium.launch({headless:true,...(env.CHROMIUM_EXECUTABLE_PATH?{executablePath:env.CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(15000);await page.emulateMedia({media:'print'});
  await page.setContent(vista(modelo,enfoque,logos,anio,opciones),{waitUntil:'load',timeout:15000});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async img=>{await img.decode();if(!img.naturalWidth)throw Error('No se pudo leer un logo.');}));});
  const invade=await page.evaluate(()=>[...document.querySelectorAll('.hoja')].some(p=>{
   const limite=p.querySelector('footer').getBoundingClientRect().top;
   return [...p.children].filter(e=>e.tagName!=='FOOTER').some(e=>e.getBoundingClientRect().bottom>limite-3);
  }));
  if(invade)throw Error('El contenido excede el espacio de una página. Revisa la ilustración antes de descargar.');
  return await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
 }finally{await browser.close();}
}
module.exports={generarPdf,camposFaltantes};
