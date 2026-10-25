const dinero=n=>'$'+(Number(n)/100).toLocaleString('en-US',{maximumFractionDigits:2});
function recorrido(modelo){
 const filas=modelo.tablaValida?modelo.tabla:[];
 const ultimaAportacion=filas.findLast(f=>f.aportacion>0);
 const equilibrio=filas.find(f=>f.acumulado>0&&f.efectivo>=f.acumulado);
 return {filas,ultimaAportacion,equilibrio,final:filas.at(-1),totalAportado:filas.at(-1)?.acumulado};
}
function formatoValido(formato){return typeof formato==='string'&&['resumida','detallada'].includes(formato);}
function paginas(modelo,formato='detallada'){if(!formatoValido(formato))throw Error('Presentación inválida.');return formato==='resumida'?2:2+Math.max(1,Math.ceil((modelo.tablaValida?modelo.tabla.length:0)/35));}
module.exports={recorrido,paginas,dinero,formatoValido};
