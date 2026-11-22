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
    const acceso=`<nav><button onclick="document.querySelector('#ramos').hidden=false">Servicios asistidos</button></nav>
      <main id="ramos" hidden>
        <button onclick="document.querySelector('#opciones-gmm').hidden=false">GMM</button>
        <div id="opciones-gmm" hidden>
          <section><h2>Vida</h2><button onclick="document.body.innerHTML='Ruta incorrecta'">Consulta</button></section>
          <section><h2>Gastos Médicos</h2>
            <button aria-controls="medicos" aria-expanded="false"
              onclick="this.setAttribute('aria-expanded','true');document.querySelector('#medicos').hidden=false">
              <svg aria-hidden="true" width="15" height="15"><path d="M1 1L7 7L13 1"/></svg>
            </button>
          </section>
          <div style="height:1600px"></div>
          <section id="medicos" hidden>__CONSULTA__</section>
        </div>
      </main>`;
    const tablaGnp=`<section id="resultados" __OCULTO__><table>
      <thead><tr><th>Estado</th><th>Folio de trámite</th><th>Paciente</th></tr></thead>
      <tbody id="filas"><tr><td>En proceso</td><td>GNP-001</td><td>Dato sintético</td></tr>
      <tr><td>Cerrado</td><td>GNP-002</td><td>Dato sintético</td></tr></tbody></table>
      <button onclick="document.querySelector('#filas').innerHTML='<tr><td>Activadas</td><td>GNP-003</td><td>Dato sintético</td></tr>';this.disabled=true">Siguiente</button>
    </section>`;
    await page.context().route('https://portalintermediarios.gnp.com.mx/**',route=>{
      const {pathname}=new URL(route.request().url());
      let body;
      if(pathname==='/consulta-gnp'){
        body=tablaGnp.replace('__OCULTO__','');
      }else if(pathname==='/consulta-nueva-pestana'){
        body=acceso.replace('aria-controls="medicos"','').replace('__CONSULTA__',`<div onclick="window.open('/consulta-gnp','_blank')"><span>Consulta</span></div>`);
      }else{
        body=acceso.replace('__CONSULTA__',`<button onclick="document.querySelector('#resultados').hidden=false">Consulta</button>`)+
          tablaGnp.replace('__OCULTO__','hidden');
      }
      return route.fulfill({contentType:'text/html; charset=utf-8',body});
    });
    await page.goto('https://portalintermediarios.gnp.com.mx/sesion');
    const vista=await recorrer(page,undefined,'vista');
    assert.deepEqual(vista,{
      columnas:['Estado','Folio de trámite','Paciente'],
      filas:[['En proceso','GNP-001','Dato sintético'],['Cerrado','GNP-002','Dato sintético']]
    });
    assert.equal(await page.getByRole('button',{name:'Siguiente'}).isEnabled(),true);
    await page.goto('https://portalintermediarios.gnp.com.mx/sesion');
    const pasos=[];
    const resultado=await recorrer(page,paso=>pasos.push(paso));
    assert.deepEqual(resultado,{paginas:2,tramites:[
      {folio:'GNP-001',estado:'En proceso'},{folio:'GNP-003',estado:'Activado'}
    ]});
    assert.deepEqual(pasos,['Servicios asistidos','GMM','Gastos Médicos localizado','Gastos Médicos desplegado','Consulta','Tabla de Consulta']);
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
      let mostrandoVista=false;
      await page.route('**/api/tramites/vista',async route=>{
        mostrandoVista=true;
        await route.fulfill({status:202});
      });
      await page.route('**/api/tramites',async route=>{
        const response=await route.fetch();
        const datos=await response.json();
        await route.fulfill({json:{...datos,configurado:true,vistaPrevia:mostrandoVista
          ?{...vista,consultadoEn:new Date().toISOString()}:null}});
      });
      await page.reload();
      await page.getByRole('button',{name:'Ver tabla de GNP'}).click();
      const tablaVista=page.getByRole('table',{name:'Tabla de Consulta en GNP'});
      await tablaVista.getByRole('columnheader',{name:'Paciente'}).waitFor();
      await tablaVista.getByText('Cerrado').waitFor();
      assert.equal(await tablaVista.getByText('Dato sintético').count(),2);
      assert.equal(await page.getByRole('button',{name:'Generar reporte de estados'}).isEnabled(),true);

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
    console.log('Trámites: ruta por GMM, flecha separada, Consulta debajo del área visible, vista de la tabla sin paginar y reporte en pestaña nueva verificados.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
