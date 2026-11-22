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
