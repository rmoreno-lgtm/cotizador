(()=>{
 const $=id=>document.getElementById(id);let modelo,paginas=3,borrador,datosListos=false,descargando=false,logos={quillum:false,gnp:false};
 const aviso=t=>{$('retiro-estado').textContent=t;};
 async function json(url,options){const r=await fetch(url,options);if(r.status===401){location.assign('/login');throw Error('Inicia sesión.');}const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar la solicitud.');return d;}
 function actualizarDescarga(){$('retiro-descargar').disabled=!borrador||!datosListos||!logos.quillum||!logos.gnp||descargando;}
 function mostrarLogos(d){logos={quillum:!!d.quillum,gnp:!!d.gnp};$('retiro-logos-estado').textContent='QUILLUM: '+(logos.quillum?'guardado':'pendiente')+' · GNP: '+(logos.gnp?'guardado':'pendiente')+'.';if(!logos.quillum||!logos.gnp)$('retiro-logos').open=true;actualizarDescarga();}
 async function eliminar(){if(borrador){await json('/api/retiro/'+borrador,{method:'DELETE'});borrador=undefined;}datosListos=false;modelo=undefined;$('retiro-explorar').hidden=true;actualizarDescarga();}
 function parametros(){const q=new URLSearchParams({enfoque:$('retiro-enfoque').value});if(!$('retiro-anio').disabled)q.set('anio',$('retiro-anio').value);return q;}
 function mostrar(){if(!borrador)return;const frame=$('retiro-vista');frame.hidden=false;$('retiro-navegacion').hidden=false;const ancho=Math.max(280,Math.min(2000,frame.clientWidth||818));const q=parametros();q.set('pagina',$('retiro-pagina').value);q.set('ancho',String(ancho));frame.style.height=Math.ceil(1180*Math.min(1,(ancho-24)/794)+32)+'px';frame.src='/api/retiro/'+borrador+'/vista?'+q;}
 function explorar(){
  if(!modelo?.tablaValida){$('retiro-explorar').hidden=true;return;}
  $('retiro-explorar').hidden=false;const f=modelo.tabla.find(f=>f.anio===Number($('retiro-anio').value));if(!f)return;
  $('retiro-deslizador').value=String(f.anio);$('retiro-momento').textContent='Año '+f.anio+' · '+f.edad+' años según GNP'+(f.aportacion===0?' · Sin nuevas aportaciones':'');
  const dinero=n=>'$'+(n/100).toLocaleString('es-MX',{maximumFractionDigits:2});
  const resumen=$('retiro-resumen-anio');resumen.replaceChildren();
  const final=f.anio===modelo.tabla.at(-1).anio;
  for(const [titulo,valor]of [['Aportas este año',dinero(f.aportacion)],['Llevas aportado',dinero(f.acumulado)],[final?'Ahorro al vencimiento · proyectado':'Recuperación anticipada · proyectada',dinero(f.efectivo)],['Protección contratada',dinero(f.proteccion)]]){const div=document.createElement('div'),small=document.createElement('small'),b=document.createElement('b');small.textContent=titulo;b.textContent=valor;div.append(small,b);resumen.append(div);}
 }
 for(const id of ['retiro-enfoque','retiro-anio','retiro-pagina'])$(id).addEventListener('change',()=>{explorar();mostrar();});
 $('retiro-deslizador').addEventListener('input',()=>{$('retiro-anio').value=$('retiro-deslizador').value;explorar();});
 $('retiro-deslizador').addEventListener('change',mostrar);
 let anchoPrevio=0,pendiente;new ResizeObserver(entradas=>{const ancho=Math.round(entradas[0].contentRect.width);if(Math.abs(ancho-anchoPrevio)<8)return;anchoPrevio=ancho;clearTimeout(pendiente);pendiente=setTimeout(()=>{if(borrador)mostrar();},150);}).observe($('retiro-vista').parentElement);
 $('retiro-logos-form').addEventListener('submit',async event=>{
  event.preventDefault();$('retiro-guardar-logos').disabled=true;
  try{const datos=new FormData($('retiro-logos-form'));const d=await json('/api/retiro/logos',{method:'POST',body:datos});mostrarLogos(d);$('retiro-logos-form').reset();if(logos.quillum&&logos.gnp)$('retiro-logos').open=false;mostrar();}catch(e){$('retiro-logos-estado').textContent=e.message;}finally{$('retiro-guardar-logos').disabled=false;}
 });
 $('retiro-descargar').addEventListener('click',async()=>{
  if(!borrador)return;descargando=true;actualizarDescarga();$('retiro-descargar').textContent='Preparando PDF…';aviso('Preparando las '+paginas+' páginas de tu propuesta…');
  try{const r=await fetch('/api/retiro/'+borrador+'/pdf?'+parametros());if(r.status===401){location.assign('/login');return;}if(!r.ok){const d=await r.json();throw Error(d.error||'No se pudo generar el PDF.');}const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='Propuesta-QUILLUM-Vida-Retiro.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);aviso('PDF descargado. Incluye todas las páginas, el enfoque seleccionado y tus logos guardados.');}catch(e){aviso(e.message);}finally{descargando=false;$('retiro-descargar').textContent='Descargar propuesta PDF';actualizarDescarga();}
 });
 $('retiro-form').addEventListener('submit',async event=>{
  event.preventDefault();$('retiro-cargar').disabled=true;aviso('Leyendo ilustración…');
  try{
   await eliminar();$('retiro-vista').hidden=true;$('retiro-navegacion').hidden=true;
   const data=await json('/api/retiro/preview',{method:'POST',body:new FormData($('retiro-form'))});
   borrador=data.id;modelo=data.modelo;paginas=data.paginas||3;datosListos=data.datosListos;mostrarLogos(data.logos);
   const lista=$('retiro-incidencias');lista.replaceChildren();
   for(const texto of data.modelo.incidencias){const li=document.createElement('li');li.textContent=texto;lista.append(li);}
   const evidencias=$('retiro-evidencias');evidencias.replaceChildren();
   const nombres={cliente:'Cliente',edad:'Edad inicial',inflacion:'Inflación ilustrada',plazoPago:'Años de aportaciones',edadVencimiento:'Edad al vencimiento',moneda:'Moneda',aportacion:'Aportación inicial anual',plazoPlan:'Plazo del plan',proteccionInicial:'Protección inicial',ahorro:'Valor final proyectado'};
   const dinero=n=>'$'+(Number(n)/100).toLocaleString('es-MX',{maximumFractionDigits:2});
   for(const [nombre,campo]of Object.entries(data.modelo.campos)){const p=document.createElement('p');const valor=['proteccionInicial','ahorro'].includes(nombre)?dinero(campo.valor):campo.valor+(nombre==='inflacion'?'%':'');p.textContent=(nombres[nombre]||nombre)+': '+valor+' · Fuente: '+campo.fuente;evidencias.append(p);}
   if(data.modelo.coberturas?.length){const h=document.createElement('h3');h.textContent='Coberturas identificadas en la ilustración';evidencias.append(h);
    for(const cobertura of data.modelo.coberturas){const p=document.createElement('p');p.textContent=cobertura.nombre+(cobertura.suma!==undefined?' · Suma inicial: '+dinero(cobertura.suma):cobertura.porcentaje!==undefined?' · '+cobertura.porcentaje+'% · Amparada':' · Amparada')+(cobertura.aportacion!==undefined?' · Aportación inicial anual: '+dinero(cobertura.aportacion):'');evidencias.append(p);}
   }
   const anios=$('retiro-anio');anios.replaceChildren();anios.disabled=!data.modelo.tablaValida;
   if(data.modelo.tablaValida){for(const fila of data.modelo.tabla)anios.add(new Option('Año '+fila.anio+' · Edad '+fila.edad,fila.anio));anios.value=String(Math.min(6,data.modelo.tabla.length));}
   else anios.add(new Option('Disponible al leer la tabla',''));
   const selector=$('retiro-pagina');selector.replaceChildren();for(let n=1;n<=paginas;n++)selector.add(new Option(n+' · '+(n===1?'Tu proyecto':n===2?'Escenarios de vida':n===3?'Tus números':'Tabla · continuación'),String(n)));$('retiro-total-paginas').textContent='El PDF incluye las '+paginas+' páginas.';
   const hitos=$('retiro-hitos');hitos.replaceChildren();
   if(modelo.tablaValida){const tabla=modelo.tabla,fin=tabla.findLast(f=>f.aportacion>0),equilibrio=tabla.find(f=>f.acumulado>0&&f.efectivo>=f.acumulado);$('retiro-deslizador').max=String(tabla.length);
    for(const [titulo,f]of [['Inicio',tabla[0]],['Última aportación',fin],['Recuperas lo aportado',equilibrio],['Vencimiento',tabla.at(-1)]]){if(!f)continue;const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=titulo+' · Año '+f.anio;b.addEventListener('click',()=>{anios.value=String(f.anio);explorar();mostrar();});hitos.append(b);}
   }
   selector.value='1';explorar();mostrar();actualizarDescarga();
   aviso((datosListos?'Ilustración leída: '+data.modelo.tabla.length+' años. ':'Hay datos por revisar en la ilustración. ')+(!datosListos?'La descarga se habilitará al validar los datos pendientes.':logos.quillum&&logos.gnp?'Revisa la vista previa y descarga tu propuesta PDF.':'Guarda los logos de QUILLUM y GNP para habilitar la descarga.'));
  }catch(e){aviso(e.message);}finally{$('retiro-cargar').disabled=false;}
 });
 $('retiro-cerrar').addEventListener('click',async()=>{try{await eliminar();$('retiro-vista').hidden=true;$('retiro-vista').removeAttribute('src');$('retiro-navegacion').hidden=true;$('retiro-form').reset();$('retiro-anio').disabled=true;$('retiro-incidencias').replaceChildren();$('retiro-evidencias').replaceChildren();aviso('Vista previa cerrada. Los logos permanecen guardados.');}catch(e){aviso(e.message);}});
 json('/api/retiro/logos').then(mostrarLogos).catch(e=>{$('retiro-logos-estado').textContent=e.message;});
})();
