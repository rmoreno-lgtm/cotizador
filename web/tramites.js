(()=>{
  const elemento=id=>document.getElementById('tramites-'+id);
  const boton=elemento('actualizar');
  const reporte=elemento('reporte');
  const mensaje=elemento('mensaje');
  const formato=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'});
  let temporizador;
  let pendiente=false;

  function mostrar({configurado,enCurso,error,ultimaConsulta,exploracion,vistaPrevia}) {
    boton.disabled=!configurado || enCurso;
    reporte.disabled=!configurado || enCurso || !vistaPrevia;
    mostrarVista(vistaPrevia);
    mensaje.textContent=error || (enCurso?'Consultando GNP…':configurado
      ? (vistaPrevia || ultimaConsulta?'':'Abre la tabla de GNP antes de generar el reporte.')
      : 'La consulta requiere las credenciales de GNP en Railway.');
    const ruta=elemento('exploracion');
    ruta.hidden=!exploracion.length;
    if(error && exploracion.length)ruta.open=true;
    elemento('pasos').replaceChildren(...exploracion.map(texto=>{
      const li=document.createElement('li');
      li.textContent=texto;
      return li;
    }));
    if(!ultimaConsulta)return;
    const {consultadoEn,tramites,paginas}=ultimaConsulta;
    elemento('consulta').textContent='Última consulta exitosa: '+formato.format(new Date(consultadoEn))+
      ' · '+paginas+' '+(paginas===1?'página revisada':'páginas revisadas');
    elemento('resultados').hidden=false;
    const enProceso=tramites.filter(t=>t.estado==='En proceso').length;
    elemento('totales').textContent=enProceso+' en proceso · '+(tramites.length-enProceso)+' activados';
    elemento('filas').replaceChildren(...tramites.map(({folio,estado})=>{
      const fila=document.createElement('tr');
      fila.insertCell().textContent=folio;
      fila.insertCell().textContent=estado;
      return fila;
    }));
  }

  function mostrarVista(vista) {
    elemento('vista').hidden=!vista;
    if(!vista){
      elemento('vista-columnas').replaceChildren();
      elemento('vista-filas').replaceChildren();
      return;
    }
    const {columnas,filas,consultadoEn}=vista;
    elemento('vista-detalle').textContent=filas.length
      ? 'Primera página · '+filas.length+' filas · '+formato.format(new Date(consultadoEn))
      : 'GNP indicó que no hay trámites en esta consulta.';
    elemento('vista-columnas').replaceChildren(...columnas.map(nombre=>{
      const th=document.createElement('th');
      th.scope='col';
      th.textContent=nombre;
      return th;
    }));
    elemento('vista-filas').replaceChildren(...filas.map(celdas=>{
      const fila=document.createElement('tr');
      for(const valor of celdas)fila.insertCell().textContent=valor;
      return fila;
    }));
  }

  async function cargar() {
    if(pendiente || location.hash!=='#tramites')return;
    clearTimeout(temporizador);
    pendiente=true;
    try {
      const respuesta=await fetch('/api/tramites');
      if(!respuesta.ok)throw new Error();
      const datos=await respuesta.json();
      mostrar(datos);
      if(datos.enCurso)temporizador=setTimeout(cargar,2000);
    } catch {
      mensaje.textContent='No se pudo cargar el estado de la consulta.';
      temporizador=setTimeout(cargar,5000);
    } finally {pendiente=false;}
  }

  async function iniciar(ruta) {
    boton.disabled=true;
    reporte.disabled=true;
    mensaje.textContent='Iniciando consulta…';
    try {
      const respuesta=await fetch('/api/tramites/'+ruta,{method:'POST'});
      if(!respuesta.ok){
        const datos=await respuesta.json().catch(()=>({}));
        throw new Error(datos.error || 'No se pudo iniciar la consulta.');
      }
      await cargar();
    } catch(error) {
      await cargar();
      mensaje.textContent=error.message;
    }
  }
  boton.addEventListener('click',()=>iniciar('vista'));
  reporte.addEventListener('click',()=>iniciar('actualizar'));
  window.addEventListener('hashchange',cargar);
  void cargar();
})();

