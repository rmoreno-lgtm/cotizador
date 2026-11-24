// Reglas de vigilancia de trámites: validación, filtros, comparación y textos de aviso.
// Todo es puro (sin red ni disco) para poder probarlo sin GNP.

const SECCIONES={
  gmm:{
    nombre:'Gastos Médicos · Servicios asistidos',
    estatus:['En Registro','En Proceso','Activada','Reprocesada','Rechazada','Cancelada','Terminada']
  },
  vida:{
    nombre:'Vida individual · Servicios asistidos',
    estatus:['EN REGISTRO','EN PROCESO','ACTIVADA','RECHAZADA','CANCELADA','TERMINADA','CANCELADA SIN ENVÍO','CANCELADA POR ACTIVACIÓN']
  }
};
const ABIERTOS={
  gmm:['En Registro','En Proceso','Activada','Reprocesada'],
  vida:['EN REGISTRO','EN PROCESO','ACTIVADA']
};
const DIAS=[1,2,3,4,5,6,7]; // ISO: 1 = lunes … 7 = domingo
const MINIMO_MINUTOS=30;
const MAXIMO_MINUTOS=24*60;

class ReglaInvalida extends Error {}

const normalizar=texto=>String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const esAbierto=(seccion,estatus)=>ABIERTOS[seccion].some(e=>normalizar(e)===normalizar(estatus));

function texto(valor,campo,max,{requerido=false}={}) {
  const limpio=String(valor ?? '').replace(/\s+/g,' ').trim();
  if(requerido && !limpio)throw new ReglaInvalida('Falta '+campo+'.');
  if(limpio.length>max)throw new ReglaInvalida(campo[0].toUpperCase()+campo.slice(1)+' admite hasta '+max+' caracteres.');
  return limpio;
}
function hora(valor,campo) {
  const limpio=String(valor ?? '').trim();
  const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(limpio);
  if(!m)throw new ReglaInvalida('La hora '+campo+' debe tener formato HH:MM.');
  return limpio;
}
function lista(valor) {
  if(Array.isArray(valor))return valor;
  return String(valor ?? '').split(/[\s,;]+/).filter(Boolean);
}

// Valida lo que llega del formulario y devuelve una regla limpia (sin id ni estado).
function validarRegla(entrada={}) {
  const seccion=String(entrada.seccion || '');
  if(!SECCIONES[seccion])throw new ReglaInvalida('Elige la sección de GNP a vigilar.');
  const nombre=texto(entrada.nombre,'el nombre',80,{requerido:true});
  const permitidos=SECCIONES[seccion].estatus;
  const estatus=[...new Set(lista(entrada.estatus).map(e=>permitidos.find(p=>normalizar(p)===normalizar(e))))];
  if(estatus.includes(undefined))throw new ReglaInvalida('Hay un estatus que no existe en esa sección.');
  if(!estatus.length)throw new ReglaInvalida('Selecciona al menos un estatus.');
  let fechaDesde='';
  if(entrada.fechaDesde){
    fechaDesde=String(entrada.fechaDesde);
    const fecha=new Date(fechaDesde+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0,10)!==fechaDesde)
      throw new ReglaInvalida('La fecha “desde” no es válida.');
  }
  const cadaMinutos=Number(entrada.cadaMinutos);
  if(!Number.isInteger(cadaMinutos) || cadaMinutos<MINIMO_MINUTOS || cadaMinutos>MAXIMO_MINUTOS)
    throw new ReglaInvalida('La frecuencia debe ser entre '+MINIMO_MINUTOS+' minutos y 24 horas.');
  const h=entrada.horario || {};
  const dias=[...new Set(lista(h.dias).map(Number))].sort();
  if(!dias.length || dias.some(d=>!DIAS.includes(d)))throw new ReglaInvalida('Selecciona los días en que se revisa.');
  const desde=hora(h.desde ?? '08:00','de inicio');
  const hasta=hora(h.hasta ?? '20:00','de término');
  if(desde>=hasta)throw new ReglaInvalida('La hora de inicio debe ser anterior a la de término.');
  const correos=[...new Set(lista(entrada.correos).map(c=>c.toLowerCase()))];
  if(correos.length>10)throw new ReglaInvalida('Máximo 10 correos por regla.');
  for(const c of correos)if(!/^[^\s@<>()",;]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,}$/.test(c))throw new ReglaInvalida('Correo no válido: '+c);
  const whatsapp=[...new Set(lista(entrada.whatsapp).map(n=>n.replace(/[^\d]/g,'')))].filter(Boolean);
  if(whatsapp.length>5)throw new ReglaInvalida('Máximo 5 números de WhatsApp por regla.');
  for(const n of whatsapp)if(!/^\d{10,15}$/.test(n))throw new ReglaInvalida('WhatsApp no válido: '+n+' (usa lada de país, p. ej. 5218112345678).');
  const claveAgente=texto(entrada.claveAgente,'la clave de agente',10);
  if(claveAgente && !/^\d{10}$/.test(claveAgente))throw new ReglaInvalida('La clave de agente tiene 10 dígitos.');
  const ots=[...new Set(lista(entrada.ots).map(o=>o.toUpperCase()))];
  if(ots.length>20)throw new ReglaInvalida('Máximo 20 OT por regla.');
  for(const o of ots)if(!/^[0-9A-Z]{8,14}$/.test(o))throw new ReglaInvalida('OT no válida: '+o);
  const a=entrada.avisar || {};
  const avisar={
    nuevos:a.nuevos!==false,
    estatus:a.estatus!==false,
    observaciones:a.observaciones!==false,
    compromiso:a.compromiso!==false,
    salidas:a.salidas!==false
  };
  return {
    nombre,seccion,estatus,fechaDesde,cadaMinutos,
    horario:{dias,desde,hasta},
    correos,whatsapp,claveAgente,ots,avisar,
    leerObservaciones:entrada.leerObservaciones!==false,
    activa:entrada.activa!==false
  };
}

// Partes de la fecha en la zona horaria del despacho.
function partesLocales(fecha,zona) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zona,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(fecha).map(x=>[x.type,x.value]));
  const dia={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[p.weekday];
  return {dia,hora:p.hour+':'+p.minute,fecha:p.year+'-'+p.month+'-'+p.day};
}
function enHorario(regla,fecha,zona) {
  const {dia,hora}=partesLocales(fecha,zona);
  return regla.horario.dias.includes(dia) && hora>=regla.horario.desde && hora<regla.horario.hasta;
}

