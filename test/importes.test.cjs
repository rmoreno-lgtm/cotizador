const test=require('node:test');const assert=require('node:assert/strict');
const {analizarPaginas,dinero}=require('../leer-gnp.cjs');
function escenario({descuento=40000,incluido=true,alterarTotal=0}={}) {
 const s={nombre:'Familia de prueba',edad:'48',genero:'Masculino',cp:'12345',familiares:[{edad:'45',genero:'Masculino'},{edad:'23',genero:'Femenino'},{edad:'56',genero:'Masculino'}],tabulador:'D',deducible:'56000',acceso:'Amplio',alta:false,solidez:descuento>0};
 const monto=n=>dinero(n,true);
 const portada=`Seguro Médico GNP Personaliza\nCotización núm. 1234567\nFecha de cotización: 11/Oct/2026\nVálida hasta: 26/Oct/2026\nAgente: Asesor de prueba\nPago anual de $${monto(475600+alterarTotal)}\nPrima neta anual: $${monto(incluido?400000:400000+descuento)}\nRecargo\npor pago\nfraccionado\n+ $0.00\nDerecho\nde Póliza\n+ $100.00\nDescuento\npor solidez\nfamiliar\n- $${monto(descuento)}\nI.V.A\n+ $656.00\nAcceso hospitalario\nAmplio\nNivel de tabulador\nD\nVariable con $56,000 de deducible`;
 const tabla='Honorarios médicos. Gastos hospitalarios. Rehabilitación.\nSuma Asegurada Cobertura Básica: $93,280,000 (A)\nTope de coaseguro\nA $56,000(I) 20% $94,000\nB $45,000(I) 15% $70,000\nC $32,000(I) 10% $53,000\nD $21,000(I) 5% $35,000\n(I) Por año por padecimiento (A) Por año Póliza por asegurado';
 const personas=[s,...s.familiares];
 const detalles=personas.map((p,i)=>`Edad: ${p.edad} Género: ${p.genero==='Masculino'?'M':'F'} Riesgo: Normal C.P: 12345\nPrima Neta: $1,000.00\nRecargo por pago Fraccionado: $0.00\nDerecho de Póliza: $${i===0?'100.00':'0.00'}\nI.V.A : $${i===0?'176.00':'160.00'}\nImporte Total Anual: $${i===0?'1,276.00':'1,160.00'}`).join('\n');
 return {s,paginas:[portada,tabla,'Desglose de Cotización\nFolio de cotización: 1234567\n'+detalles]};
}
test('Solidez ya incluida en prima neta: no se resta dos veces y se contrastan los cuatro asegurados',()=>{
 const {s,paginas}=escenario();const d=analizarPaginas(paginas,s);
 assert.equal(d.monto.total,475600);assert.equal(d.descuentoIncluidoEnNeta,true);assert.equal(d.asegurados.length,4);
});
test('formato con descuento separado se valida contra primas netas del desglose',()=>{
 const {s,paginas}=escenario({incluido:false});const d=analizarPaginas(paginas,s);
 assert.equal(d.descuentoIncluidoEnNeta,false);assert.equal(d.monto.neta,440000);assert.equal(d.monto.total,475600);
});
test('sin descuento conserva la comprobación al centavo',()=>{
 const {s,paginas}=escenario({descuento:0});const d=analizarPaginas(paginas,s);
 assert.equal(d.monto.descuento,0);assert.equal(d.descuentoIncluidoEnNeta,false);
 const malo=escenario({descuento:0,alterarTotal:1});assert.throws(()=>analizarPaginas(malo.paginas,malo.s),/cuadran al centavo/);
});
test('no acepta resumen aparentemente correcto con un asegurado mal desglosado',()=>{
 const {s,paginas}=escenario();paginas[2]=paginas[2].replace('Importe Total Anual: $1,276.00','Importe Total Anual: $1,276.01');
 assert.throws(()=>analizarPaginas(paginas,s),/desglose/);
});

function escenarioEtiquetado(orden=[0,1,3,2]) {
 const {s,paginas}=escenario();
 const [cabecera,...personas]=paginas[2].split(/(?=Edad:)/);
 const bloques=personas.map((p,i)=>(i===0?'Titular':'Familiar '+i)+'\n'+p);
 paginas[2]=cabecera+orden.map(i=>bloques[i]).join('\n');
 return {s,paginas,bloques,cabecera};
}
test('identifica al titular y cada familiar por su etiqueta aunque el extractor lea las columnas en otro orden',()=>{
 for(const orden of [[0,1,3,2],[3,1,0,2],[0,2,1,3]]){
  const {s,paginas}=escenarioEtiquetado(orden);const d=analizarPaginas(paginas,s);
  assert.deepEqual(d.asegurados.map(p=>p.edad),[48,45,23,56]);assert.deepEqual(d.asegurados.map(p=>p.genero),[s,...s.familiares].map(p=>p.genero));assert.equal(d.monto.total,475600);
 }
});
test('etiquetas reordenadas no permiten omitir diferencias reales de edad, género o CP',()=>{
 for(const [original,cambio,error]of [['Edad: 23','Edad: 24',/edad/],['Edad: 23 Género: F','Edad: 23 Género: M',/género/],['Edad: 23 Género: F Riesgo: Normal C.P: 12345','Edad: 23 Género: F Riesgo: Normal C.P: 99999',/CP/]]){
  const {s,paginas}=escenarioEtiquetado();paginas[2]=paginas[2].replace(original,cambio);assert.throws(()=>analizarPaginas(paginas,s),error);
 }
 const {s,paginas,bloques,cabecera}=escenarioEtiquetado();
 paginas[2]=cabecera+[bloques[0],bloques[1],bloques[3].replace('Familiar 3','Familiar 2'),bloques[2].replace('Familiar 2','Familiar 3')].join('\n');
 assert.throws(()=>analizarPaginas(paginas,s),/edad/);
});
test('rechaza etiquetas duplicadas, faltantes o ajenas a la solicitud',()=>{
 for(const reemplazo of ['Familiar 2','Familiar 7','']){
  const {s,paginas}=escenarioEtiquetado();paginas[2]=paginas[2].replace('Familiar 3',reemplazo);assert.throws(()=>analizarPaginas(paginas,s),/etiqueta/);
 }
});
test('sin etiquetas conserva la validación estricta por orden y no empareja familiares solo por sus edades',()=>{
 const {s,paginas,bloques,cabecera}=escenarioEtiquetado();paginas[2]=cabecera+[0,1,3,2].map(i=>bloques[i].replace(/^(?:Titular|Familiar \d+)\n/,'')).join('\n');assert.throws(()=>analizarPaginas(paginas,s),/edad/);
});
