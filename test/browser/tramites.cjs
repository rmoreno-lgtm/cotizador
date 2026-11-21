const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {crearApp}=require('../../server.cjs');
const {chromium}=require('playwright');
const {recorrer}=require('../../tramites/portal.cjs');

(async()=>{
  const browser=await chromium.launch({
    headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH
  });
  try {
    const page=await browser.newPage();
    await page.route('https://portalintermediarios.gnp.com.mx/**',route=>route.fulfill({
      contentType:'text/html; charset=utf-8',
      body:`<nav><button onclick="document.querySelector('#servicios').hidden=false">menu</button>
      <button id="servicios" hidden onclick="document.querySelector('#gmm').hidden=false">Servicios asistidos</button>
      <button id="gmm" hidden onclick="document.querySelector('#buscar').hidden=false">Gastos médicos</button></nav>
      <button id="buscar" hidden onclick="document.querySelector('#resultados').hidden=false">Buscar</button>
      <section id="resultados" hidden><table>
        <thead><tr><th>Estado</th><th>Folio de trámite</th><th>Paciente</th></tr></thead>
        <tbody id="filas"><tr><td>En proceso</td><td>GNP-001</td><td>Dato sintético</td></tr>
        <tr><td>Cerrado</td><td>GNP-002</td><td>Dato sintético</td></tr></tbody></table>
        <button onclick="document.querySelector('#filas').innerHTML='<tr><td>Activada</td><td>GNP-003</td><td>Dato sintético</td></tr>';this.disabled=true">Siguiente</button>
      </section>`
    }));
    await page.goto('https://portalintermediarios.gnp.com.mx/sesion');
    const pasos=[];
    const resultado=await recorrer(page,paso=>pasos.push(paso));
    assert.deepEqual(resultado,{paginas:2,tramites:[
      {folio:'GNP-001',estado:'En proceso'},{folio:'GNP-003',estado:'Activado'}
    ]});
    assert.deepEqual(pasos,['Servicios asistidos','Gastos médicos','Tabla con columnas Folio y Estado']);
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quillum-tramites-web-'));
    const secreto='clave-local-para-probar-tramites';
    let server;
    try {
      const {app}=await crearApp({env:{DATA_DIR:dir,APP_SECRET:secreto}});
      await fs.writeFile(path.join(dir,'tramites-gnp.json'),JSON.stringify({...resultado,consultadoEn:new Date().toISOString()}));
      server=app.listen(0,'127.0.0.1');
      await new Promise(resolve=>server.once('listening',resolve));
      await page.setExtraHTTPHeaders({Authorization:'Bearer '+secreto});
      await page.goto('http://127.0.0.1:'+server.address().port+'/#inicio');
      await page.getByRole('link',{name:'Trámites',exact:true}).click();
      await page.getByRole('heading',{name:'Trámites',exact:true}).waitFor();
      const tabla=page.getByRole('table',{name:'Trámites de Gastos Médicos'});
      await tabla.getByText('GNP-003').waitFor();
      assert.equal(await tabla.getByRole('row').count(),3);
      assert.equal(await tabla.getByText('Dato sintético').count(),0);
    } finally {
      if(server) {
        server.closeAllConnections();
        await new Promise(resolve=>server.close(resolve));
      }
      await fs.rm(dir,{recursive:true,force:true});
    }
    console.log('Trámites: búsqueda, orden de columnas, paginación y filtrado verificados.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
