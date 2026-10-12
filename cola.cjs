const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const idValido=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
class Cola {
  constructor(base,ejecutar) { this.base=base;this.ejecutar=ejecutar;this.jobs=new Map();this.ocupada=false;this.cerrada=false;this.escritura=Promise.resolve(); }
  carpeta(id) { if(!idValido(id)) throw new Error('Identificador inválido.');return path.join(this.base,'trabajos',id); }
  async guardar(job) {
    const dir=this.carpeta(job.id);await fs.mkdir(dir,{recursive:true});
    const temp=path.join(dir,'estado-'+crypto.randomUUID()+'.tmp');await fs.writeFile(temp,JSON.stringify(job,null,2));await fs.rename(temp,path.join(dir,'estado.json'));
  }
  async iniciar() {
    const root=path.join(this.base,'trabajos');await fs.mkdir(root,{recursive:true});
    for(const id of await fs.readdir(root)) {
      const prefijo='.eliminando-';
      if(id.startsWith(prefijo) && idValido(id.slice(prefijo.length))) {
        await fs.rm(path.join(root,id),{recursive:true,force:true});continue;
      }
      if(!idValido(id)) continue;
      let j;
      try { j=JSON.parse(await fs.readFile(path.join(root,id,'estado.json'),'utf8')); }
      catch { console.warn('Estado de trabajo no legible:',id);continue; }
      if(j.id!==id || !['pendiente','procesando','completada','error'].includes(j.estado)) continue;
      if(j.estado==='procesando') { j.estado='error';j.error='El servicio se reinició durante la cotización. Revisa el PDF disponible antes de reintentar.';await this.guardar(j); }
      this.jobs.set(id,j);
    }
    this.procesar();
  }
  crear(solicitud,tipo,pdf,idempotencia) {
    const tarea=this.escritura.then(()=>this.crearInterno(solicitud,tipo,pdf,idempotencia));
    this.escritura=tarea.catch(()=>{});return tarea;
  }
  async crearInterno(solicitud,tipo,pdf,idempotencia) {
    if(this.cerrada) throw new Error('El servicio está reiniciando. Intenta nuevamente.');
    const huella=crypto.createHash('sha256').update(JSON.stringify({solicitud,tipo})+(pdf?crypto.createHash('sha256').update(pdf).digest('hex'):'')).digest('hex');
    if(idempotencia) {
      const anterior=[...this.jobs.values()].find(j=>j.idempotencia===idempotencia);
      if(anterior) {
        if(anterior.huella!==huella) throw new Error('La misma solicitud ya se recibió con datos distintos.');
        return anterior;
      }
    }
    const id=crypto.randomUUID();const j={id,estado:'pendiente',tipo,solicitud,creadaEn:new Date().toISOString(),idempotencia,huella};
    await fs.mkdir(this.carpeta(id),{recursive:true});
    if(pdf) await fs.writeFile(path.join(this.carpeta(id),'gnp.pdf'),pdf);
    await this.guardar(j);this.jobs.set(id,j);this.procesar();return j;
  }
  async procesar() {
    if(this.ocupada || this.cerrada) return;this.ocupada=true;
    try {
      while(!this.cerrada) {
        const anterior=[...this.jobs.values()].find(j=>j.estado==='pendiente');if(!anterior)break;
        const j={...anterior,estado:'procesando',iniciadaEn:new Date().toISOString()};await this.guardar(j);this.jobs.set(j.id,j);
        try { const resultado=await this.ejecutar(j,this.carpeta(j.id));j.resultado=resultado;j.estado='completada';delete j.error; }
        catch(e) {j.estado='error';j.error=e.message||'No se pudo completar la cotización.';}
        j.terminadaEn=new Date().toISOString();await this.guardar(j);this.jobs.set(j.id,j);
      }
    } catch(e) {console.error('No se pudo guardar el estado de la cola. Revisa el volumen de datos.');}
    finally {this.ocupada=false;}
  }
  reintentar(id) {
    const tarea=this.escritura.then(()=>this.reintentarInterno(id));
    this.escritura=tarea.catch(()=>{});return tarea;
  }
  async reintentarInterno(id) {
    const anterior=this.jobs.get(id);if(!anterior || anterior.estado!=='error') throw new Error('Solo se puede reintentar un trabajo con error.');
    const j={...anterior,estado:'pendiente'};delete j.error;await this.guardar(j);this.jobs.set(id,j);this.procesar();return j;
  }
  eliminar(id) {
    const tarea=this.escritura.then(()=>this.eliminarInterno(id));
    this.escritura=tarea.catch(()=>{});return tarea;
  }
  async eliminarInterno(id) {
    const job=this.jobs.get(id);
    if(!job || !idValido(id)) throw new Error('Solicitud no encontrada.');
    if(!['completada','error'].includes(job.estado)) throw new Error('Espera a que termine la solicitud antes de eliminarla.');
    // Retirar la carpeta del historial de forma atómica antes de borrar los PDF.
    const dir=this.carpeta(id), temporal=path.join(this.base,'trabajos','.eliminando-'+id);
    try{await fs.rename(dir,temporal);}catch(e){if(e.code!=='ENOENT')throw e;}
    this.jobs.delete(id);
    await fs.rm(temporal,{recursive:true,force:true});
    return {id,eliminada:true};
  }
}
module.exports={Cola,idValido};
