const test=require('node:test'),assert=require('node:assert/strict');
const {redactar,validarContexto}=require('../retiro/redaccion.cjs');
const modelo={campos:{cliente:{valor:'Luz Apellido Privado'},ahorro:{valor:'999999999'}},tabla:[{proteccion:123456789}],coberturas:[{tipo:'invalidez',suma:987654321}]};
const opciones={modelo,enfoque:'retiro',contexto:'Quiere viajar y mantener su independencia.',env:{OPENAI_API_KEY:'clave-simulada'}};
const respuesta=datos=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(datos)}]}]})});
const textos={titulo:'Luz, un retiro con espacio para tus proyectos.',frase:'Demos forma a una propuesta que acompañe tus prioridades y tu manera de vivir.'};
test('Redacción envía únicamente primer nombre, enfoque y contexto; devuelve textos sin modificar el plan',async()=>{
 const antes=JSON.stringify(modelo);let peticion;
 const out=await redactar({...opciones,solicitar:async(url,opts)=>{peticion={url,opts,body:JSON.parse(opts.body)};return respuesta(textos);}});
 assert.deepEqual(out,textos);assert.equal(peticion.url,'https://api.openai.com/v1/responses');assert.equal(peticion.body.store,false);
 assert.deepEqual(JSON.parse(peticion.body.input),{nombre:'Luz',enfoque:'Retiro personal',contexto:opciones.contexto});assert.doesNotMatch(peticion.body.input,/Apellido|999999999|123456789|987654321/);assert.equal(JSON.stringify(modelo),antes);
});
test('Sin clave o con contexto inválido no llama al proveedor',async()=>{
 let llamadas=0;const solicitar=async()=>{llamadas++;return respuesta(textos);};
 await assert.rejects(redactar({...opciones,env:{},solicitar}),e=>e.status===503&&/OPENAI_API_KEY/.test(e.message));
 for(const contexto of ['',null,'x'.repeat(1001),'hola\x00mundo mundo'])await assert.rejects(redactar({...opciones,contexto,solicitar}),e=>e.status===400);
 await assert.rejects(redactar({...opciones,enfoque:'__proto__',solicitar}),e=>e.status===400);assert.equal(llamadas,0);assert.equal(validarContexto('  Quiere viajar.  '),'Quiere viajar.');
});
test('Rechaza cifras, promesas, HTML, exceso de longitud y salidas incompletas',async()=>{
 for(const datos of [{...textos,titulo:'Luz, obtén $500 garantizados'},{...textos,frase:'Un rendimiento garantizado para ti.'},{...textos,frase:'Recibirás indemnización por invalidez.'},{...textos,titulo:'<script>alert()</script>'},{...textos,frase:'x'.repeat(161)},{...textos,titulo:''},{...textos,ahorro:999}])await assert.rejects(redactar({...opciones,solicitar:async()=>respuesta(datos)}),e=>e.status===502);
 await assert.rejects(redactar({...opciones,solicitar:async()=>({ok:true,json:async()=>({status:'incomplete',output:[]})})}),e=>e.status===502);
});
test('Errores de proveedor, red y rechazos se comunican sin exponer la clave ni su respuesta interna',async()=>{
 for(const status of [401,403,429,500])await assert.rejects(redactar({...opciones,solicitar:async()=>({ok:false,status})}),e=>{assert.doesNotMatch(e.message,/clave-simulada/);return e.status===(status===429?429:502);});
 await assert.rejects(redactar({...opciones,solicitar:async()=>{throw Error('detalle-interno clave-simulada');}}),e=>e.status===502&&!/detalle-interno|clave-simulada/.test(e.message));
 await assert.rejects(redactar({...opciones,solicitar:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'motivo'}]}]})})}),e=>e.status===502);
});
