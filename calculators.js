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
      <div class="calc-card-top"><span class="calc-icon">${esc(calc.icon || 'fx')}</span><div><div class="calc-cat">${esc(catName(calc.category))}</div><button class="fav-btn ${favourites.has(calc.id) ? 'is-fav' : ''}" type="button" data-fav="${esc(calc.id)}" aria-label="${favourites.has(calc.id) ? 'Remove' : 'Save'} ${esc(calc.name)} as favourite" aria-pressed="${favourites.has(calc.id)}">★</button></div></div>
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
      return `<a class="category-folder" href="${esc(cat.file)}" aria-label="Open ${esc(cat.name)} calculators — opens its own page">
        <span class="folder" aria-hidden="true"><span class="folder-back"></span><span class="folder-paper p2"></span><span class="folder-paper p1"></span><span class="folder-front"><span class="folder-stamp">Calc · ${esc(cat.num)}</span></span></span>
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
      <header class="calc-modal-head"><div><div class="cm-kicker" id="calc-modal-kicker">Calculator</div><h2 id="calc-modal-title">Calculator</h2><p id="calc-modal-purpose"></p></div>
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
