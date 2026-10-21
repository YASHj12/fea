// FORM / FEA calculators — catalog renderer, search/favourites, enlarged calculator studio,
// local input persistence, tables and SVG plots.
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = globalThis.CalcMath.formatNumber;
  const categories = new Map((globalThis.CALCULATOR_CATEGORIES || []).map(c => [c.id, c]));
  const calculators = globalThis.CALCULATORS || [];
  const byId = new Map(calculators.map(c => [c.id, c]));
  const pageCategory = document.body.dataset.calcCategory || '';
  const isDirectory = document.body.dataset.calcPage === 'directory';
  let activeFilter = 'all';
  let currentCalc = null;
  let lastOutcome = null;
  let lastFocus = null;

  const storage = {
    read(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };
  const favouriteKey = 'formFea.calculators.favourites.v1';
  const recentKey = 'formFea.calculators.recent.v1';
  const inputKey = id => `formFea.calculator.${id}.v1`;
  const favourites = new Set(storage.read(favouriteKey, []));
  let recent = storage.read(recentKey, []);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const catName = id => categories.get(id)?.name || id;
  const catFile = id => categories.get(id)?.file || 'calculators.html';
  const prettyOption = value => String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  // Calculator-only icon library. Each folder and calculator has a pictogram tied to
  // the physical system, graph, component or tensor concept it represents.
  const iconText = (x, y, text, size = 8) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="${size}" font-weight="700" fill="currentColor" stroke="none">${text}</text>`;
  const iconDot = (cx, cy, r = 1.5) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;
  const CALC_ICONS = {
    'cat-thermodynamics': `<path d="M16 5h5v22a8 8 0 1 1-5 0Z"/><path d="M18.5 13v19"/><circle cx="33" cy="12" r="4"/><circle cx="40" cy="22" r="3"/><circle cx="31" cy="25" r="2.5"/><path d="M29 15l-5 6M36 20l3-5"/>`,
    'cat-fluid-dynamics': `<path d="M4 13c8-6 14 4 24-1l11-3"/><path d="M35 5l5 3-4 5"/><path d="M4 25h24c7 0 9-4 14-4"/><path d="M4 37c8 5 14-4 24 1l11 3"/><path d="M35 43l5-3-4-5"/>`,
    'cat-cfd': `<rect x="6" y="7" width="36" height="34"/><path d="M18 7v34M30 7v34M6 18h36M6 30h36M6 41L18 30l12-12 12-11M6 7l12 11 12 12 12 11"/><path d="M14 24c6-7 13 3 20-3"/><path d="M31 17l4 3-4 3"/>`,
    'cat-hvac': `<rect x="5" y="8" width="38" height="32" rx="3"/><circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="2.6"/><path d="M24 21c-1-5 1-8 6-10 1 5-1 9-6 10Z"/><path d="M27 26c5-1 8 1 10 6-5 1-9-1-10-6Z"/><path d="M21 26c-5-1-8 1-10 6 5 1 9-1 10-6Z"/>`,
    'cat-piping-process': `<path d="M4 31h18a8 8 0 0 0 8-8V11"/><path d="M4 39h18a16 16 0 0 0 16-16V11"/><path d="M11 31l10 8V31l-10 8Z"/><path d="M16 31V20M10 20h12"/><circle cx="35" cy="8" r="3.5"/>`,
    'cat-heat-exchangers': `<rect x="5" y="15" width="38" height="20" rx="5"/><path d="M8 21h32M8 25h32M8 29h32"/><path d="M13 15V7h8M35 35v8h-8"/><path d="M19 11h7M24 9l3 2-3 2M29 39h-7M24 37l-3 2 3 2"/>`,
    'cat-mechanical-elements': `<circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="3.5"/><path d="M24 5v8M24 35v8M5 24h8M35 24h8M11 11l5 5M32 32l5 5M37 11l-5 5M16 32l-5 5"/>`,
    'cat-structural-analysis': `<path d="M6 18h36"/><path d="M8 18c9 10 23 10 32 0"/><path d="M24 5v10M20 11l4 4 4-4"/><path d="M9 20l-4 9h10l-4-9M39 20l-4 9h10l-4-9"/><path d="M7 38h34M12 38l-3 5M21 38l-3 5M30 38l-3 5M39 38l-3 5"/>`,
    'cat-fea-tools': `<path d="M8 8h24l9 10-5 22H13L6 22Z"/><path d="M8 8l13 14 11-14-4 16 8 16M21 22l15 18M21 22H6l15 12 7-10h13"/><circle cx="8" cy="8" r="2"/><circle cx="32" cy="8" r="2"/><circle cx="21" cy="22" r="2"/><circle cx="36" cy="40" r="2"/>`,

    'ideal-gas': `<rect x="9" y="14" width="26" height="28" rx="5"/><path d="M19 14V9h6v5"/><circle cx="36" cy="12" r="6"/><path d="M36 12l3-3"/>${iconDot(16,24)}${iconDot(25,29)}${iconDot(19,36)}${iconDot(29,20)}${iconDot(30,37)}${iconText(22,11,'PV',7)}`,
    'Reynolds-flow': `<rect x="4" y="15" width="40" height="20"/><path d="M6 20h16M6 25h18M6 30h16"/><path d="M23 20c5-4 10 3 15-1M24 30c5 4 9-4 14 0"/><path d="M28 24c3-3 8 0 13 1"/>${iconText(13,11,'Re',8)}`,
    'Nusselt-heat': `<path d="M5 39h38"/><path d="M9 39v-5h30v5"/><path d="M13 29c-3-4 3-6 0-11M22 29c-3-4 3-6 0-11M31 29c-3-4 3-6 0-11"/><path d="M11 19l2-3 2 3M20 19l2-3 2 3M29 19l2-3 2 3"/>${iconText(39,13,'Nu',8)}`,
    'turbulence-inlet': `<path d="M4 10v28M4 17h11M4 24h14M4 31h11"/><path d="M12 14l3 3-3 3M15 21l3 3-3 3M12 28l3 3-3 3"/><path d="M27 16c6-5 13 1 9 6-3 4-10 1-7-3 2-3 6-1 5 2"/><path d="M24 34c6-5 14 0 11 6-3 4-10 1-8-3"/>${iconText(38,10,'k–ε',7)}`,
    'courant-time': `<rect x="6" y="7" width="28" height="28"/><path d="M20 7v28M6 21h28"/><path d="M10 15h19M25 11l4 4-4 4"/><circle cx="37" cy="38" r="7"/><path d="M37 34v4l3 2"/>${iconText(13,43,'CFL',7)}`,
    'rotor-step': `<circle cx="24" cy="25" r="5"/><path d="M24 20c0-7 3-11 8-13 2 6-1 11-8 13Z"/><path d="M28 28c6 3 11 2 15-1-3 6-9 7-15 1Z"/><path d="M20 28c-6 3-11 2-15-1 3 6 9 7 15 1Z"/><path d="M9 12a18 18 0 0 1 14-6"/><path d="M21 3l2 4-5 1"/>${iconText(39,43,'Δθ',8)}`,
    'wall-layers': `<path d="M5 42h38"/><path d="M8 42l-3 5M17 42l-3 5M26 42l-3 5M35 42l-3 5"/><path d="M5 37h34M5 31h34M5 23h34M5 13h34"/><path d="M41 37v5M39 40l2 2 2-2"/>${iconText(13,10,'y⁺',9)}`,
    'pipe-pressure': `<path d="M4 20h40M4 30h40"/><path d="M9 20v10M24 20v10M39 20v10"/><circle cx="11" cy="10" r="6"/><circle cx="38" cy="10" r="6"/><path d="M11 10l3-3M38 10l-2-3"/><path d="M20 25h11M28 21l4 4-4 4"/>${iconText(24,43,'Δp',9)}`,
    'valve': `<path d="M3 24h10M35 24h10"/><path d="M13 15l11 9-11 9Z"/><path d="M35 15l-11 9 11 9Z"/><path d="M24 15V8"/><path d="M16 8h16M20 5v6M28 5v6"/><path d="M6 18h7M6 30h7M35 18h7M35 30h7"/>`,
    'total-head': `<path d="M7 10v24h13V20"/><path d="M28 20v19h13V12"/><path d="M7 16c4-3 8 3 13 0M28 26c4-3 8 3 13 0"/><circle cx="24" cy="31" r="6"/><path d="M24 27v5l3 2"/><path d="M44 15v22M42 18l2-3 2 3M42 34l2 3 2-3"/>${iconText(13,43,'H',9)}`,
    'heat-exchanger': `<rect x="5" y="14" width="38" height="21" rx="6"/><path d="M8 20h32M8 25h32M8 30h32"/><path d="M12 14V8h9M36 35v6h-9"/><path d="M9 43h12M18 41l3 2-3 2M39 6H27M30 4l-3 2 3 2"/>${iconText(10,11,'H',7)}${iconText(39,43,'C',7)}`,
    'shaft-torque': `<path d="M5 20h10v-3h10v3h8v10h-8v3H15v-3H5Z"/><path d="M15 17v16M33 20v10"/><path d="M37 13a10 10 0 0 1 7 7"/><path d="M45 16v5h-5"/><path d="M11 38a10 10 0 0 1-7-7"/><path d="M3 35v-5h5"/>`,
    'bolt-stiffness': `<path d="M7 17h34M7 31h34"/><path d="M20 8h8v7h-8Z"/><path d="M22 15h4v17h-4Z"/><path d="M20 32h8v7h-8Z"/><path d="M22 20l4 2M22 25l4 2"/><path d="M11 20c3 2-3 4 0 6M37 20c3 2-3 4 0 6"/>`,
    'stress-per-kg': `<path d="M7 42h35"/><path d="M12 42V22M21 42V29M30 42v-7"/><path d="M10 17l10 8 9 5 8 3"/><path d="M34 28l3 5-6 1"/><path d="M31 8a5 5 0 0 1 10 0l2 9H29Z"/>${iconText(36,15,'kg',6)}`,
    'resonance': `<path d="M4 35h40"/><path d="M5 32c5 0 5-5 10-5s5 19 9 19 4-38 8-38 4 24 8 24 3-1 4-1"/><path d="M32 8v27" stroke-dasharray="3 3"/><path d="M8 10l5 9H3Z"/>${iconText(8,17,'!',7)}${iconText(36,12,'fₙ',8)}`,

    'cooling-load': `<path d="M10 42V19l14-10 14 10v23"/><path d="M5 20l19-14 19 14"/><path d="M24 20v16M17 27l14 0M19 22l10 12M29 22L19 34"/><circle cx="39" cy="8" r="4"/><path d="M39 1v3M45 8h-3M43 3l-2 2"/>`,
    'heating-load': `<path d="M10 42V19l14-10 14 10v23"/><path d="M5 20l19-14 19 14"/><path d="M24 36c-5-3-5-8-1-12 0 4 2 5 3 6 3-3 2-7 1-9 5 3 6 10 2 14-1 2-4 2-5 1Z"/><path d="M14 31h7M14 36h7M30 31h5"/>`,
    'psychrometric-chart': `<path d="M8 5v36h35"/><path d="M8 35C18 33 25 25 29 13c2-5 6-7 12-7"/><path d="M9 29l29-14M9 23l25-13M16 40l8-31M26 40l6-31"/><path d="M34 31c4 5 4 8 0 10-4-2-4-5 0-10Z"/>`,
    'duct-sizing': `<path d="M7 17l10-6h24v18l-10 7H7Z"/><path d="M7 17h24v19M31 17l10-6M31 36l10-7"/><path d="M12 40h15M12 38v4M27 38v4"/><path d="M44 15v12M42 17l2-2 2 2M42 25l2 2 2-2"/>`,
    'duct-pressure': `<path d="M4 18h27l10-6v20l-10 6H4Z"/><path d="M4 18l10 6h27M14 38V24l-10-6"/><path d="M18 27h13M28 23l4 4-4 4"/><circle cx="39" cy="29" r="6"/><path d="M39 29l3-3"/>${iconText(12,11,'Δp',8)}`,
    'airflow-cfm': `<path d="M5 15h22a5 5 0 1 0-5-5"/><path d="M3 25h30a5 5 0 1 1-5 5"/><path d="M7 35h18"/><path d="M34 15l7 7-7 7M27 15l7 7-7 7"/>${iconText(31,43,'CFM',7)}`,
    'fan-static': `<rect x="6" y="7" width="30" height="30" rx="3"/><circle cx="21" cy="22" r="10"/><circle cx="21" cy="22" r="2.3"/><path d="M21 19c-1-4 1-7 5-8 1 4-1 7-5 8Z"/><path d="M24 24c4-1 7 1 8 5-4 1-7-1-8-5Z"/><path d="M18 24c-4-1-7 1-8 5 4 1 7-1 8-5Z"/><circle cx="40" cy="38" r="6"/><path d="M40 38l3-3"/>`,
    'pump-head': `<circle cx="20" cy="29" r="12"/><circle cx="20" cy="29" r="3"/><path d="M20 20c3 2 3 6 0 8M28 27c-2 3-6 4-8 2M14 35c-1-4 1-6 5-7"/><path d="M29 21l7-6v-7"/><path d="M32 10l4-3 4 3"/><path d="M5 42h32"/>${iconText(42,22,'H',8)}`,
    'chilled-pipe': `<path d="M5 15h21a8 8 0 0 1 8 8v20"/><path d="M5 23h21a16 16 0 0 1 16 16v4"/><path d="M14 31v13M8 37h12M9 32l10 10M19 32L9 42"/><path d="M38 8c4 5 4 8 0 10-4-2-4-5 0-10Z"/>`,
    'refrigeration-cycle': `<path d="M13 10h23v16l-8 8H13Z"/><path d="M13 10v24"/><circle cx="13" cy="22" r="6"/><path d="M10 22h6M13 19v6"/><path d="M29 10l7 8-7 8Z"/><path d="M20 39l4-5 4 5M24 34v10"/>${iconText(24,21,'COP',7)}`,
    'ton-refrigeration': `<path d="M15 8h19l7 8v19l-8 7H14l-7-8V15Z"/><path d="M7 15h20v27M27 15l14-7M27 42l14-7"/><path d="M17 20v14M11 27h12M12 21l10 12M22 21L12 33"/>${iconText(36,28,'TR',7)}`,
    'energy-kwh': `<rect x="8" y="6" width="32" height="36" rx="4"/><rect x="13" y="11" width="22" height="9"/><path d="M25 23l-5 8h5l-2 7 8-10h-5l3-5Z"/>${iconText(24,18,'kWh',7)}`,
    'ventilation-people': `<path d="M7 42V17l17-10 17 10v25"/><path d="M4 18l20-13 20 13"/><circle cx="19" cy="25" r="3"/><path d="M14 37v-4a5 5 0 0 1 10 0v4"/><circle cx="31" cy="25" r="3"/><path d="M26 37v-4a5 5 0 0 1 10 0v4"/><path d="M35 10h8M40 7l3 3-3 3"/>`,
    'fresh-air': `<rect x="5" y="10" width="24" height="27" rx="2"/><path d="M9 17h16M9 23h16M9 29h16"/><path d="M32 27c1-8 6-13 14-14-1 8-5 14-13 15"/><path d="M33 28c3-4 6-8 10-11"/><path d="M24 40c5 2 9 0 13-4"/>`,
    'relative-humidity': `<path d="M24 4c8 10 13 17 13 25a13 13 0 1 1-26 0c0-8 5-15 13-25Z"/><path d="M17 31a7 7 0 0 0 5 7"/>${iconText(27,28,'%',14)}${iconText(38,42,'RH',7)}`,
    'dew-point': `<path d="M14 5h5v23a8 8 0 1 1-5 0Z"/><path d="M16.5 13v20"/><path d="M28 11c4 5 4 8 0 10-4-2-4-5 0-10Z"/><path d="M37 23c3 4 3 7 0 9-3-2-3-5 0-9Z"/><path d="M30 36c3 4 3 6 0 8-3-2-3-4 0-8Z"/><path d="M23 18h3M34 29h3"/>`,

    'tension': `<path d="M14 18h20v12H14Z"/><path d="M14 18l-5-5M14 30l-5 5M34 18l5-5M34 30l5 5"/><path d="M9 24H2M5 20l-4 4 4 4M39 24h7M43 20l4 4-4 4"/><path d="M18 39h12" stroke-dasharray="3 3"/>${iconText(24,11,'F/A',7)}`,
    'bending': `<path d="M6 17h36"/><path d="M8 18c8 11 24 11 32 0"/><path d="M24 4v10M20 10l4 4 4-4"/><path d="M9 20l-4 9h10l-4-9M39 20l-4 9h10l-4-9"/><path d="M14 37a14 8 0 0 0 20 0"/>${iconText(39,42,'M',9)}`,
    'torsion': `<path d="M6 19h31M6 29h31"/><ellipse cx="8" cy="24" rx="4" ry="8"/><ellipse cx="39" cy="24" rx="4" ry="8"/><path d="M16 15c5 5 12 5 17 0M16 33c5-5 12-5 17 0"/><path d="M42 10a14 14 0 0 1 3 9"/><path d="M46 15v5h-5"/>`,
    'stress-concentration': `<rect x="9" y="10" width="30" height="28"/><circle cx="24" cy="24" r="6"/><path d="M24 12V7M24 41v-5M12 24H7M41 24h-5M16 16l-3-3M35 35l-3-3M32 16l3-3M13 35l3-3"/><path d="M5 24H2M46 24h-3"/>${iconText(39,10,'Kt',7)}`,
    'principal-3d': `<path d="M14 18l12-7 14 6v16l-12 7-14-6Z"/><path d="M14 18l14 6 12-7M28 24v16"/><path d="M28 24L8 34M28 24l18 9M28 24V8"/><path d="M11 30l-4 4 6 1M42 30l4 3-6 2M25 11l3-4 3 4"/>`,
    'stress-invariants': `<path d="M13 17l11-6 13 6v15l-13 6-11-6Z"/><path d="M13 17l12 6 12-6M25 23v15"/><path d="M7 9a20 20 0 0 1 25-3"/><path d="M29 3l3 4-5 1"/><path d="M41 39a20 20 0 0 1-25 3"/><path d="M19 45l-3-4 5-1"/>${iconText(25,28,'I₁I₂I₃',6)}`,
    'hydrostatic-deviatoric': `<circle cx="22" cy="24" r="13"/><path d="M22 5v8M19 10l3 3 3-3M22 43v-8M19 38l3-3 3 3M3 24h8M8 21l3 3-3 3M41 24h-8M36 21l-3 3 3 3"/><path d="M15 17l14 14M29 17L15 31" stroke-dasharray="3 3"/>${iconText(39,10,'σm',7)}`,
    'mohr-3d': `<path d="M6 42V7M3 28h42"/><circle cx="29" cy="28" r="16"/><circle cx="22" cy="28" r="9"/><circle cx="36" cy="28" r="9"/><path d="M13 28h32"/>${iconDot(29,28,1.6)}${iconText(12,13,'τ',9)}${iconText(41,39,'σ',9)}`,
    'failure-criteria': `<path d="M8 42V7M8 42h35"/><ellipse cx="25" cy="24" rx="15" ry="12"/><path d="M25 9l12 7v15l-12 7-12-7V16Z"/><path d="M18 29l5 5 9-12"/>${iconText(39,12,'Sy',7)}`,
    'strain-displacement': `<path d="M9 10h24v24H9Z" stroke-dasharray="4 3"/><path d="M13 15h25l-4 24H10Z"/><path d="M13 15l8 8 13 1M21 23l-2 16"/><path d="M33 11l6-3M35 5l4 3-5 2M36 33l6 4M38 34l4 3-5 1"/>${iconText(13,43,'∇u',8)}`,
    'strain-tensor': `<path d="M8 13h25l7 22H13Z"/><path d="M8 13l19 11 13 11M27 24l-2 11M20 13l3 22"/><path d="M8 42h32M8 42V18"/><path d="M13 37a8 8 0 0 1 5-6"/>${iconText(36,10,'[ε]',8)}`,
    'mohr-strain': `<path d="M7 42V7M4 28h41"/><circle cx="27" cy="28" r="15"/><path d="M12 28h30M19 15l16 26M19 41l16-26"/>${iconDot(19,15)}${iconDot(35,41)}${iconText(13,13,'γ/2',7)}${iconText(41,39,'ε',9)}`,
    'constitutive': `<path d="M8 42V7M8 42h35"/><path d="M9 41L39 11"/><path d="M26 41V24h13" stroke-dasharray="3 3"/>${iconDot(26,24)}${iconText(13,13,'σ',10)}${iconText(39,38,'ε',10)}${iconText(28,18,'E',9)}`,
    'pressure-vessel': `<rect x="7" y="17" width="30" height="19" rx="9"/><path d="M13 17v19M31 17v19"/><path d="M20 17v-5h6v5"/><circle cx="36" cy="9" r="5"/><path d="M36 9l2-2"/><path d="M13 36l-3 7M33 36l3 7M6 44h35"/>`,
    'ashby-plot': `<path d="M8 42V7M8 42h35"/><path d="M14 42v-4M23 42v-4M32 42v-4M8 33h4M8 24h4M8 15h4"/><circle cx="16" cy="32" r="4"/><circle cx="25" cy="24" r="6"/><circle cx="36" cy="15" r="5"/><circle cx="35" cy="32" r="3"/><rect x="20" y="10" width="21" height="20" stroke-dasharray="4 3"/>`,
    'calculator': `<rect x="10" y="5" width="28" height="38" rx="3"/><rect x="15" y="10" width="18" height="7"/><path d="M16 24h4M24 24h4M32 24h0M16 31h4M24 31h4M16 38h12"/>`,
  };

  function iconSVG(name, className = 'calc-svg-icon') {
    const art = CALC_ICONS[name] || CALC_ICONS.calculator;
    return `<svg class="${className}" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${art}</svg>`;
  }

  function showToast(message) {
    let toast = $('.calc-toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'calc-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.innerHTML = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function saveFavourites() { storage.write(favouriteKey, [...favourites]); }
  function pushRecent(id) {
    recent = [id, ...recent.filter(x => x !== id)].slice(0, 8);
    storage.write(recentKey, recent);
    renderRecent();
  }

  function cardHTML(calc) {
    const source = calc.ref ? 'TensorCalculator reference' : 'FORM FEA addition';
    return `<article class="calc-card" data-calc-card="${esc(calc.id)}" data-search="${esc(`${calc.name} ${catName(calc.category)} ${calc.purpose} ${calc.formula} ${calc.tags || ''}`.toLowerCase())}">
      <div class="calc-card-top"><span class="calc-icon" data-icon="${esc(calc.icon || 'calculator')}" title="${esc(calc.name)} icon">${iconSVG(calc.icon)}</span><div><div class="calc-cat">${esc(catName(calc.category))}</div><button class="fav-btn ${favourites.has(calc.id) ? 'is-fav' : ''}" type="button" data-fav="${esc(calc.id)}" aria-label="${favourites.has(calc.id) ? 'Remove' : 'Save'} ${esc(calc.name)} as favourite" aria-pressed="${favourites.has(calc.id)}">★</button></div></div>
      <h3>${esc(calc.name)}</h3><p>${esc(calc.purpose)}</p><div class="calc-formula">${esc(calc.formula)}</div>
      <div class="calc-card-bottom"><a class="calc-open" href="${esc(catFile(calc.category))}#${esc(calc.id)}" data-open-calc="${esc(calc.id)}">Open calculator <span>→</span></a><span class="calc-source">${source}</span></div>
    </article>`;
  }

  function visibleCalculators() {
    const query = ($('#calc-search')?.value || '').trim().toLowerCase();
    return calculators.filter(calc => {
      if (!isDirectory && pageCategory && calc.category !== pageCategory) return false;
      if (activeFilter === 'favourites' && !favourites.has(calc.id)) return false;
      if (isDirectory && activeFilter !== 'all' && activeFilter !== 'favourites' && calc.category !== activeFilter) return false;
      if (!query) return true;
      return `${calc.name} ${catName(calc.category)} ${calc.purpose} ${calc.formula} ${calc.tags || ''}`.toLowerCase().includes(query);
    });
  }

  function renderGrid() {
    const grid = $('#calc-grid');
    if (!grid) return;
    const list = visibleCalculators();
    grid.innerHTML = list.map(cardHTML).join('');
    const empty = $('#calc-empty');
    if (empty) empty.hidden = list.length !== 0;
    const count = $('#calc-visible-count');
    if (count) count.textContent = list.length;
    renderFavourites();
  }

  function renderFavourites() {
    const wrap = $('#favourite-calculators');
    if (!wrap) return;
    const list = calculators.filter(c => favourites.has(c.id) && (isDirectory || c.category === pageCategory));
    wrap.innerHTML = list.length ? list.map(cardHTML).join('') : '<div class="calc-empty">Tap ★ on any calculator card to keep it here for quick access. Favourites are stored only in this browser.</div>';
  }

  function renderCategories() {
    const shelf = $('#calc-category-shelf');
    if (!shelf) return;
    shelf.innerHTML = [...categories.values()].map(cat => {
      const count = calculators.filter(c => c.category === cat.id).length;
      return `<a class="category-folder calculator-category-folder" href="${esc(cat.file)}" aria-label="Open ${esc(cat.name)} calculators — opens its own page">
        <span class="folder" aria-hidden="true"><span class="folder-back"></span><span class="folder-paper p2"></span><span class="folder-paper p1"></span><span class="folder-front"><span class="calc-folder-icon" data-icon="${esc(cat.icon || cat.id)}">${iconSVG(cat.icon || cat.id, 'calc-folder-svg')}</span><span class="folder-stamp">${esc(cat.num)}</span></span></span>
        <span><span class="cat-index">Calculator category ${esc(cat.num)} · ${count} calculator${count === 1 ? '' : 's'} · ${esc(cat.motif)}</span>
        <span class="cat-title">${esc(cat.name)}</span><span class="cat-goal"><b>Inside:</b> ${esc(cat.goal)}</span></span>
        <span class="cat-action"><span>Open category folder · new page</span><i aria-hidden="true">↗</i></span></a>`;
    }).join('');
  }

  function renderChips() {
    const holder = $('#calc-chips');
    if (!holder) return;
    const chips = [{ id: 'all', label: isDirectory ? 'All calculators' : 'All in category' }, { id: 'favourites', label: '★ Favourites' }];
    if (isDirectory) categories.forEach(cat => chips.push({ id: cat.id, label: cat.name }));
    holder.innerHTML = chips.map(chip => `<button class="calc-chip ${activeFilter === chip.id ? 'is-active' : ''}" type="button" data-filter="${esc(chip.id)}">${esc(chip.label)}</button>`).join('');
  }

  function renderRecent() {
    const holder = $('#recent-calculators');
    if (!holder) return;
    const valid = recent.map(id => byId.get(id)).filter(Boolean);
    holder.innerHTML = valid.length
      ? valid.map(c => `<a href="${esc(catFile(c.category))}#${esc(c.id)}">${esc(c.name)}</a>`).join('')
      : '<span style="font-size:11px;color:#7a8179">Open a calculator and it will appear here next time.</span>';
  }

  function ensureModal() {
    let backdrop = $('#calc-backdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'calc-backdrop'; backdrop.id = 'calc-backdrop'; backdrop.hidden = true;
    backdrop.innerHTML = `<section class="calc-modal" role="dialog" aria-modal="true" aria-labelledby="calc-modal-title">
      <header class="calc-modal-head"><div class="cm-title-wrap"><span class="cm-icon" id="calc-modal-icon" aria-hidden="true"></span><div><div class="cm-kicker" id="calc-modal-kicker">Calculator</div><h2 id="calc-modal-title">Calculator</h2><p id="calc-modal-purpose"></p></div></div>
      <div class="cm-actions"><button class="cm-close" id="calc-modal-close" type="button" aria-label="Close calculator">×</button><a class="cm-ref" id="calc-modal-ref" href="#" target="_blank" rel="noopener">TensorCalculator reference ↗</a></div></header>
      <div class="calc-modal-body"><div class="calc-studio">
        <form class="calc-panel" id="calc-form" novalidate><h3>Inputs</h3><div class="input-grid" id="calc-inputs"></div>
          <div class="formula-box" id="calc-formula-box"></div>
          <div class="calc-btn-row"><button class="calc-btn primary" type="submit">Calculate →</button><button class="calc-btn acid" type="button" id="calc-example">Example values</button><button class="calc-btn" type="button" id="calc-reset">Reset saved</button></div>
          <div class="saved-state" id="calc-saved-state">Inputs save in this browser as you type.</div><div class="calc-error" id="calc-error" hidden></div></form>
        <section class="calc-panel dark" aria-live="polite"><h3>Results</h3><div class="result-grid" id="calc-results"></div><div id="calc-extra"></div>
          <div class="calc-btn-row"><button class="calc-btn" type="button" id="calc-copy">Copy results</button></div></section>
      </div><div class="calc-notes" id="calc-static-notes"></div></div></section>`;
    document.body.appendChild(backdrop);
    $('#calc-modal-close', backdrop).addEventListener('click', closeCalculator);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeCalculator(); });
    $('#calc-form', backdrop).addEventListener('submit', e => { e.preventDefault(); calculate(); });
    $('#calc-form', backdrop).addEventListener('input', () => { saveCurrentInputs(false); });
    $('#calc-form', backdrop).addEventListener('change', () => { saveCurrentInputs(false); });
    $('#calc-example', backdrop).addEventListener('click', () => { fillInputs({}); calculate(); showToast('<b>Example loaded.</b> Default example values restored.'); });
    $('#calc-reset', backdrop).addEventListener('click', () => { if (!currentCalc) return; storage.remove(inputKey(currentCalc.id)); fillInputs({}); calculate(); showToast('<b>Reset complete.</b> Saved inputs removed.'); });
    $('#calc-copy', backdrop).addEventListener('click', copyResults);
    return backdrop;
  }

  function savedInputs() { return currentCalc ? storage.read(inputKey(currentCalc.id), {}) : {}; }
  function fieldSaved(field, saved) { return saved[field.key] || {}; }

  function fillInputs(saved = savedInputs()) {
    const holder = $('#calc-inputs');
    if (!holder || !currentCalc) return;
    holder.innerHTML = currentCalc.inputs.map(field => {
      const sv = fieldSaved(field, saved);
      const value = Object.prototype.hasOwnProperty.call(sv, 'value') ? sv.value : field.default;
      if (field.type === 'select') {
        const options = field.options.map(opt => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const label = typeof opt === 'object' ? opt.label : prettyOption(opt);
          return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
        }).join('');
        return `<label class="field ${field.wide ? 'wide' : ''}"><span class="field-label">${esc(field.label)}</span><select name="${esc(field.key)}">${options}</select>${field.help ? `<span class="field-help">${esc(field.help)}</span>` : ''}</label>`;
      }
      if (field.type === 'textarea') {
        return `<label class="field wide"><span class="field-label">${esc(field.label)}</span><textarea name="${esc(field.key)}" rows="3">${esc(value)}</textarea><span class="field-help">Separate values with commas or spaces.</span></label>`;
      }
      const selectedUnit = sv.unit || field.defaultUnit || (Array.isArray(field.units) ? field.units[0].label : '');
      const unitControl = Array.isArray(field.units)
        ? `<select name="${esc(field.key)}__unit" aria-label="Unit for ${esc(field.label)}">${field.units.map(u => `<option value="${esc(u.label)}" ${u.label === selectedUnit ? 'selected' : ''}>${esc(u.label)}</option>`).join('')}</select>`
        : `<span class="unit-static">${esc(field.unit || '—')}</span>`;
      return `<label class="field ${field.wide ? 'wide' : ''}"><span class="field-label">${esc(field.label)}</span><span class="input-with-unit"><input name="${esc(field.key)}" type="number" step="${esc(field.step || 'any')}" value="${esc(value)}" inputmode="decimal">${unitControl}</span>${field.help ? `<span class="field-help">${esc(field.help)}</span>` : ''}</label>`;
    }).join('');
  }

  function getRawInputs() {
    const form = $('#calc-form'); const raw = {};
    if (!form || !currentCalc) return raw;
    currentCalc.inputs.forEach(field => {
      const el = form.elements.namedItem(field.key);
      const unitEl = form.elements.namedItem(`${field.key}__unit`);
      raw[field.key] = { value: el ? el.value : field.default, ...(unitEl ? { unit: unitEl.value } : {}) };
    });
    return raw;
  }

  function saveCurrentInputs(calculateAfter = true) {
    if (!currentCalc) return;
    storage.write(inputKey(currentCalc.id), getRawInputs());
    const state = $('#calc-saved-state');
    if (state) state.textContent = 'Saved in this browser · reopening restores these values';
    if (calculateAfter) calculate();
  }

  function convertedValues() {
    const form = $('#calc-form'), values = {};
    currentCalc.inputs.forEach(field => {
      const el = form.elements.namedItem(field.key);
      if (field.type === 'select' || field.type === 'textarea') { values[field.key] = el ? el.value : field.default; return; }
      const raw = el ? el.value : '';
      const num = Number(raw);
      if (raw === '' || !Number.isFinite(num)) throw new Error(`${field.label} needs a valid number.`);
      if (Array.isArray(field.units)) {
        const unitEl = form.elements.namedItem(`${field.key}__unit`);
        const unit = field.units.find(u => u.label === (unitEl ? unitEl.value : field.defaultUnit)) || field.units[0];
        values[field.key] = (num + (unit.offset || 0)) * unit.factor;
      } else values[field.key] = num;
    });
    return values;
  }

  function openCalculator(id, pushHash = true) {
    const calc = byId.get(id);
    if (!calc) return;
    lastFocus = document.activeElement;
    currentCalc = calc; lastOutcome = null;
    const backdrop = ensureModal();
    $('#calc-modal-icon').innerHTML = iconSVG(calc.icon, 'calc-modal-svg');
    $('#calc-modal-icon').dataset.icon = calc.icon || 'calculator';
    $('#calc-modal-kicker').textContent = `${catName(calc.category)} · ${calc.ref ? 'TensorCalculator-based, FORM-enhanced' : 'FORM FEA addition'}`;
    $('#calc-modal-title').textContent = calc.name;
    $('#calc-modal-purpose').textContent = calc.purpose;
    $('#calc-formula-box').textContent = calc.formula;
    const ref = $('#calc-modal-ref');
    if (calc.ref) { ref.href = calc.ref; ref.hidden = false; } else ref.hidden = true;
    fillInputs();
    $('#calc-static-notes').innerHTML = `<div class="calc-note"><b>Check</b>${esc(calc.checks)}</div><div class="calc-note"><b>Scope</b>Engineering screening/education result. Verify against governing standards, material data and independent checks before design release.</div>`;
    backdrop.hidden = false;
    document.body.classList.add('calc-modal-open');
    pushRecent(id);
    if (pushHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    calculate();
    setTimeout(() => $('#calc-modal-close')?.focus({ preventScroll: true }), 30);
  }

  function closeCalculator() {
    const backdrop = $('#calc-backdrop');
    if (!backdrop) return;
    backdrop.hidden = true;
    document.body.classList.remove('calc-modal-open');
    currentCalc = null; lastOutcome = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  function resultValue(item) {
    if (typeof item.value === 'number') return fmt(item.value);
    return String(item.value ?? '—');
  }

  function renderOutcome(out) {
    const results = $('#calc-results');
    results.innerHTML = out.results.map(item => `<div class="result-card"><small>${esc(item.label)}</small><strong>${esc(resultValue(item))}</strong>${item.unit ? `<span>${esc(item.unit)}</span>` : ''}${item.note ? `<em>${esc(item.note)}</em>` : ''}</div>`).join('');
    const extra = $('#calc-extra');
    let html = '';
    if (out.table) html += renderTable(out.table);
    if (out.plot) html += renderPlot(out.plot);
    const notes = [];
    (out.steps || []).forEach(s => notes.push(`<div class="calc-note"><b>Method</b>${esc(s)}</div>`));
    (out.warnings || []).forEach(w => notes.push(`<div class="calc-note warn"><b>Check</b>${esc(w)}</div>`));
    if (notes.length) html += `<div class="calc-notes">${notes.join('')}</div>`;
    extra.innerHTML = html;
  }

  function renderTable(table) {
    const rows = table.rows.map(row => {
      const last = String(row[row.length - 1] || '');
      const cls = last === 'PASS' ? 'is-pass' : last === 'HIGH' ? 'risk-high' : last === 'WATCH' ? 'risk-watch' : '';
      return `<tr class="${cls}">${row.map(cell => `<td>${esc(typeof cell === 'number' ? fmt(cell) : cell)}</td>`).join('')}</tr>`;
    }).join('');
    return `<div class="calc-table-wrap"><table class="calc-table"><thead><tr>${table.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function tickLabel(v, log) { return log ? fmt(Math.pow(10, v)) : fmt(v); }
  function niceTicks(min, max, count, log) {
    if (log) {
      const lo = Math.floor(min), hi = Math.ceil(max), arr = [];
      for (let e = lo; e <= hi; e++) arr.push(e);
      return arr;
    }
    const arr = [], step = (max - min) / count;
    for (let i = 0; i <= count; i++) arr.push(min + i * step);
    return arr;
  }

  function renderPlot(plot) {
    return plot.type === 'scatter' ? renderScatter(plot) : renderMohr(plot);
  }

  function renderMohr(plot) {
    const W = 700, H = 430, m = { l: 58, r: 22, t: 22, b: 50 };
    let minX = Infinity, maxX = -Infinity, maxY = 0;
    (plot.circles || []).forEach(c => { minX = Math.min(minX, c.center - c.radius); maxX = Math.max(maxX, c.center + c.radius); maxY = Math.max(maxY, c.radius); });
    (plot.points || []).forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, Math.abs(p.y)); });
    if (!isFinite(minX)) { minX = -1; maxX = 1; maxY = 1; }
    const padX = Math.max((maxX - minX) * .08, 1e-9); minX -= padX; maxX += padX;
    maxY = Math.max(maxY * 1.15, 1e-9);
    const sx = x => m.l + (x - minX) / (maxX - minX) * (W - m.l - m.r);
    const sy = y => m.t + (maxY - y) / (2 * maxY) * (H - m.t - m.b);
    const sr = r => r / (maxX - minX) * (W - m.l - m.r);
    const colors = ['#171b19', '#5b8c00', '#788078'];
    const xTicks = niceTicks(minX, maxX, 5, false), yTicks = niceTicks(-maxY, maxY, 4, false);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(plot.title)}">`;
    xTicks.forEach(x => { svg += `<line class="gridline" x1="${sx(x)}" y1="${m.t}" x2="${sx(x)}" y2="${H-m.b}"/><text x="${sx(x)}" y="${H-26}" text-anchor="middle">${fmt(x)}</text>`; });
    yTicks.forEach(y => { svg += `<line class="gridline" x1="${m.l}" y1="${sy(y)}" x2="${W-m.r}" y2="${sy(y)}"/><text x="${m.l-7}" y="${sy(y)+3}" text-anchor="end">${fmt(y)}</text>`; });
    svg += `<line class="axis" x1="${m.l}" y1="${sy(0)}" x2="${W-m.r}" y2="${sy(0)}"/><line class="axis" x1="${sx(0) >= m.l && sx(0) <= W-m.r ? sx(0) : m.l}" y1="${m.t}" x2="${sx(0) >= m.l && sx(0) <= W-m.r ? sx(0) : m.l}" y2="${H-m.b}"/>`;
    (plot.circles || []).forEach((c, i) => {
      svg += `<circle cx="${sx(c.center)}" cy="${sy(0)}" r="${Math.max(sr(c.radius), 0)}" fill="${i === 2 ? 'rgba(216,255,99,.22)' : 'none'}" stroke="${colors[i % colors.length]}" stroke-width="${i === 2 ? 2 : 1.3}"><title>Centre ${fmt(c.center)}, radius ${fmt(c.radius)}</title></circle>`;
      svg += `<circle cx="${sx(c.center)}" cy="${sy(0)}" r="2.5" fill="${colors[i % colors.length]}"/>`;
    });
    (plot.points || []).forEach(p => { svg += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="4.5" fill="#171b19" stroke="#d8ff63" stroke-width="1.5"><title>${esc(p.label)} ${fmt(p.x)}, ${fmt(p.y)}</title></circle><text x="${sx(p.x)+7}" y="${sy(p.y)-7}">${esc(p.label)}</text>`; });
    svg += `<text x="${W/2}" y="${H-5}" text-anchor="middle">${esc(plot.xLabel)}</text><text x="12" y="${H/2}" transform="rotate(-90 12 ${H/2})" text-anchor="middle">${esc(plot.yLabel)}</text></svg>`;
    return `<div class="calc-plot"><h4>${esc(plot.title)}</h4>${svg}</div>`;
  }

  function renderScatter(plot) {
    const W = 700, H = 430, m = { l: 62, r: 20, t: 20, b: 58 };
    const pts = (plot.points || []).filter(p => p.x > 0 && p.y > 0);
    if (!pts.length) return '';
    const tx = x => plot.logX ? Math.log10(x) : x, ty = y => plot.logY ? Math.log10(y) : y;
    let minX = Math.min(...pts.map(p => tx(p.x))), maxX = Math.max(...pts.map(p => tx(p.x)));
    let minY = Math.min(...pts.map(p => ty(p.y))), maxY = Math.max(...pts.map(p => ty(p.y)));
    const pad = (a, b) => Math.max((b - a) * .08, .05); minX -= pad(minX,maxX); maxX += pad(minX,maxX); minY -= pad(minY,maxY); maxY += pad(minY,maxY);
    const sx = x => m.l + (tx(x) - minX) / (maxX - minX) * (W - m.l - m.r);
    const sy = y => m.t + (maxY - ty(y)) / (maxY - minY) * (H - m.t - m.b);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(plot.title)}">`;
    niceTicks(minX,maxX,5,plot.logX).forEach(t => { const x = plot.logX ? Math.pow(10,t) : t; svg += `<line class="gridline" x1="${sx(x)}" y1="${m.t}" x2="${sx(x)}" y2="${H-m.b}"/><text x="${sx(x)}" y="${H-34}" text-anchor="middle">${tickLabel(t,plot.logX)}</text>`; });
    niceTicks(minY,maxY,5,plot.logY).forEach(t => { const y = plot.logY ? Math.pow(10,t) : t; svg += `<line class="gridline" x1="${m.l}" y1="${sy(y)}" x2="${W-m.r}" y2="${sy(y)}"/><text x="${m.l-7}" y="${sy(y)+3}" text-anchor="end">${tickLabel(t,plot.logY)}</text>`; });
    pts.forEach(p => {
      const pass = p.pass;
      svg += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${pass ? 6 : 4}" fill="${pass ? '#d8ff63' : '#c9ccc2'}" stroke="#171b19" stroke-width="1.2"><title>${esc(p.label)} — x ${fmt(p.x)}, y ${fmt(p.y)}${pass ? ' — PASS' : ''}</title></circle>`;
      if (pass) svg += `<text x="${sx(p.x)+8}" y="${sy(p.y)-6}">${esc(p.label.length > 24 ? p.label.slice(0,23)+'…' : p.label)}</text>`;
    });
    svg += `<text x="${W/2}" y="${H-8}" text-anchor="middle">${esc(plot.xLabel)}${plot.logX ? ' · log scale' : ''}</text><text x="12" y="${H/2}" transform="rotate(-90 12 ${H/2})" text-anchor="middle">${esc(plot.yLabel)}${plot.logY ? ' · log scale' : ''}</text></svg>`;
    return `<div class="calc-plot"><h4>${esc(plot.title)}</h4>${svg}</div>`;
  }

  function calculate() {
    if (!currentCalc) return;
    const error = $('#calc-error');
    try {
      const values = convertedValues();
      const solver = globalThis.CALC_SOLVERS[currentCalc.id];
      if (!solver) throw new Error('Solver is not loaded for this calculator.');
      const out = solver(values);
      lastOutcome = out;
      error.hidden = true; error.textContent = '';
      renderOutcome(out);
      saveCurrentInputs(false);
    } catch (err) {
      lastOutcome = null;
      $('#calc-results').innerHTML = '<div class="result-card"><small>Status</small><strong>Needs attention</strong><span>Fix the highlighted input issue</span></div>';
      $('#calc-extra').innerHTML = '';
      error.innerHTML = `<b>Input issue</b>${esc(err.message || err)}`;
      error.hidden = false;
    }
  }

  async function copyResults() {
    if (!currentCalc || !lastOutcome) { showToast('<b>No results yet.</b> Calculate first.'); return; }
    const lines = [currentCalc.name, `Formula: ${currentCalc.formula}`, ''];
    lastOutcome.results.forEach(r => lines.push(`${r.label}: ${resultValue(r)}${r.unit ? ' ' + r.unit : ''}${r.note ? ' (' + r.note + ')' : ''}`));
    if (lastOutcome.table) {
      lines.push('', lastOutcome.table.columns.join('\t'));
      lastOutcome.table.rows.forEach(row => lines.push(row.map(cell => typeof cell === 'number' ? fmt(cell) : cell).join('\t')));
    }
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    showToast('<b>Copied.</b> Calculator results are on your clipboard.');
  }

  document.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      const id = fav.dataset.fav;
      if (favourites.has(id)) favourites.delete(id); else favourites.add(id);
      saveFavourites(); renderGrid();
      showToast(favourites.has(id) ? '<b>Favourite saved.</b>' : '<b>Favourite removed.</b>');
      return;
    }
    const chip = e.target.closest('[data-filter]');
    if (chip) { activeFilter = chip.dataset.filter; renderChips(); renderGrid(); return; }
    const open = e.target.closest('[data-open-calc]');
    if (open) { e.preventDefault(); openCalculator(open.dataset.openCalc); return; }
    const card = e.target.closest('[data-calc-card]');
    if (card && !e.target.closest('a,button')) openCalculator(card.dataset.calcCard);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && currentCalc) closeCalculator();
  });

  $('#calc-search')?.addEventListener('input', renderGrid);
  renderCategories(); renderChips(); renderGrid(); renderRecent();

  const initial = location.hash.replace('#', '');
  if (initial && byId.has(initial)) setTimeout(() => openCalculator(initial, false), 40);
})();
