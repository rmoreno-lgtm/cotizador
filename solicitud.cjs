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
  if(body.modalidad==='comparativo') {
    if(!Array.isArray(body.opciones) || body.opciones.length<2 || body.opciones.length>3) throw new Error('Elige dos o tres opciones para comparar.');
    s.modalidad='comparativo';
    s.opciones=body.opciones.map(o=>({deducible:normal(o?.deducible),tabulador:normal(o?.tabulador).toUpperCase()}));
    const deducibles=['21000','32000','45000','56000','68000','87000','111000','128000','175000','233000'];
    if(s.opciones.some(o=>!deducibles.includes(o.deducible)||!['A','B','C','D'].includes(o.tabulador))) throw new Error('Revisa los deducibles y tabuladores del comparativo.');
    if(new Set(s.opciones.map(o=>o.deducible+':'+o.tabulador)).size!==s.opciones.length) throw new Error('Las opciones del comparativo deben ser distintas.');
    Object.assign(s,s.opciones[0]);
  } else if(body.modalidad && body.modalidad!=='individual') throw new Error('Modalidad inválida.');
  // No aceptar un estado de verificación del portal enviado por un cliente HTTP.
  return validarSolicitud(s);
}
module.exports={solicitud};
