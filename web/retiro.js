(()=>{
 const $=id=>document.getElementById(id);let borrador;
 const aviso=t=>{$('retiro-estado').textContent=t;};
 async function eliminar(){if(borrador){await fetch('/api/retiro/'+borrador,{method:'DELETE'});borrador=undefined;}}
 function mostrar(){if(borrador)$('retiro-vista').src='/api/retiro/'+borrador+'/vista?enfoque='+encodeURIComponent($('retiro-enfoque').value)+(!$('retiro-anio').disabled?'&anio='+$('retiro-anio').value:'');}
 $('retiro-enfoque').addEventListener('change',mostrar);
 $('retiro-anio').addEventListener('change',mostrar);
 $('retiro-form').addEventListener('submit',async event=>{
  event.preventDefault();$('retiro-cargar').disabled=true;aviso('Leyendo ilustración…');
  try{
   await eliminar();$('retiro-vista').hidden=true;
   const body=new FormData($('retiro-form'));
   const r=await fetch('/api/retiro/preview',{method:'POST',body});
   if(r.status===401){location.assign('/login');return;}
   const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo leer la ilustración.');
   borrador=data.id;
   const lista=$('retiro-incidencias');lista.replaceChildren();
   for(const texto of data.modelo.incidencias){const li=document.createElement('li');li.textContent=texto;lista.append(li);}
   const evidencias=$('retiro-evidencias');evidencias.replaceChildren();
   for(const [nombre,campo]of Object.entries(data.modelo.campos)){const p=document.createElement('p');p.textContent=nombre+': '+campo.valor+' · Texto detectado: '+campo.fuente;evidencias.append(p);}
   const anios=$('retiro-anio');anios.replaceChildren();anios.disabled=!data.modelo.tablaValida;
   if(data.modelo.tablaValida){for(const fila of data.modelo.tabla)anios.add(new Option('Año '+fila.anio+' · Edad '+fila.edad,fila.anio));anios.value=String(Math.min(6,data.modelo.tabla.length));}
   else anios.add(new Option('Disponible al leer la tabla',''));
   mostrar();$('retiro-vista').hidden=false;
   aviso('Borrador disponible durante 30 minutos. Revisa el texto detectado; la extracción aún necesita validarse con una ilustración real. La generación final está pendiente.');
  }catch(e){aviso(e.message);}finally{$('retiro-cargar').disabled=false;}
 });
 $('retiro-cerrar').addEventListener('click',async()=>{try{await eliminar();$('retiro-vista').hidden=true;$('retiro-vista').removeAttribute('src');$('retiro-form').reset();$('retiro-anio').disabled=true;$('retiro-incidencias').replaceChildren();$('retiro-evidencias').replaceChildren();aviso('Borrador eliminado.');}catch{aviso('No se pudo cerrar el borrador.');}});
})();
