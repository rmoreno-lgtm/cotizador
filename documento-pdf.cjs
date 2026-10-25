const {chromium}=require('playwright');
async function renderizarPdf(html,env={}){
 const browser=await chromium.launch({headless:true,...(env.CHROMIUM_EXECUTABLE_PATH?{executablePath:env.CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(15000);await page.emulateMedia({media:'print'});
  await page.setContent(html,{waitUntil:'load',timeout:15000});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async img=>{await img.decode();if(!img.naturalWidth)throw Error('No se pudo leer un logo.');}));});
  const invade=await page.evaluate(()=>[...document.querySelectorAll('.hoja')].some(p=>{
   const limite=p.querySelector('footer').getBoundingClientRect().top;
   return [...p.children].filter(e=>e.tagName!=='FOOTER').some(e=>e.getBoundingClientRect().bottom>limite-3);
  }));
  if(invade)throw Error('El contenido excede el espacio de una página. Revisa la ilustración antes de descargar.');
  return await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
 }finally{await browser.close();}
}
module.exports={renderizarPdf};
