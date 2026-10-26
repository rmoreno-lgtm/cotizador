const {validarTitulo,validarFrase}=require('../retiro/titulos.cjs');
const ENFOQUES={retiro:['Tu retiro, con un plan claro.','Aporta hoy, aprovecha el posible ahorro fiscal y prepara tu retiro.'],independencia:['Construye tu independencia.','Una estrategia para tu futuro y para el ISR de tus años de aportación.'],familia:['Tu futuro también cuida de los tuyos.','Planea tu retiro y conoce la protección de tu plan.'],patrimonio:['Dale un propósito a tu patrimonio.','Conoce cuánto aportas, el posible ahorro fiscal y tu ahorro proyectado.']};
function textos(modelo,enfoque='retiro'){
 if(!Object.hasOwn(ENFOQUES,enfoque))throw Error('Enfoque inválido.');
 const nombre=String(modelo.campos?.cliente?.valor||'Tu plan').split(/\s+/)[0];
 const [titulo,subtitulo]=ENFOQUES[enfoque];return {enfoque,titulo:nombre+', '+titulo[0].toLowerCase()+titulo.slice(1),subtitulo};
}
function validar(modelo,datos){const base=textos(modelo,datos.enfoque);return {...base,titulo:validarTitulo(datos.titulo??'')||base.titulo,subtitulo:validarFrase(datos.subtitulo??'')||base.subtitulo};}
module.exports={textos,validar};