// Aplica los filtros de la regla a los trámites leídos de su sección.
function filtrar(regla,tramites) {
  const estatus=new Set(regla.estatus.map(normalizar));
  const ots=new Set(regla.ots || []);
  return tramites.filter(t=>(!ots.size || ots.has(String(t.ot).toUpperCase())) && estatus.has(normalizar(t.estatus)) &&
    (!regla.fechaDesde || !t.fechaRegistro || t.fechaRegistro>=regla.fechaDesde) &&
    (!regla.claveAgente || !t.agente || t.agente===regla.claveAgente));
}

const ultimaObservacionGnp=t=>(t.observaciones || []).filter(o=>/empleado gnp|^observaciones portal$/i.test(o.autor)).sort((a,b)=>a.fecha<b.fecha?1:-1)[0] || null;

// Resume solo lo que se compara, para guardar el estado entre corridas.
function instantanea(t) {
  const obs=ultimaObservacionGnp(t);
  return {
    ot:t.ot,estatus:t.estatus,contratante:t.contratante || '',tipo:t.tipo || '',poliza:t.poliza || '',
    agente:t.agente || '',fechaRegistro:t.fechaRegistro || '',fechaCompromiso:t.fechaCompromiso || '',
    ultimoIngreso:t.ultimoIngreso || '',tipoMovimiento:t.tipoMovimiento || '',
    observacionGnp:obs?{fecha:obs.fecha,texto:obs.texto.slice(0,1200)}:null,
    observacionesLeidas:Array.isArray(t.observaciones)
  };
}

// Cuenta los trámites de la vista por estatus, en el orden de la sección.
function conteo(seccion,vista) {
  const cuenta={};
  for(const t of Object.values(vista))cuenta[t.estatus]=(cuenta[t.estatus] || 0)+1;
  const orden=SECCIONES[seccion].estatus.map(normalizar);
  return Object.entries(cuenta).sort((a,b)=>orden.indexOf(normalizar(a[0]))-orden.indexOf(normalizar(b[0]))).map(([estatus,total])=>({estatus,total}));
}
const textoConteo=c=>c.length?c.map(x=>x.estatus+': '+x.total).join(' · '):'sin trámites';

