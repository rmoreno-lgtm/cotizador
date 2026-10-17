function icono(simbolo){
 const rutas={
  '☀':'<circle cx="24" cy="24" r="9"/><path d="M24 2v7m0 30v7M2 24h7m30 0h7M8 8l5 5m22 22 5 5M8 40l5-5m22-22 5-5"/>',
  '↗':'<path d="M6 39h36M11 34V22h6v12m6 0V16h6v18m6 0V8h6v26M9 15 23 7h-8m8 0-2 8"/>',
  '♡':'<path d="M24 40 7 24C-3 13 13 1 24 14 35 1 51 13 41 24Z"/>',
  '◇':'<path d="M24 3 42 11v13c0 12-18 21-18 21S6 36 6 24V11Z"/><path d="m15 24 6 6 13-15"/>',
  '♙':'<circle cx="24" cy="12" r="8"/><path d="M10 43v-9c0-16 28-16 28 0v9Z"/>',
  '▤':'<ellipse cx="31" cy="10" rx="12" ry="5"/><path d="M19 10v19c0 7 24 7 24 0V10m-24 7c0 7 24 7 24 0m-24 7c0 7 24 7 24 0"/><ellipse cx="15" cy="29" rx="12" ry="5"/><path d="M3 29v10c0 7 24 7 24 0V29m-24 5c0 7 24 7 24 0"/>',
  '▦':'<rect x="6" y="9" width="36" height="34" rx="3"/><path d="M6 20h36M15 3v13M33 3v13m-21 9h4m6 0h4m6 0h4m-24 8h4m6 0h4m6 0h4"/>',
  '✓':'<rect x="6" y="9" width="36" height="34" rx="3"/><path d="M6 20h36M15 3v13M33 3v13m-18 16 7 5 12-12"/>'
 };
 return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${rutas[simbolo]||rutas['◇']}</svg>`;
}
module.exports={icono};
