// Analyse-visning: aggregering av filtrerte prosjekter med Chart.js.
// Lytter på 'projects-loaded'-event fra browse.js og rendrer chart når aktiv.

// === Konstanter ===
const LS_ANALYSE_STATE = 'fhi_analyse_state';

const METRIC_LABELS = {
  count: 'Antall',
  sum: 'Sum',
};

const CHART_TYPES = {
  bar: 'Søyle',
  hbar: 'Søyle (horisontal)',
  line: 'Linje',
  pie: 'Pie',
  stacked: 'Stablet søyle (krever 2 dim)',
  grouped: 'Gruppert søyle (krever 2 dim)',
};

const CHART_COLORS = [
  '#3730a3', '#92400e', '#065f46', '#9d174d', '#5b21b6',
  '#991b1b', '#1e40af', '#854d0e', '#166534', '#155e75',
  '#3f6212', '#334155',
];

const SOURCE_CATEGORIES_MAP = {
  FF: 'Innsendt', SM: 'Innsendt', KRG: 'Innsendt',
  HT: 'Innsendt', HD: 'Innsendt', MH: 'Innsendt',
  NVA: 'NVA', SFF: 'SFF', eProtokoll: 'eProtokoll',
};

const DIMS = {
  area:            { id: 'area',            label: 'Område',         get: r => r.area || '' },
  main_group:      { id: 'main_group',      label: 'Hovedgruppe',    get: r => r.main_group || '' },
  source_category: { id: 'source_category', label: 'Kilde',          get: r => mapSourceCategory(r) },
  status:          { id: 'status',          label: 'Status',         get: r => r.status || '' },
  year_changed:    { id: 'year_changed',    label: 'År endret',      get: r => (r.date_changed || '').slice(0, 4) },
  year_started:    { id: 'year_started',    label: 'År startet',     get: r => (r.project_start || '').slice(0, 4) },
  tag:             { id: 'tag',             label: 'Stikkord',       get: r => r.tags || [], multiValue: true, topN: 20 },
};

const VALUE_COLS = {
  months_2025: {
    id: 'months_2025',
    label: 'Antall månedsverk i 2025',
    get: r => {
      const ef = (r.extra_fields || {})['Antall månedsverk i 2025'];
      if (!ef) return null;
      const v = (typeof ef === 'object' && 'value' in ef) ? ef.value : ef;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    },
  },
  n_tags:    { id: 'n_tags',    label: '# stikkord', get: r => (r.tags || []).length },
  n_sources: { id: 'n_sources', label: '# kilder',   get: r => (r.sources || []).length },
};

const PRESETS = [
  // Antall
  { id: 'count-area',           name: 'Antall per område',           group: 'Antall',     dim1: 'area',          dim2: null,              metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'bar' },
  { id: 'count-source',         name: 'Antall per kilde',            group: 'Antall',     dim1: 'source_category', dim2: null,            metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'bar' },
  { id: 'count-status',         name: 'Antall per status',           group: 'Antall',     dim1: 'status',        dim2: null,              metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'bar' },
  { id: 'count-tag',            name: 'Antall per stikkord (topp 20)', group: 'Antall',   dim1: 'tag',           dim2: null,              metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'hbar' },
  // Tidsserier
  { id: 'count-by-year',        name: 'Utvikling over år',           group: 'Tidsserier', dim1: 'year_changed',  dim2: null,              metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'line' },
  { id: 'count-area-by-year',   name: 'Utvikling over år per område', group: 'Tidsserier', dim1: 'year_changed', dim2: 'area',            metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'line' },
  { id: 'count-source-by-year', name: 'Utvikling over år per kilde', group: 'Tidsserier', dim1: 'year_changed',  dim2: 'source_category', metric: 'count', valueCol: null,         imputeMissing: false, chartType: 'stacked' },
  // Månedsverk
  { id: 'months-area',          name: 'Månedsverk per område',       group: 'Månedsverk', dim1: 'area',          dim2: null,              metric: 'sum',   valueCol: 'months_2025', imputeMissing: true,  chartType: 'bar' },
  { id: 'months-tag',           name: 'Månedsverk per stikkord',     group: 'Månedsverk', dim1: 'tag',           dim2: null,              metric: 'sum',   valueCol: 'months_2025', imputeMissing: true,  chartType: 'hbar' },
];

