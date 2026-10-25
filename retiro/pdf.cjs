const {vista}=require('./vista.cjs');
const {renderizarPdf}=require('../documento-pdf.cjs');
function camposFaltantes(modelo){return ['cliente','edad','inflacion','plazoPago','moneda','edadVencimiento','ahorro'].filter(k=>!modelo.campos[k]);}
async function generarPdf(modelo,enfoque,logos,anio,env,opciones={}){
 if(!modelo.tablaValida || camposFaltantes(modelo).length)throw Error('Revisa los datos pendientes de la ilustración antes de descargar la propuesta.');
 if(!logos.quillum||!logos.gnp)throw Error('Guarda los logos de QUILLUM y GNP antes de descargar la propuesta.');
 return renderizarPdf(vista(modelo,enfoque,logos,anio,opciones),env);
}
module.exports={generarPdf,camposFaltantes};
