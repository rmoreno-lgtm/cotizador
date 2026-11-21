const {icono}=require('./iconos.cjs');
const {recorrido,dinero}=require('./recorrido.cjs');
const h=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function aportacionesPendientes(filas,ejemplo){
 if(!ejemplo || !filas.length)return '<p>Dejas de pagar las aportaciones amparadas por la exención. El calendario pendiente queda por verificar.</p>';
 const pendientes=filas.filter(f=>f.anio>ejemplo.anio && f.aportacion>0);
 if(!pendientes.length)return '<p>Después del año elegido no quedan aportaciones programadas.</p>';
 const primero=pendientes[0].anio,ultimo=pendientes.at(-1).anio;
 const periodo=pendientes.length===1?'año '+primero
  :ultimo-primero+1===pendientes.length?'años '+primero+' al '+ultimo
  :'años '+pendientes.map(f=>f.anio).join(', ');
 const cantidad=pendientes.length===1?'1 aportación':pendientes.length+' aportaciones';
 const total=pendientes.reduce((suma,f)=>suma+f.aportacion,0);
 return `<p>Con la anualidad del año ${ejemplo.anio} ya pagada, dejas de hacer <b>${cantidad}</b> (${periodo}) si la exención las cubre.</p><strong class="suma-invalidez">${dinero(total)}</strong><p>Total programado de esas aportaciones.</p>`;
}

function escenarioInvalidez(modelo,ejemplo){
 const exencion=modelo.coberturas?.find(c=>c.tipo==='exencion');
 const invalidez=modelo.coberturas?.find(c=>c.tipo==='invalidez');
 const vida=modelo.coberturas?.some(c=>c.tipo==='fallecimiento');
 const titulo='<h3 class="titulo-invalidez"><span>'+icono('♿')+'</span>2 · Tu protección ante una invalidez</h3>';
 if(!exencion&&!invalidez)return titulo+'<p>Los beneficios por invalidez están pendientes de confirmar conforme a las coberturas de tu contrato.</p>';
 const cliente=modelo.campos?.cliente?h(modelo.campos.cliente.valor)+', ':'';
 const momento=ejemplo?'en el año '+ejemplo.anio+', a tus '+ejemplo.edad+' años, ':'durante la vigencia de tu plan ';
 const {filas,final}=recorrido(modelo);
 const pasos=[];
 if(exencion)pasos.push(`<li><h4>Dejas de aportar</h4><small>Exención de primas</small>${aportacionesPendientes(filas,ejemplo)}</li>`);
 if(invalidez){
  const anual=modelo.tablaValida&&ejemplo?invalidez.sumasPorAnio?.find(f=>f.anio===ejemplo.anio):undefined;
  const indemnizacion=anual?`<p>Indemnización prevista para el año ${ejemplo.anio}:</p><strong class="suma-invalidez">${dinero(anual.suma)}</strong><p>Suma ilustrada según tu cobertura.</p>`
   :`<p>Suma inicial ilustrada: <b>${dinero(invalidez.suma)}</b>. La suma vigente para el ${ejemplo?'año '+ejemplo.anio:'momento de una invalidez'} queda por verificar.</p>`;
  pasos.push(`<li><h4>Invalidez Sin Espera</h4>${indemnizacion}</li>`);
 }
 const ahorro=final&&modelo.campos.ahorro?dinero(modelo.campos.ahorro.valor):'Importe por confirmar';
 const tipo=modelo.ahorroTipo==='garantizado'?'garantizado':'proyectado';
 const edad=modelo.campos.edadVencimiento?' a los '+h(modelo.campos.edadVencimiento.valor)+' años':'';
 const continuidad=vida?'Tu plan continúa y conservas el seguro de vida conforme a tu póliza.':'La continuidad de tu plan depende de las condiciones de tu póliza.';
 pasos.push(`<li><h4>Tu plan continúa</h4><p>${continuidad}</p><p>Si llegas al vencimiento${edad}, recibes tu ahorro:</p><strong class="suma-invalidez">${ahorro}</strong><small>Valor ${tipo}</small></li>`);
 const alcance=exencion
  ? (invalidez?'':'Tu escenario ilustra la exención de primas. ')
  : 'La continuidad de tus aportaciones sigue el calendario de la póliza. ';
 return `${titulo}<p>${cliente}si ${momento}sufrieras una invalidez total y permanente cubierta:</p><ol class="linea-invalidez">${pasos.join('')}</ol><p class="nota condiciones-invalidez">${alcance}Los beneficios dependen del dictamen, la vigencia y las condiciones de tu póliza.</p>`;
}
module.exports={escenarioInvalidez};
