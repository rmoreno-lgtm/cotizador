function grafica(filas){
 if(!filas.length)return '';
 const max=Math.max(...filas.flatMap(f=>[f.acumulado,f.efectivo]));if(max<=0)return '';
 const x=n=>42+n/filas.length*560,y=n=>168-n/max*135;
 const puntos=k=>[[0,0],...filas.map(f=>[f.anio,f[k]])].map(([a,v])=>x(a).toFixed(1)+','+y(v).toFixed(1)).join(' ');
 return `<svg viewBox="0 0 650 205" role="img" aria-label="Aportaciones acumuladas y valor en efectivo proyectado según tabla GNP"><path d="M42 20V168H615" fill="none" stroke="#496079"/><polyline points="${puntos('acumulado')}" fill="none" stroke="#f36a0b" stroke-width="3" stroke-dasharray="8 5"/><polyline points="${puntos('efectivo')}" fill="none" stroke="#082e53" stroke-width="3"/><text x="42" y="188" font-size="12" fill="#082e53">Inicio</text><text x="550" y="188" font-size="12" fill="#082e53">Año ${filas.length}</text><path d="M45 8H75" stroke="#f36a0b" stroke-width="3" stroke-dasharray="7 4"/><text x="82" y="12" font-size="12" fill="#496079">Aportaciones acumuladas</text><path d="M320 8H350" stroke="#082e53" stroke-width="3"/><text x="358" y="12" font-size="12" fill="#496079">Valor en efectivo proyectado</text></svg>`;
}
module.exports={grafica};
