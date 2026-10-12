const url = new URL('/healthz', process.env.PUBLIC_URL);
const esperado = process.env.GITHUB_SHA;
if (url.protocol !== 'https:' || !/^[a-f0-9]{40}$/.test(esperado || '')) {
  throw new Error('Faltan la URL HTTPS pública o el identificador del commit.');
}
async function verificar() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      const d = await r.json();
      if (r.ok && d.ok && d.configurada && d.version === esperado) {
        console.log('La nueva versión responde y tiene configurada su clave de acceso.');
        return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error('La nueva versión no respondió a tiempo. Revisa Deployments en Railway; no se confirma el despliegue.');
}
verificar().catch(e => { console.error(e.message); process.exitCode = 1; });
