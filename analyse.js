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

// === Placeholder-funksjoner (fylles inn i senere tasks) ===
function renderAnalyseScaffold() {
  const root = document.getElementById('analyse-view');
  if (!root) return;
  root.innerHTML = '<p class="muted" style="padding:1rem">Analyse-panel kommer (Task 4)…</p>';
}
function renderControls() {}
function wireControls() {}
function wirePresetMenu() {}
function renderChart() {
  const root = document.getElementById('analyse-view');
  if (root) root.innerHTML = '<p class="muted" style="padding:1rem">Chart kommer (Task 5)…</p>';
}
