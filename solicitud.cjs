const { validarSolicitud } = require('./leer-gnp.cjs');
function solicitud(body) {
  if(!body || typeof body!=='object' || Array.isArray(body)) throw new Error('Solicitud inválida.');
  const normal = v=>String(v??'').trim();
  const genero = v=>({masculino:'Masculino',femenino:'Femenino'})[normal(v).toLowerCase()] || normal(v);
  const booleano=(v,campo)=>{
    if(typeof v!=='boolean') throw new Error(`El campo ${campo} debe ser sí o no.`);
    return v;
  };
  if(!Array.isArray(body.familiares)) throw new Error('Falta la lista de familiares.');
  const s={
    nombre:normal(body.nombre),edad:normal(body.edad),genero:genero(body.genero),cp:normal(body.cp),
    familiares:body.familiares.map(f=>({edad:normal(f?.edad),genero:genero(f?.genero)})),
    tabulador:normal(body.tabulador).toUpperCase(),deducible:normal(body.deducible),
    acceso:normal(body.acceso).toLowerCase()==='amplio'?'Amplio':normal(body.acceso).toLowerCase()==='esencial'?'Esencial':normal(body.acceso),
    alta:booleano(body.alta,'Alta Tecnología'),solidez:body.familiares.length+1>=4
  };
  // No aceptar un estado de verificación del portal enviado por un cliente HTTP.
  return validarSolicitud(s);
}
module.exports={solicitud};
