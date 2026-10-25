(()=>{
 const titulos={inicio:'Inicio','gastos-medicos':'Gastos Médicos',retiro:'Retiro',ppr:'PPR',educacion:'Educación',trasciende:'Ahorro e inversión · Trasciende',total:'Total'};
 function navegar(foco=false){
  const hash=location.hash.slice(1);const clave=hash==='vida'?'retiro':hash;const seccion=Object.hasOwn(titulos,clave)?clave:'inicio';
  for(const panel of document.querySelectorAll('[data-pantalla]'))panel.hidden=panel.dataset.pantalla!==seccion;
  for(const enlace of document.querySelectorAll('[data-seccion]')){
   if(enlace.dataset.seccion===seccion)enlace.setAttribute('aria-current','page');else enlace.removeAttribute('aria-current');
  }
  document.getElementById('ubicacion').textContent=titulos[seccion];document.title=titulos[seccion]+' · QUILLUM';if(['retiro','ppr','educacion','trasciende','total'].includes(seccion))document.getElementById('menu-vida-ahorro').open=true;
  if(foco){window.scrollTo(0,0);document.getElementById('titulo-'+seccion).focus({preventScroll:true});}
 }
 window.addEventListener('hashchange',()=>navegar(true));navegar();
})();