// Devuelve los cambios entre la corrida anterior y la actual, ya filtradas por la regla.
function comparar(regla,anterior,actual) {
  const cambios=[];
  const previos=anterior || {};
  for(const t of Object.values(actual)) {
    const antes=previos[t.ot];
    if(!antes){
      if(regla.avisar.nuevos)cambios.push({tipo:'nuevo',tramite:t});
      continue;
    }
    if(regla.avisar.estatus && normalizar(antes.estatus)!==normalizar(t.estatus))
      cambios.push({tipo:'estatus',tramite:t,antes:antes.estatus});
    if(regla.avisar.compromiso && (antes.fechaCompromiso || '-')!==(t.fechaCompromiso || '-') && t.fechaCompromiso && t.fechaCompromiso!=='-')
      cambios.push({tipo:'compromiso',tramite:t,antes:antes.fechaCompromiso});
    // Solo se compara la observación si ambas corridas la leyeron, para no avisar por un detalle no consultado.
    if(regla.avisar.observaciones && t.observacionesLeidas && antes.observacionesLeidas && t.observacionGnp &&
      (!antes.observacionGnp || antes.observacionGnp.fecha!==t.observacionGnp.fecha || antes.observacionGnp.texto!==t.observacionGnp.texto))
      cambios.push({tipo:'observacion',tramite:t});
  }
  if(regla.avisar.salidas){
    for(const antes of Object.values(previos))
      if(!actual[antes.ot])cambios.push({tipo:'salida',tramite:antes});
  }
  return cambios;
}

function etiqueta(t){return t.ot+' · '+(t.contratante || 'sin contratante')+(t.tipo?' · '+t.tipo:'');}
function recortar(txt,max){txt=String(txt).replace(/\s+/g,' ').trim();return txt.length>max?txt.slice(0,max-1)+'…':txt;}

function describirCambio(c) {
  const t=c.tramite;
  switch(c.tipo){
    case 'nuevo':return 'Nuevo: '+etiqueta(t)+' · '+t.estatus;
    case 'estatus':return 'Cambio de estatus: '+etiqueta(t)+' · '+c.antes+' → '+t.estatus;
    case 'compromiso':return 'Fecha compromiso: '+etiqueta(t)+' · '+(c.antes && c.antes!=='-'?c.antes:'sin fecha')+' → '+t.fechaCompromiso;
    case 'observacion':return 'Observación de GNP: '+etiqueta(t)+' ('+t.observacionGnp.fecha+'): '+recortar(t.observacionGnp.texto,400);
    case 'salida':return 'Ya no está en la vista: '+etiqueta(t)+' (último estatus: '+t.estatus+'; pudo cambiar a un estatus que no vigilas o terminarse)';
    default:return etiqueta(t);
  }
}

// Arma el aviso de una corrida. inicial=true en la primera corrida de la regla.
function armarAviso(regla,{cambios,vista,inicial,fecha,zona}) {
  const cuando=new Intl.DateTimeFormat('es-MX',{timeZone:zona,dateStyle:'medium',timeStyle:'short'}).format(fecha);
  const lista=Object.values(vista);
  const seccion=SECCIONES[regla.seccion].nombre;
  const asunto=inicial
    ? 'GNP · '+regla.nombre+': vigilancia iniciada ('+lista.length+' trámites)'
    : 'GNP · '+regla.nombre+': '+cambios.length+(cambios.length===1?' cambio':' cambios');
  const lineas=inicial
    ? lista.slice(0,30).map(t=>etiqueta(t)+' · '+t.estatus+(t.observacionGnp?' · GNP: '+recortar(t.observacionGnp.texto,160):''))
    : cambios.map(describirCambio);
  if(inicial && lista.length>30)lineas.push('… y '+(lista.length-30)+' más.');
  if(inicial && !lista.length)lineas.push('Por ahora no hay trámites que cumplan la regla. Te avisaremos cuando aparezcan.');
  const encabezado=seccion+' · '+cuando+' · '+lista.length+' trámites en la vista ('+textoConteo(conteo(regla.seccion,vista))+')';
  const textoPlano=[asunto,encabezado,'',...lineas.map(l=>'• '+l)].join('\n');
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const html='<div style="font-family:Arial,sans-serif;color:#1f2a44"><h2 style="margin:0 0 4px">'+esc(asunto)+'</h2>'+
    '<p style="color:#5b6478;margin:0 0 12px">'+esc(encabezado)+'</p><ul>'+lineas.map(l=>'<li style="margin:0 0 6px">'+esc(l)+'</li>').join('')+'</ul>'+
    '<p style="color:#8a90a0;font-size:12px">Aviso automático de la plataforma QUILLUM. Solo lectura: no se modificó nada en GNP.</p></div>';
  // WhatsApp: los parámetros de plantilla no admiten saltos de línea ni más de 1024 caracteres.
  const whatsapp=recortar(regla.nombre+': '+(inicial?'vigilancia iniciada, '+lista.length+' trámites.':lineas.join(' | ')),1000);
  return {asunto,texto:textoPlano,html,whatsapp};
}

module.exports={conteo,textoConteo,SECCIONES,ABIERTOS,MINIMO_MINUTOS,ReglaInvalida,validarRegla,enHorario,partesLocales,filtrar,instantanea,comparar,armarAviso,describirCambio,esAbierto,normalizar,ultimaObservacionGnp};
