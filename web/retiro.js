(()=>{
 const $=id=>document.getElementById(id);let iaDisponible=false,modelo,frases={},generandoTextos=false,titulos={},sugeridos={},enfoqueTitulo,guardandoTitulo=false,paginas=3,borrador,datosListos=false,descargando=false,logos={quillum:false,gnp:false};
 const aviso=t=>{$('retiro-estado').textContent=t;};
 async function json(url,options){const r=await fetch(url,options);if(r.status===401){location.assign('/login');throw Error('Inicia sesión.');}const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar la solicitud.');return d;}
 function actualizarDescarga(){$('retiro-descargar').disabled=!borrador||!datosListos||!logos.quillum||!logos.gnp||descargando||guardandoTitulo||generandoTextos;}
 function mostrarLogos(d){logos={quillum:!!d.quillum,gnp:!!d.gnp};$('retiro-logos-estado').textContent='QUILLUM: '+(logos.quillum?'guardado':'pendiente')+' · GNP: '+(logos.gnp?'guardado':'pendiente')+'.';if(!logos.quillum||!logos.gnp)$('retiro-logos').open=true;actualizarDescarga();}
 async function eliminar(){if(borrador){await json('/api/retiro/'+borrador,{method:'DELETE'});borrador=undefined;}datosListos=false;modelo=undefined;$('retiro-presentacion').hidden=true;titulos={};frases={};sugeridos={};enfoqueTitulo=undefined;$('retiro-anio').disabled=true;explorar();$('retiro-contexto').value='';$('retiro-frase').value='';actualizarDescarga();}
 function parametros(){const q=new URLSearchParams({enfoque:$('retiro-enfoque').value});if(!$('retiro-anio').disabled)q.set('anio',$('retiro-anio').value);return q;}
 function mostrar(){if(!borrador)return;const frame=$('retiro-vista');frame.hidden=false;$('retiro-navegacion').hidden=false;const ancho=Math.max(280,Math.min(2000,frame.clientWidth||818));const q=parametros();q.set('pagina',$('retiro-pagina').value);q.set('ancho',String(ancho));frame.style.height=Math.ceil(1180*Math.min(1,(ancho-24)/794)+32)+'px';frame.src='/api/retiro/'+borrador+'/vista?'+q;}
 function explorar(){
  const f=modelo?.tablaValida?modelo.tabla.find(f=>f.anio===Number($('retiro-anio').value)):undefined;
  $('retiro-escenario-estado').textContent=f&&!$('retiro-anio').disabled?'Escenario de invalidez: año '+f.anio+' · '+f.edad+' años. Solo cambia la historia de la hoja 2; la tabla conserva el calendario original.':'El año estará disponible cuando se identifiquen la tabla y las coberturas de invalidez.';
 }
 function tituloActual(){enfoqueTitulo=$('retiro-enfoque').value;$('retiro-titulo-personalizado').value=titulos[enfoqueTitulo]||sugeridos[enfoqueTitulo]||'';$('retiro-frase').value=frases[enfoqueTitulo]||'';$('retiro-presentacion').hidden=!borrador;}
 async function guardarTitulo(){
  if(!borrador||guardandoTitulo)return;
  const enfoque=enfoqueTitulo,titulo=$('retiro-titulo-personalizado').value,frase=$('retiro-frase').value;guardandoTitulo=true;actualizarDescarga();$('retiro-aplicar-titulo').disabled=true;$('retiro-restablecer-titulo').disabled=true;$('retiro-enfoque').disabled=true;$('retiro-titulo-personalizado').disabled=true;$('retiro-frase').disabled=true;$('retiro-sugerir-textos').disabled=true;
  try{const d=await json('/api/retiro/'+borrador+'/titulo',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enfoque,titulo,frase})});titulos[enfoque]=d.titulo;frases[enfoque]=d.frase||'';if(enfoque===enfoqueTitulo&&$('retiro-titulo-personalizado').value===titulo){$('retiro-titulo-personalizado').value=d.titulo;$('retiro-frase').value=d.frase||'';$('retiro-titulo-estado').textContent='Textos aplicados. Se incluirán en la propuesta.';}}finally{guardandoTitulo=false;$('retiro-aplicar-titulo').disabled=false;$('retiro-restablecer-titulo').disabled=false;$('retiro-enfoque').disabled=false;$('retiro-titulo-personalizado').disabled=false;$('retiro-frase').disabled=false;$('retiro-sugerir-textos').disabled=generandoTextos||!iaDisponible;actualizarDescarga();}
 }
 $('retiro-titulo-personalizado').addEventListener('input',()=>{if(enfoqueTitulo)titulos[enfoqueTitulo]=$('retiro-titulo-personalizado').value;$('retiro-titulo-estado').textContent='Pulsa «Aplicar textos» para verlos. También se aplicará antes de descargar.';});
 $('retiro-sugerir-textos').addEventListener('click',async()=>{
  if(!borrador||!iaDisponible||generandoTextos||guardandoTitulo)return;
  generandoTextos=true;actualizarDescarga();const controles=['retiro-sugerir-textos','retiro-contexto','retiro-titulo-personalizado','retiro-frase','retiro-enfoque','retiro-aplicar-titulo','retiro-restablecer-titulo','retiro-cargar','retiro-cerrar'];for(const id of controles)$(id).disabled=true;
  $('retiro-contexto-estado').textContent='Redactando con IA…';
  try{const d=await json('/api/retiro/'+borrador+'/sugerir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enfoque:enfoqueTitulo,contexto:$('retiro-contexto').value})});titulos[enfoqueTitulo]=d.titulo;frases[enfoqueTitulo]=d.frase;tituloActual();$('retiro-contexto-estado').textContent='Sugerencia generada. Revisa el título y la frase de cierre; pulsa «Aplicar textos» para verlos en la propuesta.';$('retiro-titulo-estado').textContent='Textos sugeridos pendientes de aplicar.';}catch(e){$('retiro-contexto-estado').textContent=e.message;}finally{generandoTextos=false;for(const id of controles)$(id).disabled=false;actualizarDescarga();}
 });
 $('retiro-frase').addEventListener('input',()=>{if(enfoqueTitulo)frases[enfoqueTitulo]=$('retiro-frase').value;$('retiro-titulo-estado').textContent='Pulsa «Aplicar textos» para verlos. También se aplicarán antes de descargar.';});
 $('retiro-titulo-personalizado').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('retiro-aplicar-titulo').click();}});
 $('retiro-aplicar-titulo').addEventListener('click',async()=>{try{await guardarTitulo();mostrar();}catch(e){$('retiro-titulo-estado').textContent=e.message;}});
 $('retiro-restablecer-titulo').addEventListener('click',async()=>{titulos[enfoqueTitulo]=sugeridos[enfoqueTitulo];frases[enfoqueTitulo]='';tituloActual();try{await guardarTitulo();mostrar();}catch(e){$('retiro-titulo-estado').textContent=e.message;}});
 $('retiro-enfoque').addEventListener('change',async()=>{if(!borrador)return;tituloActual();try{await guardarTitulo();mostrar();}catch(e){$('retiro-titulo-estado').textContent=e.message;}});
 $('retiro-anio').addEventListener('change',()=>{$('retiro-pagina').value='2';explorar();mostrar();});
 $('retiro-pagina').addEventListener('change',()=>{explorar();mostrar();});
 let anchoPrevio=0,pendiente;new ResizeObserver(entradas=>{const ancho=Math.round(entradas[0].contentRect.width);if(Math.abs(ancho-anchoPrevio)<8)return;anchoPrevio=ancho;clearTimeout(pendiente);pendiente=setTimeout(()=>{if(borrador)mostrar();},150);}).observe($('retiro-vista').parentElement);
 $('retiro-logos-form').addEventListener('submit',async event=>{
  event.preventDefault();$('retiro-guardar-logos').disabled=true;
  try{const datos=new FormData($('retiro-logos-form'));const d=await json('/api/retiro/logos',{method:'POST',body:datos});mostrarLogos(d);$('retiro-logos-form').reset();if(logos.quillum&&logos.gnp)$('retiro-logos').open=false;mostrar();}catch(e){$('retiro-logos-estado').textContent=e.message;}finally{$('retiro-guardar-logos').disabled=false;}
 });
 $('retiro-descargar').addEventListener('click',async()=>{
  if(!borrador)return;descargando=true;actualizarDescarga();$('retiro-descargar').textContent='Preparando PDF…';aviso('Preparando las '+paginas+' páginas de tu propuesta…');
  try{await guardarTitulo();mostrar();const r=await fetch('/api/retiro/'+borrador+'/pdf?'+parametros());if(r.status===401){location.assign('/login');return;}if(!r.ok){const d=await r.json();throw Error(d.error||'No se pudo generar el PDF.');}const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='Propuesta-QUILLUM-Vida-Retiro.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);aviso('PDF descargado. Incluye todas las páginas, el enfoque seleccionado y tus logos guardados.');}catch(e){aviso(e.message);}finally{descargando=false;$('retiro-descargar').textContent='Descargar propuesta PDF';actualizarDescarga();}
 });
 $('retiro-form').addEventListener('submit',async event=>{
  event.preventDefault();$('retiro-cargar').disabled=true;aviso('Leyendo ilustración…');
  try{
   await eliminar();$('retiro-vista').hidden=true;$('retiro-navegacion').hidden=true;
   const data=await json('/api/retiro/preview',{method:'POST',body:new FormData($('retiro-form'))});
   borrador=data.id;modelo=data.modelo;paginas=data.paginas||3;datosListos=data.datosListos;sugeridos=data.titulos||{};titulos={...sugeridos};frases={};tituloActual();$('retiro-titulo-estado').textContent='Puedes usar el título sugerido o escribir el tuyo.';mostrarLogos(data.logos);
   const lista=$('retiro-incidencias');lista.replaceChildren();
   for(const texto of data.modelo.incidencias){const li=document.createElement('li');li.textContent=texto;lista.append(li);}
   const evidencias=$('retiro-evidencias');evidencias.replaceChildren();
   const nombres={cliente:'Cliente',edad:'Edad inicial',inflacion:'Inflación ilustrada',plazoPago:'Años de aportaciones',edadVencimiento:'Edad al vencimiento',moneda:'Moneda',aportacion:'Aportación inicial anual',plazoPlan:'Plazo del plan',proteccionInicial:'Protección inicial',ahorro:'Valor final proyectado'};
   const dinero=n=>'$'+(Number(n)/100).toLocaleString('es-MX',{maximumFractionDigits:2});
   for(const [nombre,campo]of Object.entries(data.modelo.campos)){const p=document.createElement('p');const valor=['proteccionInicial','ahorro'].includes(nombre)?dinero(campo.valor):campo.valor+(nombre==='inflacion'?'%':'');p.textContent=(nombres[nombre]||nombre)+': '+valor+' · Fuente: '+campo.fuente;evidencias.append(p);}
   if(data.modelo.coberturas?.length){const h=document.createElement('h3');h.textContent='Coberturas identificadas en la ilustración';evidencias.append(h);
    for(const cobertura of data.modelo.coberturas){const p=document.createElement('p');p.textContent=cobertura.nombre+(cobertura.suma!==undefined?' · Suma inicial: '+dinero(cobertura.suma):cobertura.porcentaje!==undefined?' · '+cobertura.porcentaje+'% · Amparada':' · Amparada')+(cobertura.aportacion!==undefined?' · Aportación inicial anual: '+dinero(cobertura.aportacion):'');evidencias.append(p);}
   }
   const anios=$('retiro-anio');anios.replaceChildren();anios.disabled=!data.modelo.tablaValida||!data.modelo.coberturas?.some(c=>['exencion','invalidez'].includes(c.tipo));
   if(!anios.disabled){for(const fila of data.modelo.tabla)anios.add(new Option('Año '+fila.anio+' · Edad '+fila.edad,fila.anio));anios.value=String(Math.min(6,data.modelo.tabla.length));}
   else anios.add(new Option('Disponible con tabla y cobertura de invalidez',''));
   const selector=$('retiro-pagina');selector.replaceChildren();for(let n=1;n<=paginas;n++)selector.add(new Option(n+' · '+(n===1?'Tu proyecto':n===2?'Escenarios de vida':n===3?'Tus números':'Tabla · continuación'),String(n)));$('retiro-total-paginas').textContent='El PDF incluye las '+paginas+' páginas.';
   selector.value='1';explorar();mostrar();actualizarDescarga();
   aviso((datosListos?'Ilustración leída: '+data.modelo.tabla.length+' años. ':'Hay datos por revisar en la ilustración. ')+(!datosListos?'La descarga se habilitará al validar los datos pendientes.':logos.quillum&&logos.gnp?'Revisa la vista previa y descarga tu propuesta PDF.':'Guarda los logos de QUILLUM y GNP para habilitar la descarga.'));
  }catch(e){aviso(e.message);}finally{$('retiro-cargar').disabled=false;}
 });
 $('retiro-cerrar').addEventListener('click',async()=>{try{await eliminar();$('retiro-vista').hidden=true;$('retiro-vista').removeAttribute('src');$('retiro-navegacion').hidden=true;$('retiro-form').reset();$('retiro-anio').disabled=true;$('retiro-incidencias').replaceChildren();$('retiro-evidencias').replaceChildren();aviso('Vista previa cerrada. Los logos permanecen guardados.');}catch(e){aviso(e.message);}});
 json('/api/retiro/redaccion').then(d=>{iaDisponible=!!d.disponible;$('retiro-sugerir-textos').disabled=!iaDisponible;if(!iaDisponible)$('retiro-contexto-estado').textContent='Para activar la redacción con IA, configura OPENAI_API_KEY en las variables de Railway. Puedes editar el título y la frase manualmente.';}).catch(e=>{$('retiro-sugerir-textos').disabled=true;$('retiro-contexto-estado').textContent=e.message;});
 json('/api/retiro/logos').then(mostrarLogos).catch(e=>{$('retiro-logos-estado').textContent=e.message;});
})();
