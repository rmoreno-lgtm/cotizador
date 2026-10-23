const {dinero}=require('./recorrido.cjs');
function grafica(filas){
 if(!filas.length)return '';
 const max=Math.max(...filas.flatMap(f=>[f.acumulado,f.efectivo]));if(max<=0)return '';
 const final=filas.at(-1),pago=filas.findLast(f=>f.aportacion>0);
 const x=n=>64+n/final.anio*612,y=n=>141-n/max*91;
 const puntos=k=>[[0,0],...filas.map(f=>[f.anio,f[k]])].map(([a,v])=>x(a).toFixed(1)+','+y(v).toFixed(1)).join(' ');
 const xp=pago?x(pago.anio):null;
 const etiquetaPago=xp===null?null:Math.max(140,Math.min(540,xp));
 return `<svg viewBox="0 0 700 180" role="img" aria-label="Aportaciones acumuladas y valor en efectivo proyectado a lo largo de tu plan"><path d="M18 14H44" stroke="#f36a0b" stroke-width="3" stroke-dasharray="6 4"/><text x="52" y="18" font-size="13" fill="#496079">Total aportado: ${dinero(final.acumulado)}</text><path d="M370 14H396" stroke="#082e53" stroke-width="3"/><text x="404" y="18" font-size="13" fill="#496079">Valor en efectivo proyectado</text>
 <text x="676" y="39" text-anchor="end" font-size="15" font-weight="bold" fill="#082e53">${dinero(final.efectivo)} al vencimiento</text>
 <path d="M64 48V141H680" fill="none" stroke="#a7b9c9"/><text x="53" y="145" text-anchor="end" font-size="12" fill="#496079">$0</text>
 <polyline points="${puntos('acumulado')}" fill="none" stroke="#f36a0b" stroke-width="3" stroke-dasharray="7 4"/><polyline points="${puntos('efectivo')}" fill="none" stroke="#082e53" stroke-width="3"/>
 <circle cx="676" cy="${y(final.efectivo).toFixed(1)}" r="4" fill="#082e53"/>
 ${pago&&pago.anio<final.anio?`<path d="M${xp.toFixed(1)} 48V147H${etiquetaPago.toFixed(1)}" stroke="#ec6a0b" stroke-dasharray="3 4"/><circle cx="${xp.toFixed(1)}" cy="${y(pago.acumulado).toFixed(1)}" r="4" fill="#ec6a0b"/><text x="${etiquetaPago.toFixed(1)}" y="162" text-anchor="middle" font-size="12" font-weight="bold" fill="#bc4d04">Año ${pago.anio}</text><text x="${etiquetaPago.toFixed(1)}" y="176" text-anchor="middle" font-size="11" fill="#496079">Última aportación</text>`:''}
 <text x="64" y="162" font-size="12" fill="#496079">Inicio</text><text x="676" y="162" text-anchor="end" font-size="12" fill="#496079">Año ${final.anio}</text><text x="676" y="176" text-anchor="end" font-size="11" fill="#496079">Vencimiento</text></svg>`;
}
module.exports={grafica};
