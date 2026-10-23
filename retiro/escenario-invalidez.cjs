const {icono}=require('./iconos.cjs');
const {dinero}=require('./recorrido.cjs');
const h=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function escenarioInvalidez(modelo,ejemplo){
 const exencion=modelo.coberturas?.find(c=>c.tipo==='exencion');
 const invalidez=modelo.coberturas?.find(c=>c.tipo==='invalidez');
 const titulo='<h3 class="titulo-invalidez"><span>'+icono('♿')+'</span>2 · Tu protección ante una invalidez</h3>';
 if(!exencion&&!invalidez)return titulo+'<p>Los beneficios por invalidez están pendientes de confirmar conforme a las coberturas de tu contrato.</p>';
 const cliente=modelo.campos?.cliente?h(modelo.campos.cliente.valor)+', ':'';
 const momento=ejemplo?'en el año '+ejemplo.anio+', a tus '+ejemplo.edad+' años, ':'durante la vigencia de tu plan ';
 const bloques=[],pagoFinal=modelo.tablaValida?modelo.tabla.findLast(f=>f.aportacion>0):null;
 const sinPendientes=ejemplo&&pagoFinal&&ejemplo.anio>pagoFinal.anio;
 if(exencion)bloques.push(`<div class="cobertura-invalidez"><span class="icono">${icono('✓')}</span><h4>Exención de primas</h4><p>${sinPendientes?'Para ese momento ya habrías terminado tus aportaciones. No quedarían nuevas aportaciones programadas por exentar.':'Dejas de pagar las primas amparadas por esta cobertura, conforme al dictamen de invalidez y a las condiciones de tu contrato.'}</p></div>`);
 if(invalidez)bloques.push(`<div class="cobertura-invalidez"><span class="icono">${icono('◇')}</span><h4>Invalidez Sin Espera</h4><p>Recibes la indemnización que corresponda a tu cobertura. Tu suma inicial es <b>${dinero(invalidez.suma)}</b>.</p><p>La suma vigente para el ${ejemplo?'año '+ejemplo.anio:'momento de una invalidez'} queda por verificar.</p></div>`);
 const ahorro=modelo.tablaValida&&modelo.campos.ahorro?dinero(modelo.campos.ahorro.valor):'Importe por confirmar';
 const tipo=modelo.ahorroTipo==='garantizado'?'garantizado':'proyectado';
 const sinSeguro=invalidez?'La indemnización y la exención son beneficios distintos.': 'Este escenario contempla la exención, sin mostrar una indemnización por seguro de invalidez.';
 const sinExencion=exencion?'':'Sin una exención amparada, no se supone que dejes de aportar. ';
 return `${titulo}<p>${cliente}si ${momento}sufrieras una invalidez total y permanente cubierta:</p><div class="coberturas-invalidez${bloques.length>1?' doble':''}">${bloques.join('')}</div><p class="nota beneficios-distintos">${sinSeguro} ${sinExencion}</p><div class="continuidad-invalidez"><span class="icono">${icono('☀')}</span><div><h4>Si sobrevives al vencimiento</h4><p>El camino previsto continúa hacia tu ahorro final: <strong>${ahorro}</strong> <small>· valor ${tipo}</small>.</p></div></div><p class="nota condiciones-invalidez">La continuidad y el pago al vencimiento tras una invalidez están sujetos a las condiciones de tu contrato. Si falleces antes, incluso después de la invalidez, aplica el camino de pago a beneficiarios que se muestra abajo.</p>`;
}
module.exports={escenarioInvalidez};
