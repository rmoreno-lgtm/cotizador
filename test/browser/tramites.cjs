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
    const acceso=`<nav><button onclick="document.querySelector('#servicios').hidden=false">menu</button>
      <button id="servicios" hidden onclick="document.querySelector('#servicios-asistidos').hidden=false">Servicios asistidos</button></nav>
      <main id="servicios-asistidos" hidden>
        <section><h2>Solo vida</h2><button onclick="document.body.innerHTML='Ruta incorrecta'">Consulta</button></section>
        <div style="height:1600px"></div>
        <section><h2>Todos los ramos</h2>__CONSULTA__</section>
      </main>`;
    const formulario=`<div id="filtros" __OCULTO__>
        <label>Ramo <select onchange="document.querySelector('#consultar').disabled=this.value!=='medicos'">
          <option value="vida" selected>Vida</option>
          <option value="autos">Autos</option>
          <option value="medicos">Gastos Médicos Mayores</option>
        </select></label>
        <button id="consultar" disabled onclick="document.querySelector('#resultados').hidden=false">Consultar</button>
      </div>
      <section id="resultados" hidden><table>
        <thead><tr><th>Estado</th><th>Folio de trámite</th><th>Paciente</th></tr></thead>
        <tbody id="filas"><tr><td>En proceso</td><td>GNP-001</td><td>Dato sintético</td></tr>
        <tr><td>Cerrado</td><td>GNP-002</td><td>Dato sintético</td></tr></tbody></table>
        <button onclick="document.querySelector('#filas').innerHTML='<tr><td>Activadas</td><td>GNP-003</td><td>Dato sintético</td></tr>';this.disabled=true">Siguiente</button>
      </section>`;
    await page.context().route('https://portalintermediarios.gnp.com.mx/**',route=>{
      const {pathname}=new URL(route.request().url());
      let body;
      if(pathname==='/consulta-gnp'){
        body=formulario.replace('__OCULTO__','').replace(/<label>Ramo[^]*?<\/label>/,
          `<button type="button" role="combobox" aria-label="Ramo" aria-expanded="false"
          onclick="this.setAttribute('aria-expanded','true');document.querySelector('#ramos').hidden=false">Vida</button>
          <div role="listbox" id="ramos" hidden><div role="option"
            onclick="this.parentElement.hidden=true;document.querySelector('#consultar').disabled=false">Gastos Médicos</div></div>`);
      }else if(pathname==='/consulta-nueva-pestana'){
        body=acceso.replace('__CONSULTA__',`<div onclick="window.open('/consulta-gnp','_blank')"><span>Consulta</span></div>`);
      }else{
        body=acceso.replace('__CONSULTA__',`<button onclick="document.querySelector('#filtros').hidden=false">Consulta</button>`)+
          formulario.replace('__OCULTO__','hidden');
      }
      return route.fulfill({contentType:'text/html; charset=utf-8',body});
    });
    await page.goto('https://portalintermediarios.gnp.com.mx/sesion');
    const pasos=[];
    const resultado=await recorrer(page,paso=>pasos.push(paso));
    assert.deepEqual(resultado,{paginas:2,tramites:[
      {folio:'GNP-001',estado:'En proceso'},{folio:'GNP-003',estado:'Activado'}
    ]});
    assert.deepEqual(pasos,['Servicios asistidos','Todos los ramos → Consulta','Gastos Médicos Mayores','Consultar','Tabla con columnas Folio y Estado']);
    await page.goto('https://portalintermediarios.gnp.com.mx/consulta-nueva-pestana');
    assert.deepEqual(await recorrer(page),resultado);
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
    console.log('Trámites: tarjeta Todos los ramos, Consulta en nueva pestaña, selector y paginación verificados.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