// === State ===
const ANALYSE_STATE = {
  rows: [],
  dim1: 'area',
  dim2: null,
  metric: 'count',
  valueCol: null,
  imputeMissing: false,
  chartType: 'bar',
};

// === Init ===
let chartInstance = null;

document.addEventListener('DOMContentLoaded', initAnalyse);

function initAnalyse() {
  loadAnalyseStateFromStorage();
  // Bygg analyse-panelets DOM
  renderAnalyseScaffold();
  renderControls();
  wireControls();
  wirePresetMenu();
  window.addEventListener('projects-loaded', onAnalyseProjectsLoaded);
}

function onAnalyseProjectsLoaded(e) {
  ANALYSE_STATE.rows = e.detail.items || [];
  if (isAnalyseMode()) renderChart();
}

function isAnalyseMode() {
  return window.TABLE_STATE && window.TABLE_STATE.viewMode === 'analyse';
}

// === State-persistens ===
function loadAnalyseStateFromStorage() {
  try {
    const raw = localStorage.getItem(LS_ANALYSE_STATE);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const k of ['dim1', 'dim2', 'metric', 'valueCol', 'imputeMissing', 'chartType']) {
        if (k in parsed) ANALYSE_STATE[k] = parsed[k];
      }
    }
  } catch (e) {
    console.warn('Kunne ikke lese analyse-state fra localStorage:', e);
  }
}

function saveAnalyseState() {
  const toSave = {
    dim1: ANALYSE_STATE.dim1,
    dim2: ANALYSE_STATE.dim2,
    metric: ANALYSE_STATE.metric,
    valueCol: ANALYSE_STATE.valueCol,
    imputeMissing: ANALYSE_STATE.imputeMissing,
    chartType: ANALYSE_STATE.chartType,
  };
  localStorage.setItem(LS_ANALYSE_STATE, JSON.stringify(toSave));
}

// === Helpers ===
function mapSourceCategory(r) {
  const srcs = r.sources || (r.source ? [r.source] : []);
  for (const s of srcs) {
    if (SOURCE_CATEGORIES_MAP[s]) return SOURCE_CATEGORIES_MAP[s];
  }
  return 'Annet';
}

function toArray(v) {
  if (v == null) return [''];
  if (Array.isArray(v)) return v.length ? v : [''];
  return [v];
}

// === Scaffold ===
function renderAnalyseScaffold() {
  const root = document.getElementById('analyse-view');
  if (!root) return;
  root.innerHTML = '';
  // Kontroller
  const controls = el('div', { class: 'analyse-controls', id: 'analyse-controls' });
  root.appendChild(controls);
  // Chart-canvas wrap
  const chartWrap = el('div', { class: 'analyse-chart-wrap' },
    el('canvas', { id: 'analyse-chart-canvas' }),
  );
  root.appendChild(chartWrap);
  // Agg-info
  root.appendChild(el('div', { class: 'analyse-agg-info', id: 'analyse-agg-info' }));
  // Eksport
  root.appendChild(el('div', { class: 'analyse-export' },
    el('button', { type: 'button', id: 'analyse-download-png' }, '↓ Last ned som PNG'),
  ));
}

