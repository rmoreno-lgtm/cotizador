const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function documento(logo, qr, datos) {
  const header = `<header><img class="logo" src="${logo}" alt="QUILLUM Seguros y Fianzas"><div class="insurer">PROPUESTA PERSONALIZADA<br><b>Aseguradora: GNP</b><br>Seguro Médico ${datos.plan}</div></header>`;
  const footer = n => `<footer>QUILLUM · Cotización GNP ${datos.folio} · Propuesta informativa<span>${n} / 3</span></footer>`;
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Propuesta QUILLUM ${datos.folio}</title>
<style>
@page { size:A4; margin:0; }
* { box-sizing:border-box; }
body { margin:0; color:#0a3052; font-family:Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:210mm; height:297mm; padding:12mm 16mm 18mm; position:relative; break-after:page; overflow:hidden; }
.page:last-child { break-after:auto; }
header { height:102px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #dce5ed; padding-bottom:12px; }
.logo { width:130px; height:88px; object-fit:contain; }
.insurer { font-size:10px; line-height:1.7; text-align:right; color:#506276; }
.eyebrow { margin:18px 0 8px; font-size:10px; letter-spacing:1px; color:#104b74; }
h1 { font-size:28px; line-height:1.15; margin:12px 0; }
h2 { font-size:16px; margin:18px 0 9px; }
h3 { font-size:12px; margin:0 0 6px; }
p,li { font-size:12px; line-height:1.5; color:#506276; margin:7px 0; }
.small { font-size:10px; line-height:1.45; }
.row { display:flex; gap:10px; }
.card { background:#f0f5f9; border-radius:10px; padding:13px; flex:1; }
.card strong { font-size:17px; display:block; margin:7px 0; }
.card p { font-size:11px; }
.hero { background:#0a3052; border-radius:12px; padding:17px 20px; color:white; margin:18px 0 10px; display:flex; justify-content:space-between; align-items:center; }
.hero strong { display:block; font-size:32px; margin-top:6px; }
.hero p { color:white; font-size:11px; }
.strip { border-left:4px solid #ef8924; background:#f8fafc; padding:12px 15px; margin-top:15px; }
.strip p { font-size:11px; }
table { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; }
td,th { text-align:left; padding:10px; }
th { background:#0a3052; color:white; font-size:11px; }
tr:nth-child(even) { background:#f0f5f9; }
.amount { text-align:right; white-space:nowrap; }
.example { border-radius:10px; background:#f0f5f9; padding:14px; margin-top:16px; }
.example table { margin:6px 0; font-size:11px; }
.example td { padding:6px; }
.example b { font-size:12px; }
.contact { display:flex; gap:18px; align-items:center; padding:16px; background:#0a3052; color:white; border-radius:12px; margin-top:20px; }
.contact img { width:98px; height:98px; background:white; }
.contact p { color:white; }
.contact a { color:white; text-decoration:none; font-weight:bold; font-size:20px; }
footer { position:absolute; left:16mm; right:16mm; bottom:11mm; border-top:1px solid #dce5ed; padding-top:9px; font-size:9px; color:#506276; }
footer span { float:right; }
.eyebrow { border-left:3px solid #ef8924; padding-left:9px; }
.hero { border-left:6px solid #ef8924; }
.difference { color:#8b4009; background:#fff1e3; padding:8px; border-left:3px solid #ef8924; font-size:11px; }
.comparison tr:last-child { background:#fff1e3; }
.example { padding:12px; margin-top:12px; }
.example td { padding:5px; }
.keybenefits { display:flex; gap:10px; margin:10px 0; }
.keybenefit { flex:1; border-left:3px solid #ef8924; background:#fff1e3; border-radius:6px; padding:8px 10px; }
.keybenefit p { font-size:10px; line-height:1.35; margin:4px 0 0; }
.keybenefit h3 { font-size:11px; margin:0; }
.asistencias .card { border-top:3px solid #ef8924; }
.asistencias h3 { color:#104b74; font-size:13px; }
</style>
<section class="page">${header}
<div class="eyebrow">01 / PROTECCIÓN Y ACOMPAÑAMIENTO</div>
<h1>Tu protección médica,<br>con el respaldo de QUILLUM.</h1>
<p>Preparada para <b>${datos.nombre}</b>.<br>${datos.perfilHtml}</p>
${datos.beneficiosHtml || ""}
<div class="row">
<div class="card"><h3>Suma asegurada básica</h3><strong>$${datos.suma}</strong><p>Por año póliza, por asegurado.</p></div>
<div class="card"><h3>Tu configuración</h3><strong>Acceso ${datos.acceso}</strong><p>Tabulador médico ${datos.tabulador}. Participación variable según nivel hospitalario.</p></div>
</div>
<h2>También te acompaña en el día a día</h2>
<div class="row asistencias">
<div class="card"><h3>Asistencia dental</h3><p>${datos.dentalHtml}</p></div>
<div class="card"><h3>Apoyo psicológico</h3><p>${datos.psicologicaHtml}</p></div>
<div class="card"><h3>Médica Móvil</h3><p>${datos.movilHtml}</p></div>
</div>
<p class="small">Aplican condiciones, disponibilidad y alcance de cada servicio.</p>
<div class="hero"><div><small>INVERSIÓN ANUAL TOTAL · MXN</small><strong>$${datos.total}</strong></div><p>Pago anual.<br>Incluye derecho de póliza e IVA.</p></div>
<p class="small">Prima neta: $${datos.neta} · Derecho de póliza: $${datos.derecho} · IVA: $${datos.iva}.<br>Recargo por pago fraccionado: $${datos.recargo} · Descuento por Solidez Familiar${datos.descuentoIncluidoEnNeta ? ' (ya aplicado)' : ''}: $${datos.descuento}.</p>
<div class="strip"><h3>El respaldo de QUILLUM, cuando más lo necesitas</h3><p>Te acompañamos en la programación de cirugías, la gestión de reembolsos y el seguimiento durante tu hospitalización.</p></div>
<p class="small">Cotizada: ${datos.fecha} · Válida hasta: ${datos.vence}.<br>Asesor registrado en GNP: ${datos.agente}.</p>
${footer(1)}</section>

<section class="page">${header}
<div class="eyebrow">02 / CUÁNTO PARTICIPARÍAS AL USAR TU SEGURO</div>
<h1>Deducible y coaseguro,<br>explicados con claridad.</h1>
<p><b>Deducible:</b> cantidad inicial a tu cargo en los gastos cubiertos. GNP lo indica por año, por padecimiento.</p>
<p><b>Coaseguro:</b> porcentaje de los gastos cubiertos después de descontar el deducible. Tiene un tope según el nivel hospitalario.</p>
<table><tr><th>Nivel hospitalario</th><th>Deducible</th><th>Coaseguro</th><th>Tope</th></tr>
${datos.tablaHtml}</table>
<p class="small">El nivel hospitalario A–D y el tabulador médico D son distintos. El tabulador define los honorarios médicos reconocidos.</p>
${datos.comparacionHtml}
${datos.topeHtml}
<p class="small">Estos ejemplos son para una enfermedad cubierta y suponen que aún no has pagado el deducible. Solo consideran gastos reconocidos por GNP. Gastos no cubiertos, diferencias de honorarios u otras participaciones se pagan aparte. El tope limita únicamente el coaseguro. En accidentes cubiertos con Cero Deducible no pagas ese deducible; aplican las demás condiciones del seguro.</p>
${footer(2)}</section>

<section class="page">${header}
<div class="eyebrow">03 / TU PLAN Y EL SERVICIO DE TU DESPACHO</div>
<h1>Respaldo para tu salud.<br>Acompañamiento para ti.</h1>
<h2>Coberturas descritas en tu cotización</h2>
<p>La cobertura básica contempla diagnóstico, honorarios médicos, hospitalización, cirugía, medicamentos y rehabilitación, conforme a condiciones y límites.</p>
<div class="card">
<h3>Adicionales expresamente descritos por GNP</h3>
<p>${datos.adicionalesHtml}</p>
</div>
<p class="small">${datos.altaHtml}</p>
<h2>El respaldo de QUILLUM</h2>
<p>Te acompañamos en la programación de cirugías, la gestión de reembolsos y el seguimiento durante tu hospitalización.</p>
<p>Contamos con convenios con <b>Grupo Muguerza, Grupo Auna, Grupo Ángeles y Hospitaria, entre otros</b>, que nos permiten coordinar la atención y facilitar la gestión de trámites.</p>
<p class="small">El acceso y la cobertura están sujetos al plan contratado, al hospital y a la autorización de GNP. Los convenios del despacho no amplían la cobertura de la póliza.</p>
<div class="contact">
<img src="${qr}" alt="QR de WhatsApp">
<div><h3>Revisemos juntos tu propuesta</h3>
<p>Escanea el QR o pulsa el número.</p>
<a href="https://wa.me/528180202414">81 80 20 24 14</a></div>
</div>
<p class="small">Antes de contratar, confirma hospitales, coberturas, exclusiones y periodos de espera. GNP menciona, entre otros, preexistencias, enfermedades iniciadas durante los primeros 30 días y tratamientos experimentales.</p>
<p class="small">Resumen de la cotización GNP ${datos.folio}. Es informativo y no es una póliza. La aceptación, tarifa y alcance están sujetos a suscripción y condiciones contractuales. Conserva el PDF original de GNP junto con este resumen.</p>
${footer(3)}</section></html>`;
}

async function generarPropuesta(datos, opciones = {}) {
  if (!datos || datos.schemaVersion !== 1 || !datos.folio || (!datos.tablaHtml && !(opciones.documento && Array.isArray(datos.opciones) && datos.opciones.every(d=>d.schemaVersion===1)))) {
    throw new Error('Faltan datos verificados. Usa el cotizador o integracion.cjs con el PDF de GNP y su solicitud.');
  }
  const baseDir = opciones.baseDir || __dirname;
  const logoPath = opciones.logoPath || path.join(baseDir, 'logo-quillum.png');
  const buffer = await fs.readFile(logoPath);
  if (!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw new Error('El logo no es un PNG real. Expórtalo como PNG desde Vista Previa.');
  }
  const QR = require('qrcode');
  const svg = await QR.toString('https://wa.me/528180202414', {
    type: 'svg', margin: 4, errorCorrectionLevel: 'M'
  });
  const qr = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const logo = 'data:image/png;base64,' + buffer.toString('base64');
  const carpeta = path.join(baseDir, 'propuestas');
  await fs.mkdir(carpeta, { recursive: true });
  const nombre = path.join(carpeta, opciones.nombreSalida || `QUILLUM-${datos.folio}-${Date.now()}`);
  const html = (opciones.documento || documento)(logo, qr, datos);
  await fs.writeFile(nombre + '.html', html);
  const browser = await chromium.launch({ headless: true, ...(opciones.executablePath ? {executablePath: opciones.executablePath} : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(async img => {
        await img.decode();
        if (!img.naturalWidth) throw new Error('No se pudo cargar el logo o el QR.');
      }));
    });
    const invade = await page.evaluate(() =>
      [...document.querySelectorAll('.page')].some(p => {
        const limite = p.querySelector('footer').getBoundingClientRect().top;
        return [...p.children]
          .filter(e => e.tagName !== 'FOOTER')
          .some(e => e.getBoundingClientRect().bottom > limite - 5);
      })
    );
    if (invade) throw new Error('El contenido invade el pie de página.');
    await page.pdf({
      path: nombre + '.pendiente.pdf',
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
  await fs.rename(nombre + '.pendiente.pdf', nombre + '.pdf');

  if (process.platform === 'darwin' && opciones.abrir !== false) {
    try { execFileSync('open', [nombre + '.pdf']); }
    catch { console.warn('El PDF se guardó, pero no se pudo abrir automáticamente.'); }
  }
  return nombre + '.pdf';
}

module.exports = { generarPropuesta, documento };
if (require.main === module) {
  const [pdf, solicitud] = process.argv.slice(2);
  if (!pdf || !solicitud) {
    console.log('Para una nueva cotización: node cotizar.cjs');
    console.log('Para regenerar: node propuesta.cjs "cotizacion.pdf" "solicitud.json"');
  } else {
    fs.readFile(solicitud, 'utf8').then(JSON.parse)
      .then(s => require('./integracion.cjs').generarDesdePdf(pdf, s.solicitud || s))
      .catch(e => { console.error(e.message); process.exitCode = 1; });
  }
}
