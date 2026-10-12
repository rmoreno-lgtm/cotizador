const $=id=>document.getElementById(id);
function aviso(texto){$('aviso').className='notice';$('aviso').textContent=texto;}
async function api(url,options={}) {
  const r=await fetch(url,options);
  if(r.status===401){location.assign('/login');throw new Error('Inicia sesión.');}
  const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo completar la solicitud.');return data;
}
function opciones(id,values,preferida) {
  $(id).replaceChildren(...values.map(v=>new Option(id==='deducible'?'$'+Number(v).toLocaleString('es-MX'):v,v)));
  if(values.includes(preferida))$(id).value=preferida;
}
function familiares() {
  const n=Number($('cantidad').value), previo=[...$('familiares').querySelectorAll('.familiar')].map(e=>({edad:e.querySelector('input').value,genero:e.querySelector('select').value}));
  $('familiares').replaceChildren();
  for(let i=0;i<n;i++) {
    const div=document.createElement('div');div.className='familiar';
    const titulo=document.createElement('h3');titulo.textContent='Familiar '+(i+1);div.append(titulo);
    const campos=document.createElement('div');campos.className='fields';
    const edad=document.createElement('input');edad.type='number';edad.min='0';edad.max='120';edad.step='1';edad.required=true;edad.value=previo[i]?.edad||'';
    const genero=document.createElement('select');genero.append(new Option('Masculino'),new Option('Femenino'));genero.value=previo[i]?.genero||'Masculino';
    for(const [texto,control] of [['Edad',edad],['Género',genero]]){const l=document.createElement('label');l.textContent=texto;l.append(control);campos.append(l);}
    div.append(campos);$('familiares').append(div);
  }
  $('solidez').textContent=n>=3?'Solidez Familiar: se solicitará automáticamente para '+(n+1)+' asegurados. El descuento se comprobará en GNP.':'Solidez Familiar: no aplica con menos de cuatro asegurados.';
}
function datos() {
  const f=new FormData($('cotizacion'));
  return {nombre:f.get('nombre'),edad:f.get('edad'),genero:f.get('genero'),cp:f.get('cp'),
    tabulador:f.get('tabulador'),deducible:f.get('deducible'),acceso:f.get('acceso'),alta:f.get('alta')==='true',
    familiares:[...$('familiares').querySelectorAll('.familiar')].map(e=>({edad:e.querySelector('input').value,genero:e.querySelector('select').value}))};
}
let paginaHistorial=1, paginasHistorial=1, versionHistorial=0;
const moneda=centavos=>Number.isSafeInteger(centavos)?(centavos/100).toLocaleString('es-MX',{style:'currency',currency:'MXN'}):null;
const fechaHistorial=valor=>valor?new Date(valor).toLocaleString('es-MX',{timeZone:'America/Monterrey'}):'—';
function parrafo(texto,clase) { const p=document.createElement('p');p.textContent=texto;if(clase)p.className=clase;return p; }
function detalleSolicitud(j,abierto) {
  const s=j.solicitud||{},r=j.resultado||{};
  const detalle=document.createElement('details');detalle.className='detalle';detalle.dataset.id=j.id;detalle.open=abierto;
  const summary=document.createElement('summary');summary.textContent='Ver detalle';detalle.append(summary);
  detalle.append(parrafo('Origen: '+(j.tipo==='pdf'?'PDF de GNP cargado':'Cotización en GNP')));
  detalle.append(parrafo('Titular: '+s.edad+' años · '+s.genero+' · CP '+s.cp));
  (s.familiares||[]).forEach((f,i)=>detalle.append(parrafo('Familiar '+(i+1)+': '+f.edad+' años · '+f.genero)));
  detalle.append(parrafo('Condiciones solicitadas: tabulador '+s.tabulador+' · deducible '+moneda(Number(s.deducible)*100)+' · acceso '+s.acceso));
  detalle.append(parrafo('Alta Tecnología: '+(s.alta?'solicitada':'no solicitada')+' · Solidez Familiar: '+(s.solidez?'solicitada':'no solicitada')));
  if(moneda(r.descuentoFamiliar)!==null)detalle.append(parrafo('Descuento familiar en GNP: '+moneda(r.descuentoFamiliar)+(r.descuentoIncluidoEnNeta?' (ya aplicado en la prima neta)':'')));
  detalle.append(parrafo('Creada: '+fechaHistorial(j.creadaEn)));
  if(j.terminadaEn)detalle.append(parrafo('Terminada: '+fechaHistorial(j.terminadaEn)));
  if(Array.isArray(r.niveles) && r.niveles.length) {
    const titulo=document.createElement('h4');titulo.textContent='Participación por nivel hospitalario';detalle.append(titulo);
    const tabla=document.createElement('table');tabla.className='tabla-historial';
    const cabecera=document.createElement('tr');
    for(const texto of ['Nivel','Deducible','Coaseguro','Tope']) {const th=document.createElement('th');th.textContent=texto;cabecera.append(th);}tabla.append(cabecera);
    for(const n of r.niveles){const fila=document.createElement('tr');for(const texto of [n.nivel,moneda(n.deducible),n.porcentaje+'%',moneda(n.tope)]){const td=document.createElement('td');td.textContent=texto;fila.append(td);}tabla.append(fila);}
    detalle.append(tabla);
  }
  return detalle;
}
async function refrescar() {
  const version=++versionHistorial;
  try {
    const query=new URLSearchParams({page:String(paginaHistorial),q:$('buscar').value,estado:$('estado').value});
    const resultado=await api('/api/jobs?'+query);
    if(version!==versionHistorial)return;
    if(paginaHistorial>resultado.pages){paginaHistorial=resultado.pages;return refrescar();}
    paginasHistorial=resultado.pages;
    const abiertos=new Set([...$('trabajos').querySelectorAll('details[open]')].map(d=>d.dataset.id));
    const elementos=[];
    for(const j of resultado.items) {
      const div=document.createElement('article');div.className='job';
      const h=document.createElement('h3');h.textContent=j.nombre;div.append(h);
      const estado=document.createElement('span');estado.className='estado estado-'+j.estado;
      estado.textContent=({pendiente:'En cola',procesando:'Procesando',completada:'Completada',error:'Requiere revisión'})[j.estado];div.append(estado);
      const n=1+(j.solicitud?.familiares?.length||0);
      div.append(parrafo(n+' asegurado'+(n===1?'':'s')+' · '+fechaHistorial(j.creadaEn),'hint'));
      if(j.resultado?.folio)div.append(parrafo('Folio GNP: '+j.resultado.folio));
      if(moneda(j.resultado?.totalAnual)!==null)div.append(parrafo('Prima anual: '+moneda(j.resultado.totalAnual),'prima-historial'));
      if(j.error)div.append(parrafo(j.error,'error'));
      for(const a of j.resultado?.advertencias||[])div.append(parrafo(a,'hint'));
      div.append(detalleSolicitud(j,abiertos.has(j.id)));
      const acciones=document.createElement('div');acciones.className='acciones';
      if(j.estado==='completada')for(const [tipo,texto] of [['propuesta','Propuesta QUILLUM'],['gnp','Cotización GNP']]){
        const a=document.createElement('a');a.href='/api/jobs/'+j.id+'/files/'+tipo;a.textContent=texto;acciones.append(a);
      }
      if(j.estado==='error'){
        const b=document.createElement('button');b.textContent='Reintentar';b.className='secondary';
        b.onclick=async()=>{if(!confirm('¿Reintentar esta solicitud? Si hubo un PDF previo, revísalo primero.'))return;b.disabled=true;try{await api('/api/jobs/'+j.id+'/retry',{method:'POST'});await refrescar();}catch(e){aviso(e.message);b.disabled=false;}};acciones.append(b);
        const a=document.createElement('a');a.href='/api/jobs/'+j.id+'/files/gnp';a.textContent='Revisar PDF de GNP, si se generó';acciones.append(a);
      }
      if(['completada','error'].includes(j.estado)) {
        const borrar=document.createElement('button');borrar.className='danger';borrar.textContent='Eliminar';
        borrar.onclick=async()=>{
          if(!confirm('¿Eliminar la solicitud de '+j.nombre+' y sus documentos de GNP y QUILLUM? Esta acción no se puede deshacer.'))return;
          borrar.disabled=true;
          try{await api('/api/jobs/'+j.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmar:true})});aviso('Solicitud y documentos eliminados.');await refrescar();}
          catch(e){aviso(e.message);borrar.disabled=false;}
        };
        acciones.append(borrar);
      }
      div.append(acciones);elementos.push(div);
    }
    if(!elementos.length)elementos.push(parrafo($('buscar').value||$('estado').value?'No hay solicitudes que coincidan con tu búsqueda.':'Tus próximas solicitudes aparecerán aquí.'));
    $('trabajos').replaceChildren(...elementos);
    $('historial-total').textContent=resultado.total+' solicitud'+(resultado.total===1?'':'es');
    $('pagina').textContent='Página '+paginaHistorial+' de '+paginasHistorial;
    $('anterior').disabled=paginaHistorial<=1;$('siguiente').disabled=paginaHistorial>=paginasHistorial;
  }catch(e){if(version===versionHistorial)aviso(e.message);}
}
let busquedaPendiente;
$('buscar').oninput=()=>{clearTimeout(busquedaPendiente);busquedaPendiente=setTimeout(()=>{paginaHistorial=1;refrescar();},250);};
$('estado').onchange=()=>{paginaHistorial=1;refrescar();};
$('anterior').onclick=()=>{if(paginaHistorial>1){paginaHistorial--;refrescar();}};
$('siguiente').onclick=()=>{if(paginaHistorial<paginasHistorial){paginaHistorial++;refrescar();}};
$('cantidad').onchange=familiares;
$('metodo').onchange=()=>{$('pdf-label').hidden=$('metodo').value!=='pdf';$('pdf').required=$('metodo').value==='pdf';};
$('logo-form').onsubmit=async e=>{e.preventDefault();const f=new FormData();f.append('logo',$('logo').files[0]);try{await api('/api/logo',{method:'POST',body:f});aviso('Logo guardado. Ya puedes generar propuestas.');await cargarConfig();}catch(e){aviso(e.message);}};
$('cotizacion').onsubmit=async e=>{
  e.preventDefault();const s=datos();
  const resumen=`${s.nombre}\nTitular: ${s.edad} años, ${s.genero}, CP ${s.cp}\nFamiliares: ${s.familiares.map(f=>f.edad+' años, '+f.genero).join('; ')||'ninguno'}\nTabulador ${s.tabulador}, deducible $${Number(s.deducible).toLocaleString('es-MX')}, acceso ${s.acceso}\nAlta Tecnología: ${s.alta?'sí':'no'}\nSolidez Familiar: ${s.familiares.length>=3?'solicitar':'no aplicar'}\n\n¿Confirmas la solicitud?`;
  if(!confirm(resumen))return;
  $('enviar').disabled=true;
  try{
    const options={method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()}};
    let endpoint='/api/jobs';
    if($('metodo').value==='pdf'){const f=new FormData();f.append('solicitud',JSON.stringify(s));f.append('pdf',$('pdf').files[0]);options.body=f;endpoint='/api/pdf';}
    else{options.headers['Content-Type']='application/json';options.body=JSON.stringify(s);}
    await api(endpoint,options);paginaHistorial=1;$('buscar').value='';$('estado').value='';aviso('Solicitud recibida. Puedes seguir su avance y descargar los documentos aquí.');await refrescar();
  }catch(e){aviso(e.message);}finally{$('enviar').disabled=false;}
};
async function cargarConfig(){const c=await api('/api/config');opciones('deducible',c.deducibles,'32000');opciones('tabulador',c.tabuladores,'D');opciones('acceso',c.accesos,'Amplio');$('config-text').textContent=(c.logo?'Logo cargado. ':'Falta cargar el logo. ')+(c.gnpConfigurado?'Credenciales de GNP configuradas; el acceso se comprobará al cotizar.':'Faltan las credenciales de GNP; puedes probar con un PDF existente.')+' '+c.nota;if(!c.logo)$('configuracion').open=true;}
(async()=>{try{await cargarConfig();familiares();await refrescar();setInterval(refrescar,5000);}catch(e){aviso(e.message);}})();