// === Kontroller (dropdowns) ===
function renderControls() {
  const root = document.getElementById('analyse-controls');
  if (!root) return;
  root.innerHTML = '';

  // dim1
  root.appendChild(controlGroup('Grupper etter',
    selectEl('analyse-dim1', dimsAsOptions(false), ANALYSE_STATE.dim1)));
  // dim2
  root.appendChild(controlGroup('Andre dim',
    selectEl('analyse-dim2', [{ value: '', label: '—' }, ...dimsAsOptions(false)], ANALYSE_STATE.dim2 || '')));
  // metric
  root.appendChild(controlGroup('Mål',
    selectEl('analyse-metric',
      [{ value: 'count', label: 'Antall' }, { value: 'sum', label: 'Sum' }],
      ANALYSE_STATE.metric)));
  // valueCol
  root.appendChild(controlGroup('Verdikolonne',
    selectEl('analyse-valuecol',
      [{ value: '', label: '—' }, ...valueColsAsOptions()],
      ANALYSE_STATE.valueCol || '')));
  // impute-missing
  root.appendChild(controlGroup('',
    el('label', { class: 'analyse-checkbox' },
      el('input', { type: 'checkbox', id: 'analyse-impute',
        checked: ANALYSE_STATE.imputeMissing ? '' : false }),
      ' Imputer manglende med gjennomsnitt')));
  // chart-type
  root.appendChild(controlGroup('Diagram',
    selectEl('analyse-charttype',
      Object.entries(CHART_TYPES).map(([v, l]) => ({ value: v, label: l })),
      ANALYSE_STATE.chartType)));
}

function controlGroup(label, child) {
  const wrap = el('div', { class: 'analyse-control-group' });
  if (label) wrap.appendChild(el('div', { class: 'analyse-control-label' }, label));
  wrap.appendChild(child);
  return wrap;
}

function selectEl(id, options, current) {
  const sel = el('select', { id });
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (String(o.value) === String(current)) opt.setAttribute('selected', '');
    sel.appendChild(opt);
  }
  return sel;
}

function dimsAsOptions(_includeNone) {
  return Object.values(DIMS).map(d => ({ value: d.id, label: d.label }));
}

function valueColsAsOptions() {
  return Object.values(VALUE_COLS).map(v => ({ value: v.id, label: v.label }));
}

// === Wire kontroller (lyttere) ===
function wireControls() {
  bindSelect('analyse-dim1',      v => { ANALYSE_STATE.dim1 = v || 'area'; afterChange(); });
  bindSelect('analyse-dim2',      v => { ANALYSE_STATE.dim2 = v || null;   afterChange(); });
  bindSelect('analyse-metric',    v => {
    ANALYSE_STATE.metric = v;
    // Auto-velg valueCol første gang sum velges hvis ingen er valgt
    if (v === 'sum' && !ANALYSE_STATE.valueCol) {
      ANALYSE_STATE.valueCol = Object.keys(VALUE_COLS)[0];
    }
    renderControls(); wireControls();   // re-bind etter re-render
    afterChange();
  });
  bindSelect('analyse-valuecol',  v => { ANALYSE_STATE.valueCol = v || null; afterChange(); });
  bindSelect('analyse-charttype', v => { ANALYSE_STATE.chartType = v;        afterChange(); });
  const cb = document.getElementById('analyse-impute');
  if (cb) cb.addEventListener('change', e => {
    ANALYSE_STATE.imputeMissing = e.target.checked;
    afterChange();
  });
  const dl = document.getElementById('analyse-download-png');
  if (dl) dl.addEventListener('click', downloadPng);
}

function bindSelect(id, fn) {
  const node = document.getElementById(id);
  if (node) node.addEventListener('change', e => fn(e.target.value));
}

function afterChange() {
  saveAnalyseState();
  renderChart();
}

