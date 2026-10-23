const {ENFOQUES}=require('./modelo.cjs');
function sugerido(modelo,enfoque){
 const e=ENFOQUES[enfoque];if(!Object.hasOwn(ENFOQUES,enfoque))throw Error('Enfoque inválido.');
 const nombre=String(modelo.campos?.cliente?.valor||'').trim().split(/\s+/)[0];
 return nombre&&nombre.length<=40?nombre+', '+e.titulo:e.titulo[0].toUpperCase()+e.titulo.slice(1);
}
function sugerencias(modelo){return Object.fromEntries(Object.keys(ENFOQUES).map(k=>[k,sugerido(modelo,k)]));}
function validarTitulo(valor){
 if(typeof valor!=='string'||valor.length>140||/[\u0000-\u0008\u000e-\u001f\u007f]/.test(valor))throw Error('El título admite hasta 140 caracteres de texto.');
 return valor.replace(/\s+/g,' ').trim();
}
function validarFrase(valor){
 if(typeof valor!=='string'||valor.length>160||/[\u0000-\u0008\u000e-\u001f\u007f]/.test(valor))throw Error('La frase de cierre admite hasta 160 caracteres de texto.');
 return valor.replace(/\s+/g,' ').trim();
}
module.exports={sugerido,sugerencias,validarTitulo,validarFrase};
