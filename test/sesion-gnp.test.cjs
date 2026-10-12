const test=require('node:test'),assert=require('node:assert/strict');
const {crearSesion}=require('../cotizador-gnp.cjs');
test('tres cotizaciones comparten navegador, página y login; vuelven al menú sin salir',async()=>{
 let lanzamientos=0,login=0,cierres=0,navegaciones=0,esperas=0;
 const page={setDefaultTimeout(){},async goto(url){assert.equal(url,'https://portalintermediarios.gnp.com.mx/sesion');navegaciones++;},getByRole(){return {filter(){return {async waitFor(){esperas++;}};}};}};
 const browser={async newContext(){return {async newPage(){return page;}};},async close(){cierres++;}};
 const vistas=[];
 const sesion=await crearSesion({GNP_USERNAME:'test',GNP_PASSWORD:'test'},{chromium:{async launch(){lanzamientos++;return browser;}},iniciarSesion:async p=>{assert.equal(p,page);login++;},cotizarEnPagina:async(p,s)=>{vistas.push(p);return s;}});
 for(let i=0;i<3;i++)await sesion.cotizar({deducible:i},'prueba.pdf');
 await sesion.cerrar();await sesion.cerrar();
 assert.equal(lanzamientos,1);assert.equal(login,1);assert.equal(cierres,1);assert.equal(navegaciones,2);assert.equal(esperas,2);assert.ok(vistas.every(p=>p===page));
 await assert.rejects(sesion.cotizar({},'x'),/cerrada/);
});
test('cierra el navegador cuando falla el primer login',async()=>{
 let cierres=0;
 await assert.rejects(crearSesion({GNP_USERNAME:'test',GNP_PASSWORD:'test'},{chromium:{async launch(){return {async newContext(){return {async newPage(){return {setDefaultTimeout(){}};}};},async close(){cierres++;}};}},iniciarSesion:async()=>{throw Error('fallo');}}),/fallo/);
 assert.equal(cierres,1);
});
