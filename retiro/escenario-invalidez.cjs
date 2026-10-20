const {icono}=require('./iconos.cjs');
const dinero=n=>'$'+(n/100).toLocaleString('en-US',{maximumFractionDigits:2});
function escenarioInvalidez(modelo,ejemplo){
 const exencion=modelo.coberturas?.find(c=>c.tipo==='exencion');
 const invalidez=modelo.coberturas?.find(c=>c.tipo==='invalidez');
 if(!exencion && !invalidez)return '<h3>2 · Invalidez: revisión de coberturas</h3><p>No se identificó una cobertura de invalidez verificable. Revisar la póliza antes de representar primas exentas o una indemnización.</p>';
 const momento=ejemplo?'año '+ejemplo.anio+' · '+ejemplo.edad+' años según la tabla':'año por verificar';
 const bloques=[];
 if(exencion)bloques.push(`<div class="cobertura-invalidez"><span class="icono">${icono('✓')}</span><h4>Exención de primas</h4><p>Amparada por invalidez total y permanente. Libera del pago de las primas que ampare el contrato; no es una indemnización en efectivo.</p></div>`);
 if(invalidez)bloques.push(`<div class="cobertura-invalidez"><span class="icono">${icono('◇')}</span><h4>Invalidez Sin Espera</h4><p>Suma inicial contratada: <b>${dinero(invalidez.suma)}</b>.</p><p>La suma vigente para el ${ejemplo?'año '+ejemplo.anio:'año del ejemplo'} queda por verificar: esta ilustración no identifica una tabla anual de invalidez.</p></div>`);
 return `<h3>2 · Si ocurre invalidez cubierta</h3><p>Ejemplo: ${momento}. Sujeto a dictamen y condiciones contractuales.</p><div class="coberturas-invalidez${bloques.length>1?' doble':''}">${bloques.join('')}</div><p class="nota">${invalidez?'La indemnización por invalidez y la exención de primas son beneficios distintos. No se usa la protección por fallecimiento como suma anual de invalidez.':'La exención no es una indemnización en efectivo. No se asigna la protección por fallecimiento a invalidez.'} La aplicación de cada cobertura requiere verificar la póliza.</p>`;
}
module.exports={escenarioInvalidez};
