(()=>{
  const elemento=id=>document.getElementById('tramites-'+id);
  const boton=elemento('actualizar');
  const mensaje=elemento('mensaje');
  const formato=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'});
  let temporizador;
  let pendiente=false;

  function mostrar({configurado,enCurso,error,ultimaConsulta,exploracion}) {
    boton.disabled=!configurado || enCurso;
    mensaje.textContent=error || (enCurso?'Consultando GNP…':configurado
      ? (ultimaConsulta?'':'Aún no se ha consultado GNP.')
      : 'La consulta requiere las credenciales de GNP en Railway.');
    elemento('exploracion').hidden=!exploracion.length;
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

  boton.addEventListener('click',async()=>{
    boton.disabled=true;
    mensaje.textContent='Iniciando consulta…';
    try {
      const respuesta=await fetch('/api/tramites/actualizar',{method:'POST'});
      if(!respuesta.ok)throw new Error();
    } catch {
      mensaje.textContent='No se pudo iniciar la consulta. Vuelve a intentarlo.';
      boton.disabled=false;
      return;
    }
    await cargar();
  });
  window.addEventListener('hashchange',cargar);
  void cargar();
})();
