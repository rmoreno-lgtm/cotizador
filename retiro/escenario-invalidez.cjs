const {icono}=require('./iconos.cjs');
const dinero=n=>'$'+(n/100).toLocaleString('en-US',{maximumFractionDigits:2});
const h=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function escenarioInvalidez(modelo,ejemplo){
 const exencion=modelo.coberturas?.find(c=>c.tipo==='exencion');
 const invalidez=modelo.coberturas?.find(c=>c.tipo==='invalidez');
 if(!exencion && !invalidez)return '<h3>2 · Tu protección ante una invalidez</h3><p>Los beneficios por invalidez están pendientes de confirmar conforme a las coberturas de tu contrato.</p>';
 const cliente=modelo.campos?.cliente?h(modelo.campos.cliente.valor)+', ':'';
 const momento=ejemplo?'en el año '+ejemplo.anio+', a tus '+ejemplo.edad+' años, ':'durante la vigencia de tu plan ';
 const bloques=[];
 const pagoFinal=modelo.tablaValida?modelo.tabla.findLast(f=>f.aportacion>0):null;
 const sinPendientes=ejemplo&&pagoFinal&&ejemplo.anio>pagoFinal.anio;
 if(exencion)bloques.push(`<div class="cobertura-invalidez"><span class="icono">${icono('✓')}</span><h4>Exención de primas</h4><p>${sinPendientes?'Para ese momento ya habrías terminado tus aportaciones. No quedarían nuevas aportaciones programadas por exentar.':'La exención te libera del pago de las primas amparadas cuando se cumplen las condiciones de invalidez total y permanente. No es una indemnización en efectivo.'}</p></div>`);
 if(invalidez)bloques.push(`<div class="cobertura-invalidez"><span class="icono">${icono('◇')}</span><h4>Invalidez Sin Espera</h4><p>Tu suma asegurada inicial: <b>${dinero(invalidez.suma)}</b>.</p><p>La suma vigente para el ${ejemplo?'año '+ejemplo.anio:'momento de una invalidez'} queda por verificar conforme a las condiciones de tu cobertura.</p></div>`);
 return `<h3>2 · Tu protección ante una invalidez</h3><p>${cliente}si ${momento}sufrieras una invalidez total y permanente cubierta:</p><div class="coberturas-invalidez${bloques.length>1?' doble':''}">${bloques.join('')}</div><p class="nota">${invalidez?'La indemnización por invalidez es un pago en efectivo; la exención cubre las primas amparadas. Son beneficios distintos.':'La exención de primas no es una indemnización en efectivo.'} Cada cobertura se aplica conforme al dictamen y a las condiciones de tu contrato.</p>`;
}
module.exports={escenarioInvalidez};
