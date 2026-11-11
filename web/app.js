const $=id=>document.getElementById(id);
function aviso(texto){$('aviso').className='notice';$('aviso').textContent=texto;}
async function api(url,options={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    let r;try{r=await fetch(url,{...options,signal:controller.signal});}catch(e){throw new Error(options.method==='POST'?'No se confirmó la respuesta del servidor. Revisa «Mis solicitudes» antes de reintentar.':'No se pudo conectar con el servidor. Comprueba tu conexión e intenta de nuevo.');}
    if(r.status===401){location.assign('/login');throw new Error('Inicia sesión.');}
    let data;try{data=await r.json();}catch{throw new Error('El servidor no devolvió una respuesta válida. Revisa «Mis solicitudes» antes de reintentar.');}
    if(!r.ok)throw new Error(data.error||'No se pudo completar la solicitud.');return data;
  }finally{clearTimeout(timer);}
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
let configComparativo;
function opcionesComparativo() {
  if(!configComparativo)return;
  const prev=[...$('opciones-comparativo').children].map(e=>[...e.querySelectorAll('select')].map(s=>s.value));
  $('opciones-comparativo').replaceChildren();
  for(let i=0;i<Number($('cantidad-opciones').value);i++) {
    const div=document.createElement('div');div.className='fields';
    const h=document.createElement('h3');h.textContent='Opción '+(i+1);div.append(h);
    for(const [titulo,valores,valor] of [['Deducible',configComparativo.deducibles,prev[i]?.[0]||['32000','56000','87000'][i]],['Tabulador',configComparativo.tabuladores,prev[i]?.[1]||$('tabulador').value]]) {
      const l=document.createElement('label');l.textContent=titulo;const sel=document.createElement('select');
      valores.forEach(v=>sel.add(new Option(titulo==='Deducible'?'$'+Number(v).toLocaleString('es-MX'):v,v)));sel.value=valor;l.append(sel);div.append(l);
    }
    $('opciones-comparativo').append(div);
  }
}
$('modalidad').onchange=()=>{
  const comparar=$('modalidad').value==='comparativo';$('comparativo').hidden=!comparar;
  $('deducible').disabled=comparar;$('tabulador').disabled=comparar;
  if(comparar){$('metodo').value='gnp';$('metodo').onchange();opcionesComparativo();}
  $('metodo').disabled=comparar;
};
$('cantidad-opciones').onchange=opcionesComparativo;
function datos() {
  const f=new FormData($('cotizacion'));
  return {nombre:f.get('nombre'),edad:f.get('edad'),genero:f.get('genero'),cp:f.get('cp'),
    modalidad:$('modalidad').value,...($('modalidad').value==='comparativo'?{opciones:[...$('opciones-comparativo').children].map(e=>{const s=e.querySelectorAll('select');return {deducible:s[0].value,tabulador:s[1].value};})}:{}),tabulador:$('tabulador').value,deducible:$('deducible').value,acceso:f.get('acceso'),alta:f.get('alta')==='true',
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
  for(const [i,o] of (s.opciones||[]).entries())detalle.append(parrafo('Opción '+(i+1)+': deducible '+moneda(Number(o.deducible)*100)+' · tabulador '+o.tabulador));
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
      if(j.solicitud?.modalidad==='comparativo')div.append(parrafo('Comparativo de '+j.solicitud.opciones.length+' opciones'));
      for(const [i,o] of (j.resultado?.opciones||[]).entries())div.append(parrafo('Opción '+(i+1)+': deducible '+moneda(Number(o.deducible)*100)+' · tabulador '+o.tabulador+' · prima anual '+moneda(o.totalAnual)));
      if(j.resultado?.folio)div.append(parrafo('Folio GNP: '+j.resultado.folio));
      if(moneda(j.resultado?.totalAnual)!==null)div.append(parrafo('Prima anual: '+moneda(j.resultado.totalAnual),'prima-historial'));
      if(j.error)div.append(parrafo(j.error,'error'));
      for(const a of j.resultado?.advertencias||[])div.append(parrafo(a,'hint'));
      div.append(detalleSolicitud(j,abiertos.has(j.id)));
      const acciones=document.createElement('div');acciones.className='acciones';
      if(j.estado==='completada')for(const [tipo,texto] of [['propuesta',j.solicitud?.modalidad==='comparativo'?'Comparativo QUILLUM':'Propuesta QUILLUM'],...(j.solicitud?.modalidad==='comparativo'?j.solicitud.opciones.map((_,i)=>['gnp-'+(i+1),'GNP opción '+(i+1)]):[['gnp','Cotización GNP']])]){
        const a=document.createElement('a');a.href='/api/jobs/'+j.id+'/files/'+tipo;a.textContent=texto;acciones.append(a);
      }
      if(j.estado==='error'){
        const b=document.createElement('button');b.textContent='Reintentar';b.className='secondary';
        b.onclick=async()=>{if(!confirm('¿Reintentar esta solicitud? Si hubo un PDF previo, revísalo primero.'))return;b.disabled=true;try{await api('/api/jobs/'+j.id+'/retry',{method:'POST'});await refrescar();}catch(e){aviso(e.message);b.disabled=false;}};acciones.append(b);
        for(const tipo of (j.solicitud?.modalidad==='comparativo'?j.solicitud.opciones.map((_,i)=>'gnp-'+(i+1)):['gnp'])){const a=document.createElement('a');a.href='/api/jobs/'+j.id+'/files/'+tipo;a.textContent='Revisar PDF '+tipo+', si se generó';acciones.append(a);}
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
let enviando=false,revision;
const estadoEnvio=texto=>{$('gmm-envio-estado').textContent=texto;};
function cerrarRevision(){revision=undefined;$('gmm-revision').hidden=true;}
function revisarSolicitud(){
  const s=datos();
  const comparacion=s.opciones?'\nComparativo:\n'+s.opciones.map((o,i)=>`Opción ${i+1}: deducible $${Number(o.deducible).toLocaleString('es-MX')}, tabulador ${o.tabulador}`).join('\n'):'';
  $('gmm-resumen').textContent=`${s.nombre}${comparacion}\nTitular: ${s.edad} años, ${s.genero}, CP ${s.cp}\nFamiliares: ${s.familiares.map(f=>f.edad+' años, '+f.genero).join('; ')||'ninguno'}\n${s.opciones?'Acceso '+s.acceso:'Tabulador '+s.tabulador+', deducible $'+Number(s.deducible).toLocaleString('es-MX')+', acceso '+s.acceso}\nAlta Tecnología: ${s.alta?'sí':'no'}\nSolidez Familiar: ${s.familiares.length>=3?'solicitar':'no aplicar'}`;
  const clave=revision&&JSON.stringify(revision.solicitud)===JSON.stringify(s)&&revision.metodo===$('metodo').value&&revision.pdf===$('pdf').files[0]?revision.clave:undefined;
  revision={solicitud:s,metodo:$('metodo').value,pdf:$('pdf').files[0],clave};
  $('gmm-confirmar').textContent=revision.metodo==='pdf'?'Confirmar y generar propuesta':'Confirmar y cotizar';
  $('gmm-revision').hidden=false;estadoEnvio('Revisa los datos y pulsa «'+$('gmm-confirmar').textContent+'».');
  $('gmm-revision-titulo').focus();$('gmm-revision').scrollIntoView({block:'nearest',behavior:'smooth'});
}
$('cotizacion').addEventListener('invalid',e=>{estadoEnvio('Revisa el campo «'+(e.target.closest('label')?.firstChild?.textContent.trim()||'dato requerido')+'»: '+e.target.validationMessage);},true);
$('cotizacion').onsubmit=e=>{e.preventDefault();if(enviando)return;try{revisarSolicitud();}catch(e){estadoEnvio('No se pudo preparar la solicitud: '+e.message);}};
$('gmm-cancelar').onclick=()=>{cerrarRevision();estadoEnvio('Puedes corregir los datos y volver a revisar la solicitud.');$('enviar').focus();};
$('gmm-confirmar').onclick=async()=>{
  if(enviando||!revision)return;
  if(!$('cotizacion').reportValidity())return;
  if(JSON.stringify(datos())!==JSON.stringify(revision.solicitud)||$('metodo').value!==revision.metodo||$('pdf').files[0]!==revision.pdf){revisarSolicitud();estadoEnvio('Los datos cambiaron. Revisa y confirma la solicitud actualizada.');return;}
  enviando=true;$('enviar').disabled=true;$('gmm-confirmar').disabled=true;$('gmm-cancelar').disabled=true;
  estadoEnvio('Enviando solicitud… Espera la confirmación antes de volver a enviarla.');
  try{
    const s=revision.solicitud,options={method:'POST',headers:{'Idempotency-Key':revision.clave||(revision.clave=crypto.randomUUID())}};
    let endpoint='/api/jobs';
    if(revision.metodo==='pdf'){const f=new FormData();f.append('solicitud',JSON.stringify(s));f.append('pdf',revision.pdf);options.body=f;endpoint='/api/pdf';}
    else{options.headers['Content-Type']='application/json';options.body=JSON.stringify(s);}
    await api(endpoint,options);cerrarRevision();paginaHistorial=1;$('buscar').value='';$('estado').value='';
    const mensaje='Solicitud recibida. Sigue su avance en «Mis solicitudes»; ahí aparecerán los documentos o el motivo de cualquier error.';estadoEnvio(mensaje);aviso(mensaje);await refrescar();
  }catch(e){estadoEnvio('No se pudo enviar: '+e.message);aviso(e.message);}finally{enviando=false;$('enviar').disabled=false;$('gmm-confirmar').disabled=false;$('gmm-cancelar').disabled=false;}
};
$('gmm-recargar').onclick=()=>iniciarGmm();
async function cargarConfig(){const c=await api('/api/config');configComparativo=c;opciones('deducible',c.deducibles,'32000');opciones('tabulador',c.tabuladores,'D');opciones('acceso',c.accesos,'Amplio');$('config-text').textContent=(c.logo?'Logo cargado. ':'Falta cargar el logo. ')+(c.gnpConfigurado?'Credenciales de GNP configuradas; el acceso se comprobará al cotizar.':'Faltan las credenciales de GNP; puedes probar con un PDF existente.')+' '+c.nota;if(!c.logo)$('configuracion').open=true;}
let historialIniciado=false;
async function iniciarGmm(){ $('enviar').disabled=true;$('gmm-recargar').hidden=true;try{await cargarConfig();familiares();if($('modalidad').value==='comparativo')opcionesComparativo();$('enviar').disabled=false;estadoEnvio('Completa los datos y pulsa «Revisar y enviar solicitud».');if(!historialIniciado){historialIniciado=true;await refrescar();setInterval(refrescar,5000);}}catch(e){estadoEnvio('No se pudieron cargar las opciones: '+e.message);$('gmm-recargar').hidden=false;aviso(e.message);}}
iniciarGmm();
