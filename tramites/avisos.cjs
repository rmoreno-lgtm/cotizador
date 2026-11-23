// Envío de avisos por correo (API de Resend) y WhatsApp (API de WhatsApp Business de Meta).
// Se usan APIs HTTPS con fetch para no agregar dependencias ni depender de SMTP.

function canales(env) {
  return {
    correo:Boolean(env.RESEND_API_KEY && env.AVISOS_CORREO_REMITENTE),
    whatsapp:Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_PLANTILLA)
  };
}

async function respuestaError(res,servicio) {
  let detalle='';
  try {detalle=JSON.stringify(await res.json()).slice(0,300);} catch {}
  return new Error(servicio+' respondió '+res.status+(detalle?': '+detalle:''));
}

async function enviarCorreo(env,destinatarios,{asunto,texto,html},hacerFetch=fetch) {
  const res=await hacerFetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:env.AVISOS_CORREO_REMITENTE,to:destinatarios,subject:asunto,text:texto,html}),
    signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)throw await respuestaError(res,'El servicio de correo');
}

async function enviarWhatsapp(env,numero,mensaje,hacerFetch=fetch) {
  const version=env.WHATSAPP_API_VERSION || 'v21.0';
  const res=await hacerFetch('https://graph.facebook.com/'+version+'/'+encodeURIComponent(env.WHATSAPP_PHONE_ID)+'/messages',{
    method:'POST',
    headers:{Authorization:'Bearer '+env.WHATSAPP_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify({
      messaging_product:'whatsapp',to:numero,type:'template',
      template:{name:env.WHATSAPP_PLANTILLA,language:{code:env.WHATSAPP_IDIOMA || 'es_MX'},
        components:[{type:'body',parameters:[{type:'text',text:mensaje}]}]}
    }),
    signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)throw await respuestaError(res,'WhatsApp');
}

// Envía por todos los canales configurados de la regla. Nunca lanza: devuelve el resultado por canal.
async function enviarAviso(env,regla,aviso,hacerFetch=fetch) {
  const disponibles=canales(env);
  const resultado={correo:null,whatsapp:[]};
  if(regla.correos.length){
    if(!disponibles.correo)resultado.correo={ok:false,error:'Correo no configurado en Railway.'};
    else {
      try {await enviarCorreo(env,regla.correos,aviso,hacerFetch);resultado.correo={ok:true};}
      catch(error){resultado.correo={ok:false,error:error.message};}
    }
  }
  for(const numero of regla.whatsapp){
    if(!disponibles.whatsapp){resultado.whatsapp.push({numero,ok:false,error:'WhatsApp no configurado en Railway.'});continue;}
    try {await enviarWhatsapp(env,numero,aviso.whatsapp,hacerFetch);resultado.whatsapp.push({numero,ok:true});}
    catch(error){resultado.whatsapp.push({numero,ok:false,error:error.message});}
  }
  return resultado;
}

module.exports={canales,enviarAviso,enviarCorreo,enviarWhatsapp};
