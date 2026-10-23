const test=require('node:test'),assert=require('node:assert/strict');
const {recorrido,paginas}=require('../retiro/recorrido.cjs');
const {vista}=require('../retiro/vista.cjs');
function modelo(n=35){return {tablaValida:true,campos:{cliente:{valor:'Prueba'},edad:{valor:'25'},plazoPago:{valor:'10'},edadVencimiento:{valor:String(25+n)},aportacion:{valor:'$100'},inflacion:{valor:'3'},moneda:{valor:'MXN'},ahorro:{valor:'200000'}},tabla:Array.from({length:n},(_,i)=>({anio:i+1,edad:25+i,aportacion:i<10?10000:0,acumulado:Math.min(i+1,10)*10000,efectivo:i<11?99000:200000,proteccion:300000+i*10000})),coberturas:[],ahorroTipo:'proyectado'};}
test('Los hitos usan importes de la tabla: no confunden 99% con recuperación del total ni suponen un año fijo',()=>{
 const m=modelo(),r=recorrido(m);assert.equal(r.ultimaAportacion.anio,10);
 // Solo se compara después de terminar aportaciones: evitar un cruce artificial en el primer año de este ejemplo.
 for(const f of m.tabla.slice(0,10))f.efectivo=0;
 assert.equal(recorrido(m).equilibrio.anio,12);assert.equal(r.totalAportado,100000);
 const html=vista(m);assert.match(html,/Del año 11 al 35: <b>aportación \$0/);assert.match(html,/Última aportación/);assert.match(html,/99%/);assert.equal((html.match(/<table /g)||[]).length,1);
 m.tablaValida=false;assert.equal(recorrido(m).equilibrio,undefined);assert.doesNotMatch(vista(m),/<polyline/);
});
test('Planes extensos continúan verticalmente sin perder filas ni comprimirlas en dos bloques',()=>{
 const m=modelo(60);const html=vista(m);assert.equal(paginas(m),4);assert.equal((html.match(/data-anio=/g)||[]).length,60);assert.equal((html.match(/<table /g)||[]).length,2);assert.doesNotMatch(html,/tablas-anuales/);assert.match(html,/4\/4/);
});
