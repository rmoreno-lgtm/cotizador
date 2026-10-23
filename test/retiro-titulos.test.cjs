const test=require('node:test'),assert=require('node:assert/strict');
const {sugerencias,sugerido,validarTitulo}=require('../retiro/titulos.cjs');
const {vista}=require('../retiro/vista.cjs');
test('Títulos sugeridos usan el nombre del cliente y mantienen cuatro enfoques distintos',()=>{
 const m={campos:{cliente:{valor:'Luz Hernández'}}};const titulos=sugerencias(m);
 assert.equal(Object.keys(titulos).length,4);assert.equal(new Set(Object.values(titulos)).size,4);
 for(const t of Object.values(titulos))assert.match(t,/^Luz, /);
 assert.match(titulos.retiro,/retiro/);assert.match(titulos.personas,/quienes más quieres/);
 assert.throws(()=>sugerido(m,'__proto__'),/Enfoque/);
 assert.doesNotMatch(sugerido({campos:{}},'retiro'),/undefined|null/);
});
test('Edición admite texto acotado y rechaza cargas ajenas a texto y caracteres de control',()=>{
 assert.equal(validarTitulo('  Luz,\n pensemos en tu futuro.  '),'Luz, pensemos en tu futuro.');
 assert.equal(validarTitulo(''),'');assert.equal(validarTitulo('a'.repeat(140)).length,140);
 for(const valor of ['a'.repeat(141),{titulo:'x'},['x'],null,'Luz\x00hola'])assert.throws(()=>validarTitulo(valor),/140 caracteres/);
});
test('El título editado y el sugerido escapan HTML, sin alterar nombres ni cifras del modelo',()=>{
 const m={campos:{cliente:{valor:'<img/onerror=alert(1)>'}}};
 const original=JSON.stringify(m),html=vista(m,'retiro',{},undefined,{titulo:'Luz, <script>alert(1)</script>'});
 assert.doesNotMatch(html,/<script>|<img\/onerror/);assert.match(html,/Luz, &lt;script&gt;/);assert.equal(JSON.stringify(m),original);
 const sugerida=vista(m);assert.doesNotMatch(sugerida,/<img\/onerror/);assert.match(sugerida,/&lt;img\/onerror/);
});