// Vigilancias automáticas: reglas, frecuencia, horario y avisos.
(()=>{
  const $=id=>document.getElementById(id);
  if(!$('vig-lista'))return;
  if(!document.querySelector('link[href="/tramites.css"]')){
    const css=document.createElement('link');
    css.rel='stylesheet';css.href='/tramites.css';
    document.head.append(css);
  }
  const form=$('vig-form');
  const formato=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'});
  const dias=['','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const frecuencia=m=>m<60?m+' min':m%60===0?(m===1440?'1 vez al día':'cada '+m/60+' h'):'cada '+m+' min';
  let estado=null;
  let editando=null;
  let temporizador;

  const el=(tag,props={},...hijos)=>{const e=document.createElement(tag);Object.assign(e,props);e.append(...hijos);return e;};
  const fecha=v=>v?formato.format(new Date(v)):'—';

  function pintarEstatus(seccion,marcados) {
    const info=estado.secciones[seccion];
    const elegidos=new Set(marcados || info.abiertos);
    $('vig-estatus').replaceChildren(...info.estatus.map(e=>el('label',{},
      el('input',{type:'checkbox',name:'estatus',value:e,checked:elegidos.has(e)}),e)));
    $('vig-obs-label').hidden=seccion!=='gmm';
  }

  function abrirFormulario(regla) {
    editando=regla?.id || null;
    form.reset();
    $('vig-form-titulo').textContent=regla?'Editar regla':'Nueva regla';
    $('vig-seccion').replaceChildren(...Object.entries(estado.secciones).map(([k,v])=>el('option',{value:k,textContent:v.nombre})));
    if(regla){
      form.nombre.value=regla.nombre;
      form.seccion.value=regla.seccion;
      form.fechaDesde.value=regla.fechaDesde || '';
      form.cadaMinutos.value=String(regla.cadaMinutos);
      if(form.cadaMinutos.value!==String(regla.cadaMinutos))
        form.cadaMinutos.append(el('option',{value:regla.cadaMinutos,textContent:frecuencia(regla.cadaMinutos),selected:true}));
      form.desde.value=regla.horario.desde;
      form.hasta.value=regla.horario.hasta;
      for(const c of form.querySelectorAll('[name=dias]'))c.checked=regla.horario.dias.includes(Number(c.value));
      for(const c of form.querySelectorAll('[name=avisar]'))c.checked=regla.avisar[c.value];
      form.leerObservaciones.checked=regla.leerObservaciones;
      form.correos.value=regla.correos.join(', ');
      form.whatsapp.value=regla.whatsapp.join(', ');
      form.claveAgente.value=regla.claveAgente || '';
      form.activa.checked=regla.activa;
    } else {
      form.fechaDesde.value=new Date().toLocaleDateString('en-CA');
    }
    pintarEstatus(form.seccion.value,regla?.estatus);
    form.hidden=false;
    form.nombre.focus();
  }

  function leerFormulario() {
    const marcados=name=>[...form.querySelectorAll('[name='+name+']:checked')].map(c=>c.value);
    const avisar=Object.fromEntries([...form.querySelectorAll('[name=avisar]')].map(c=>[c.value,c.checked]));
    return {
      nombre:form.nombre.value,seccion:form.seccion.value,fechaDesde:form.fechaDesde.value,
      estatus:marcados('estatus'),cadaMinutos:Number(form.cadaMinutos.value),
      horario:{dias:marcados('dias').map(Number),desde:form.desde.value,hasta:form.hasta.value},
      avisar,leerObservaciones:form.leerObservaciones.checked,
      correos:form.correos.value,whatsapp:form.whatsapp.value,claveAgente:form.claveAgente.value,
      activa:form.activa.checked
    };
  }

  async function pedir(url,opciones={}) {
    const r=await fetch(url,{...opciones,headers:{'Content-Type':'application/json'}});
    if(!r.ok){
      const d=await r.json().catch(()=>({}));
      throw new Error(d.error || 'No se pudo completar la acción.');
    }
    return r.status===204||r.status===202?null:await r.json();
  }

  function resultado(r) {
    if(!r.ultimoResultado)return 'Aún no se ejecuta.';
    if(!r.ultimoResultado.ok)return 'Error: '+r.ultimoResultado.error;
    return r.ultimoResultado.inicial
      ? 'Línea base tomada · '+r.ultimoResultado.enVista+' trámites en la vista'
      : r.ultimoResultado.cambios+' cambios · '+r.ultimoResultado.enVista+' trámites en la vista';
  }

  function tarjeta(r) {
    const s=estado.secciones[r.seccion];
    const destinos=[r.correos.length?r.correos.length+' correo'+(r.correos.length>1?'s':''):'',r.whatsapp.length?r.whatsapp.length+' WhatsApp':''].filter(Boolean).join(' · ') || 'Sin destinatarios';
    const acciones=el('div',{className:'vig-acciones'},
      el('button',{type:'button',textContent:'Revisar ahora',disabled:!estado.configurado || estado.ocupado,onclick:()=>accion(()=>pedir('/api/tramites/vigilancias/'+r.id+'/ejecutar',{method:'POST'}),'Revisando GNP…')}),
      el('button',{type:'button',className:'secondary',textContent:'Ver trámites',onclick:()=>verTramites(r)}),
      el('button',{type:'button',className:'secondary',textContent:'Editar',onclick:()=>abrirFormulario(r)}),
      el('button',{type:'button',className:'secondary',textContent:r.activa?'Pausar':'Activar',onclick:()=>accion(()=>pedir('/api/tramites/vigilancias/'+r.id,{method:'PUT',body:JSON.stringify({...r,activa:!r.activa})}))}),
      el('button',{type:'button',className:'secondary',textContent:'Eliminar',onclick:()=>{if(confirm('¿Eliminar la regla «'+r.nombre+'»?'))accion(()=>pedir('/api/tramites/vigilancias/'+r.id,{method:'DELETE'}));}}));
    return el('article',{className:'vig-regla'+(r.activa?'':' vig-pausada')},
      el('h3',{textContent:r.nombre+(r.activa?'':' · en pausa')}),
      el('p',{className:'hint',textContent:s.nombre+' · '+r.estatus.join(', ')+(r.fechaDesde?' · desde '+r.fechaDesde:'')+(r.claveAgente?' · clave '+r.claveAgente:'')}),
      el('p',{textContent:frecuencia(r.cadaMinutos)+' · '+r.horario.dias.map(d=>dias[d]).join(' ')+' · '+r.horario.desde+'–'+r.horario.hasta+' · '+destinos}),
      el('p',{className:'hint',textContent:'Última: '+fecha(r.ultimaEjecucion)+' · Próxima: '+(r.activa?fecha(r.proximaEjecucion):'—')+' · '+resultado(r)}),
      acciones);
  }

  async function verTramites(r) {
    const d=await pedir('/api/tramites/vigilancias/'+r.id+'/tramites');
    $('vig-tramites').hidden=false;
    $('vig-tramites').open=true;
    $('vig-tramites-titulo').textContent='Trámites en la vista · '+r.nombre+' · '+(d.actualizado?fecha(d.actualizado):'sin revisar');
    $('vig-tramites-filas').replaceChildren(...(d.tramites.length?d.tramites.map(t=>{
      const fila=document.createElement('tr');
      for(const v of [t.ot,t.contratante,t.tipoMovimiento || t.tipo,t.poliza,t.estatus,t.fechaRegistro,t.fechaCompromiso || '—',
        t.observacionGnp?t.observacionGnp.fecha+': '+t.observacionGnp.texto:(t.observacionesLeidas?'Sin observaciones de GNP':'—')])
        fila.insertCell().textContent=v || '—';
      return fila;
    }):[el('tr',{},el('td',{colSpan:8,textContent:'No hay trámites que cumplan la regla.'}))]));
  }

  function pintar() {
    const c=estado.canales;
    $('vig-canales').textContent=(estado.configurado?'':'Faltan las credenciales de GNP en Railway. ')+
      'Correo: '+(c.correo?'listo':'sin configurar')+' · WhatsApp: '+(c.whatsapp?'listo':'sin configurar')+' · Horario: '+estado.zona+
      (estado.ocupado?' · Revisando GNP ahora: '+(estado.progreso.at(-1) || 'iniciando'):'');
    $('vig-lista').replaceChildren(...(estado.reglas.length?estado.reglas.map(tarjeta):[el('p',{className:'hint',textContent:'Todavía no hay reglas. Crea la primera con «Nueva regla».'})]));
    $('vig-avisos').replaceChildren(...(estado.avisos.length?estado.avisos.map(a=>{
      const envio=[a.envio?.correo?(a.envio.correo.ok?'correo enviado':'correo: '+a.envio.correo.error):'',
        ...(a.envio?.whatsapp || []).map(w=>w.ok?'WhatsApp '+w.numero+' enviado':'WhatsApp '+w.numero+': '+w.error)].filter(Boolean).join(' · ');
      return el('li',{},el('strong',{textContent:fecha(a.fecha)+' · '+a.asunto}),
        ...(a.lineas.length?[el('ul',{},...a.lineas.map(l=>el('li',{textContent:l})))]:[]),
        envio?el('p',{className:'hint',textContent:envio}):'');
    }):[el('li',{className:'hint',textContent:'Sin avisos todavía.'})]));
  }

  async function cargar() {
    if(location.hash!=='#tramites')return;
    clearTimeout(temporizador);
    try {
      estado=await pedir('/api/tramites/vigilancias');
      pintar();
      temporizador=setTimeout(cargar,estado.ocupado?3000:30000);
    } catch(error) {
      $('vig-mensaje').textContent=error.message;
      temporizador=setTimeout(cargar,10000);
    }
  }

  async function accion(fn,texto='') {
    $('vig-mensaje').textContent=texto;
    try {await fn();$('vig-mensaje').textContent=texto;}
    catch(error){$('vig-mensaje').textContent=error.message;}
    await cargar();
  }

  $('vig-nueva').addEventListener('click',()=>estado && abrirFormulario(null));
  $('vig-cancelar').addEventListener('click',()=>{form.hidden=true;});
  $('vig-seccion').addEventListener('change',()=>pintarEstatus(form.seccion.value));
  $('vig-abiertos').addEventListener('click',()=>pintarEstatus(form.seccion.value));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const datos=leerFormulario();
    void accion(async()=>{
      await pedir('/api/tramites/vigilancias'+(editando?'/'+editando:''),{method:editando?'PUT':'POST',body:JSON.stringify(datos)});
      form.hidden=true;
    },editando?'Regla actualizada.':'Regla creada. Hará su primera revisión dentro del horario.');
  });
  window.addEventListener('hashchange',cargar);
  void cargar();
})();
