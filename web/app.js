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
async function refrescar() {
  try {
    const jobs=await api('/api/jobs');const elementos=[];
    for(const j of jobs) {
      const div=document.createElement('article');div.className='job';
      const h=document.createElement('h3');h.textContent=j.nombre;div.append(h);
      const p=document.createElement('p');p.textContent=({pendiente:'En cola',procesando:'Procesando',completada:'Completada',error:'Requiere revisión'})[j.estado]+' · '+new Date(j.creadaEn).toLocaleString('es-MX',{timeZone:'America/Monterrey'});div.append(p);
      if(j.error){const e=document.createElement('p');e.className='error';e.textContent=j.error;div.append(e);}
      for(const a of j.resultado?.advertencias||[]){const e=document.createElement('p');e.className='hint';e.textContent=a;div.append(e);}
      if(j.estado==='completada')for(const [tipo,texto] of [['propuesta','Propuesta QUILLUM'],['gnp','Cotización GNP']]){
        const a=document.createElement('a');a.href='/api/jobs/'+j.id+'/files/'+tipo;a.textContent=texto;div.append(a);
      }
      if(j.estado==='error'){
        const b=document.createElement('button');b.textContent='Reintentar';b.className='secondary';
        b.onclick=async()=>{if(!confirm('¿Reintentar esta solicitud? Si hubo un PDF previo, revísalo primero.'))return;b.disabled=true;try{await api('/api/jobs/'+j.id+'/retry',{method:'POST'});await refrescar();}catch(e){aviso(e.message);b.disabled=false;}};div.append(b);
        const a=document.createElement('a');a.href='/api/jobs/'+j.id+'/files/gnp';a.textContent='Revisar PDF de GNP, si se generó';div.append(a);
      }
      elementos.push(div);
    }
    if(!elementos.length){const p=document.createElement('p');p.textContent='Tus próximas solicitudes aparecerán aquí.';elementos.push(p);}
    $('trabajos').replaceChildren(...elementos);
  }catch(e){aviso(e.message);}
}
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
    await api(endpoint,options);aviso('Solicitud recibida. Puedes seguir su avance y descargar los documentos aquí.');await refrescar();
  }catch(e){aviso(e.message);}finally{$('enviar').disabled=false;}
};
async function cargarConfig(){const c=await api('/api/config');opciones('deducible',c.deducibles,'32000');opciones('tabulador',c.tabuladores,'D');opciones('acceso',c.accesos,'Amplio');$('config-text').textContent=(c.logo?'Logo cargado. ':'Falta cargar el logo. ')+(c.gnpConfigurado?'Credenciales de GNP configuradas; el acceso se comprobará al cotizar.':'Faltan las credenciales de GNP; puedes probar con un PDF existente.')+' '+c.nota;if(!c.logo)$('configuracion').open=true;}
(async()=>{try{await cargarConfig();familiares();await refrescar();setInterval(refrescar,5000);}catch(e){aviso(e.message);}})();