// === Preset-meny ===
function wirePresetMenu() {
  const btn = document.getElementById('preset-menu-btn');
  const panel = document.getElementById('preset-menu-panel');
  if (!btn || !panel) return;

  // Bygg paneldata én gang
  renderPresetMenu();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.hidden;
    if (isOpen) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    } else {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function renderPresetMenu() {
  const panel = document.getElementById('preset-menu-panel');
  if (!panel) return;
  panel.innerHTML = '';
  const groups = {};
  for (const p of PRESETS) (groups[p.group] = groups[p.group] || []).push(p);
  for (const [groupName, items] of Object.entries(groups)) {
    panel.appendChild(el('h4', { class: 'preset-menu-group' }, groupName));
    for (const p of items) {
      const row = el('button', {
        type: 'button',
        class: 'preset-menu-item',
        onclick: () => applyPreset(p.id),
      }, p.name);
      panel.appendChild(row);
    }
  }
}

function applyPreset(presetId) {
  const p = PRESETS.find(x => x.id === presetId);
  if (!p) return;
  ANALYSE_STATE.dim1 = p.dim1;
  ANALYSE_STATE.dim2 = p.dim2;
  ANALYSE_STATE.metric = p.metric;
  ANALYSE_STATE.valueCol = p.valueCol;
  ANALYSE_STATE.imputeMissing = p.imputeMissing;
  ANALYSE_STATE.chartType = p.chartType;
  saveAnalyseState();
  renderControls(); wireControls();
  const panel = document.getElementById('preset-menu-panel');
  if (panel) panel.hidden = true;
  const btn = document.getElementById('preset-menu-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  renderChart();
}

// === Aggregering ===
function aggregate(rows, state) {
  const dim = DIMS[state.dim1];
  const dim2 = state.dim2 ? DIMS[state.dim2] : null;
  if (!dim) return { result: {}, imputedMean: null, totalProjects: rows.length, valueCount: 0 };

  const buckets = new Map();   // dim1Key -> dim2Key -> [projects]

  for (const r of rows) {
    const d1Vals = toArray(dim.get(r));
    const d2Vals = dim2 ? toArray(dim2.get(r)) : ['__total__'];

    for (const v1 of d1Vals) {
      for (const v2 of d2Vals) {
        const k1 = (v1 == null || v1 === '') ? '(tom)' : String(v1);
        const k2 = (v2 == null || v2 === '') ? '(tom)' : String(v2);
        if (!buckets.has(k1)) buckets.set(k1, new Map());
        const inner = buckets.get(k1);
        if (!inner.has(k2)) inner.set(k2, []);
        inner.get(k2).push(r);
      }
    }
  }

  // Beregn imputert gjennomsnitt hvis aktuelt
  let imputedMean = null;
  let valueCount = 0;
  if (state.metric === 'sum' && state.valueCol) {
    const vc = VALUE_COLS[state.valueCol];
    if (vc) {
      const values = rows.map(vc.get).filter(v => v != null && Number.isFinite(v));
      valueCount = values.length;
      if (state.imputeMissing && values.length > 0) {
        imputedMean = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }
  }

  const result = {};
  for (const [k1, inner] of buckets) {
    result[k1] = {};
    for (const [k2, projs] of inner) {
      if (state.metric === 'count') {
        result[k1][k2] = projs.length;
      } else {
        const vc = VALUE_COLS[state.valueCol];
        if (!vc) { result[k1][k2] = 0; continue; }
        let sum = 0;
        for (const r of projs) {
          const v = vc.get(r);
          if (v != null && Number.isFinite(v)) sum += v;
          else if (imputedMean != null) sum += imputedMean;
        }
        result[k1][k2] = sum;
      }
    }
  }

  return { result, imputedMean, totalProjects: rows.length, valueCount };
}

function sortGroupKeys(keys, dimId) {
  const dim = DIMS[dimId];
  if (!dim) return keys;
  // Numeriske år: stigende
  if (dimId === 'year_changed' || dimId === 'year_started') {
    return [...keys].sort((a, b) => String(a).localeCompare(String(b), 'nb'));
  }
  // Andre: alfabetisk
  return [...keys].sort((a, b) => String(a).localeCompare(String(b), 'nb'));
}

function chartTypeMap(t) {
  if (t === 'line') return 'line';
  if (t === 'pie') return 'pie';
  // bar, hbar, stacked, grouped
  return 'bar';
}

// === Chart-rendering ===
function renderChart() {
  const canvas = document.getElementById('analyse-chart-canvas');
  const info = document.getElementById('analyse-agg-info');
  if (!canvas) return;

  // Destroy gammelt chart hvis det finnes
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  if (!ANALYSE_STATE.rows.length) {
    renderEmptyState('Ingen prosjekter matcher filtrene.');
    if (info) info.textContent = '';
    return;
  }

  const agg = aggregate(ANALYSE_STATE.rows, ANALYSE_STATE);

  if (!Object.keys(agg.result).length) {
    renderEmptyState('Ingen grupper å vise med dette utvalget.');
    renderAggInfo(agg);
    return;
  }

  // Sortering av dim1-nøkler (med top-N for tag)
  let labels = sortGroupKeys(Object.keys(agg.result), ANALYSE_STATE.dim1);
  if (DIMS[ANALYSE_STATE.dim1].topN && labels.length > DIMS[ANALYSE_STATE.dim1].topN) {
    // Sort by total value descending and take top N
    labels.sort((a, b) => {
      const sumA = Object.values(agg.result[a]).reduce((x, y) => x + y, 0);
      const sumB = Object.values(agg.result[b]).reduce((x, y) => x + y, 0);
      return sumB - sumA;
    });
    labels = labels.slice(0, DIMS[ANALYSE_STATE.dim1].topN);
  }

  const config = buildChartConfig(agg.result, labels, ANALYSE_STATE);

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, config);

  renderAggInfo(agg);
}

function buildChartConfig(result, labels, state) {
  const baseType = chartTypeMap(state.chartType);

  // 1D
  if (!state.dim2) {
    const data1D = labels.map(k => result[k]['__total__'] || 0);
    return {
      type: baseType,
      data: {
        labels,
        datasets: [{
          label: state.metric === 'count'
            ? 'Antall'
            : (VALUE_COLS[state.valueCol] ? VALUE_COLS[state.valueCol].label : 'Sum'),
          data: data1D,
          backgroundColor: state.chartType === 'pie' ? CHART_COLORS : CHART_COLORS[0],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: state.chartType === 'hbar' ? 'y' : 'x',
        plugins: {
          legend: { display: state.chartType === 'pie', position: 'bottom' },
          tooltip: { enabled: true },
        },
      },
    };
  }

  // 2D
  const allD2 = new Set();
  for (const k1 of labels) {
    for (const k2 of Object.keys(result[k1])) allD2.add(k2);
  }
  const d2Labels = [...allD2].sort((a, b) => String(a).localeCompare(String(b), 'nb'));

  const datasets = d2Labels.map((d2k, i) => ({
    label: d2k,
    data: labels.map(k1 => result[k1][d2k] || 0),
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
    borderColor: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const stacked = state.chartType === 'stacked';
  return {
    type: baseType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: state.chartType === 'hbar' ? 'y' : 'x',
      scales: stacked ? { x: { stacked: true }, y: { stacked: true } } : undefined,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true },
      },
    },
  };
}

function renderEmptyState(msg) {
  const info = document.getElementById('analyse-agg-info');
  if (info) info.textContent = msg;
  const canvas = document.getElementById('analyse-chart-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function renderAggInfo(agg) {
  const info = document.getElementById('analyse-agg-info');
  if (!info) return;
  const lines = [`${agg.totalProjects} prosjekter`];
  if (ANALYSE_STATE.metric === 'sum' && ANALYSE_STATE.valueCol) {
    const vc = VALUE_COLS[ANALYSE_STATE.valueCol];
    lines.push(`${agg.valueCount} har ${vc ? vc.label : ANALYSE_STATE.valueCol}-verdi`);
    if (agg.imputedMean != null) {
      lines.push(`Imputert gjennomsnitt: ${agg.imputedMean.toFixed(1)}`);
    }
  }
  if (DIMS[ANALYSE_STATE.dim1] && DIMS[ANALYSE_STATE.dim1].multiValue) {
    lines.push(`Totaler overstiger ${agg.totalProjects} (et prosjekt kan ha flere ${DIMS[ANALYSE_STATE.dim1].label.toLowerCase()})`);
  }
  info.textContent = lines.join('\n');
}

// === PNG-eksport ===
function downloadPng() {
  const canvas = document.getElementById('analyse-chart-canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `fhi-${ANALYSE_STATE.dim1}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
