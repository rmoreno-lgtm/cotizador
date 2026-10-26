(()=>{
 const $=id=>document.getElementById(id);let id,modelo,listo=false,leyendo=false,descargando=false,logos={quillum:false,gnp:false},urlPreparado,paginas={resumida:2,detallada:3};
 const dinero=n=>'$'+(Number(n)/100).toLocaleString('es-MX',{minimumFractionDigits:Number(n)%100?2:0,maximumFractionDigits:2});
 const aviso=t=>{$('ppr-estado').textContent=t;};
 async function json(url,options){const r=await fetch(url,options);if(r.status===401){location.assign('/login');throw Error('Inicia sesión.');}const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar la solicitud.');return d;}
 function limpiarArchivo(){if(urlPreparado)URL.revokeObjectURL(urlPreparado);urlPreparado=undefined;$('ppr-descarga-enlace').hidden=true;$('ppr-descarga-enlace').removeAttribute('href');$('ppr-descarga-estado').textContent='';}
 function actualizar(){
  $('ppr-descargar').disabled=!id||!listo||!logos.quillum||!logos.gnp||descargando||leyendo;
  $('ppr-motivo').textContent=!listo?'Revisa los datos pendientes antes de descargar.':!logos.quillum||!logos.gnp?'Guarda los logotipos de QUILLUM y GNP para descargar.':descargando?'Preparando PDF…':'Ejercicio ilustrativo al 30%. La descarga incluye todas las páginas del formato seleccionado.';
 }
 function mostrarLogos(l){logos={quillum:!!l.quillum,gnp:!!l.gnp};$('ppr-logos-estado').textContent='QUILLUM: '+(logos.quillum?'guardado':'pendiente')+' · GNP: '+(logos.gnp?'guardado':'pendiente');$('ppr-logos').open=!logos.quillum||!logos.gnp;actualizar();}
 function parametros(){return new URLSearchParams({formato:$('ppr-formato').value,anio:$('ppr-anio').value});}
 function actualizarPaginas(){const s=$('ppr-pagina'),anterior=+s.value||1;s.replaceChildren();for(let n=1;n<=paginas[$('ppr-formato').value];n++)s.add(new Option(n+' · '+(n===1?'Tu plan':n===2?'Ejercicio fiscal':'Tabla anual'),n));s.value=String(Math.min(anterior,s.options.length));}
 function mostrar(){if(!id||!listo){$('ppr-vista').hidden=true;return;}const frame=$('ppr-vista');frame.hidden=false;const ancho=Math.max(280,Math.min(2000,frame.clientWidth||818));const q=parametros();q.set('pagina',$('ppr-pagina').value);q.set('ancho',ancho);frame.hidden=false;frame.style.height=Math.ceil(1180*Math.min(1,(ancho-24)/794)+32)+'px';frame.src='/api/ppr/'+id+'/vista?'+q;}
 async function eliminar(){limpiarArchivo();if(id)await json('/api/ppr/'+id,{method:'DELETE'});id=undefined;modelo=undefined;listo=false;$('ppr-vista').hidden=true;$('ppr-vista').removeAttribute('src');$('ppr-controles').hidden=true;actualizar();}
 $('ppr-form').addEventListener('submit',async event=>{
  event.preventDefault();leyendo=true;$('ppr-cargar').disabled=true;aviso('Leyendo Consolida…');actualizar();
  try{await eliminar();const d=await json('/api/ppr/preview',{method:'POST',body:new FormData($('ppr-form'))});id=d.id;modelo=d.modelo;listo=d.datosListos;paginas=d.paginasPorFormato;$('ppr-enfoque').value=d.textos.enfoque;$('ppr-titulo').value=d.textos.titulo;$('ppr-subtitulo').value=d.textos.subtitulo;mostrarLogos(d.logos);
   const datos=$('ppr-evidencias'),lista=$('ppr-incidencias');datos.replaceChildren();lista.replaceChildren();
   const etiquetas={cliente:'Cliente',edad:'Edad inicial',edadVencimiento:'Edad de vencimiento',plazoPago:'Años de aportaciones',plazoPlan:'Plazo del plan',inflacion:'Inflación considerada',moneda:'Moneda',aportacion:'Aportación inicial',ahorro:'Recuperación final proyectada'};
   for(const [k,v]of Object.entries(modelo.campos)){const p=document.createElement('p');p.textContent=etiquetas[k]+': '+(['aportacion','ahorro'].includes(k)?dinero(v.valor):v.valor)+(k==='inflacion'?'%':'')+' · Fuente: '+v.fuente;datos.append(p);}
   for(const t of modelo.incidencias){const li=document.createElement('li');li.textContent=t;lista.append(li);}
   if(d.ejercicio){const f=d.ejercicio.filas[0],p=document.createElement('p');p.textContent='Primer año · Monto para deducción: '+dinero(f.deducible)+' · Beneficio supuesto al 30%: '+dinero(f.beneficio)+' · Desembolso neto ilustrativo: '+dinero(f.neto);datos.append(p);}
   $('ppr-anio').replaceChildren();for(const f of modelo.tabla.filter(f=>f.aportacion>0))$('ppr-anio').add(new Option('Año '+f.anio+' · '+f.edad+' años',f.anio));actualizarPaginas();$('ppr-pagina').value='1';$('ppr-controles').hidden=false;mostrar();if(!listo)$('ppr-revision').open=true;
   aviso(listo?'PPR leído. Revisa la propuesta y el supuesto fiscal del 30%.':'Hay datos por revisar. La descarga se habilitará cuando la lectura sea válida.');
  }catch(e){aviso(e.message);}finally{leyendo=false;$('ppr-cargar').disabled=false;actualizar();}
 });
 $('ppr-logos-form').addEventListener('submit',async event=>{event.preventDefault();$('ppr-guardar-logos').disabled=true;try{const d=await json('/api/retiro/logos',{method:'POST',body:new FormData($('ppr-logos-form'))});limpiarArchivo();mostrarLogos(d);$('ppr-logos-form').reset();mostrar();}catch(e){$('ppr-logos-estado').textContent=e.message;}finally{$('ppr-guardar-logos').disabled=false;}});
 async function guardarTextos(sugerir=false){if(!id)return;const actual=id;const d=await json('/api/ppr/'+id+'/textos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enfoque:$('ppr-enfoque').value,titulo:sugerir?'':$('ppr-titulo').value,subtitulo:sugerir?'':$('ppr-subtitulo').value})});if(id!==actual)return;limpiarArchivo();$('ppr-titulo').value=d.titulo;$('ppr-subtitulo').value=d.subtitulo;$('ppr-textos-estado').textContent='Textos aplicados.';$('ppr-pagina').value='1';mostrar();}
 $('ppr-aplicar-textos').addEventListener('click',()=>guardarTextos().catch(e=>{$('ppr-textos-estado').textContent=e.message;}));
 $('ppr-enfoque').addEventListener('change',()=>guardarTextos(true).catch(e=>{$('ppr-textos-estado').textContent=e.message;}));
 for(const k of ['ppr-titulo','ppr-subtitulo'])$(k).addEventListener('input',()=>{limpiarArchivo();$('ppr-textos-estado').textContent='Texto pendiente: pulsa Aplicar textos antes de descargar.';});
 $('ppr-formato').addEventListener('change',()=>{limpiarArchivo();actualizarPaginas();mostrar();});
 $('ppr-anio').addEventListener('change',()=>{limpiarArchivo();$('ppr-pagina').value='2';mostrar();});
 $('ppr-pagina').addEventListener('change',mostrar);
 $('ppr-cerrar').addEventListener('click',async()=>{try{await eliminar();$('ppr-form').reset();$('ppr-evidencias').replaceChildren();$('ppr-incidencias').replaceChildren();aviso('Borrador PPR cerrado. Los logos permanecen guardados.');}catch(e){aviso(e.message);}});
 $('ppr-descargar').addEventListener('click',async()=>{
  if(!id||!listo||descargando||leyendo)return;const actual=id;descargando=true;limpiarArchivo();actualizar();$('ppr-descarga-estado').textContent='Preparando la propuesta PPR…';
  try{await guardarTextos();const r=await fetch('/api/ppr/'+actual+'/pdf?'+parametros());if(r.status===401){location.assign('/login');return;}if(!r.ok){const d=await r.json();throw Error(d.error||'No se pudo generar el PDF.');}const blob=await r.blob();if(!r.headers.get('Content-Type')?.includes('application/pdf')||await blob.slice(0,5).text()!=='%PDF-')throw Error('El servidor no devolvió un PDF válido.');if(id!==actual)return;urlPreparado=URL.createObjectURL(blob);const a=$('ppr-descarga-enlace');a.href=urlPreparado;a.hidden=false;a.click();$('ppr-descarga-estado').textContent='PDF preparado. Si no comenzó la descarga, pulsa «Guardar PDF preparado».';}catch(e){if(id===actual)$('ppr-descarga-estado').textContent=e.message;}finally{descargando=false;actualizar();}
 });
 let anchoAnterior=0,temporizador;new ResizeObserver(e=>{const ancho=Math.round(e[0].contentRect.width);if(Math.abs(ancho-anchoAnterior)<8)return;anchoAnterior=ancho;clearTimeout(temporizador);temporizador=setTimeout(mostrar,150);}).observe($('ppr-vista').parentElement);
 json('/api/retiro/logos').then(mostrarLogos).catch(e=>{$('ppr-logos-estado').textContent=e.message;});
})();
