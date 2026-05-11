// Tabell-visning som alternativ til kort-grid.
// Lytter på 'projects-loaded'-event fra browse.js og rendrer samme datasett.

const LS_VIEW_MODE = 'fhi_view_mode';
const LS_TABLE_COLUMNS = 'fhi_table_columns';
const LS_TABLE_SORT = 'fhi_table_sort';
const MOBILE_BREAKPOINT = 640;

// === State ===
const TABLE_STATE = {
  rows: [],                              // siste prosjekter mottatt
  viewMode: 'cards',                     // 'cards' | 'table'
  enabledCols: null,                     // array av kolonne-id-er; null = bruk default
  sort: { col: 'date_changed', dir: 'desc' },
};

// === Init ===
document.addEventListener('DOMContentLoaded', initTabell);

function initTabell() {
  loadStateFromStorage();
  wireViewToggle();
  // Tvunget cards på mobil
  if (window.innerWidth < MOBILE_BREAKPOINT && TABLE_STATE.viewMode === 'table') {
    TABLE_STATE.viewMode = 'cards';
  }
  applyViewMode();
  window.addEventListener('projects-loaded', onProjectsLoaded);
  window.addEventListener('resize', debounce(onResize, 200));
}

function onProjectsLoaded(e) {
  TABLE_STATE.rows = e.detail.items || [];
  if (TABLE_STATE.viewMode === 'table') renderTable();
}

function onResize() {
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  document.getElementById('view-toggle').style.display = isMobile ? 'none' : '';
  if (isMobile && TABLE_STATE.viewMode === 'table') {
    setViewMode('cards', { persist: false });
  }
}

// === LocalStorage ===
function loadStateFromStorage() {
  try {
    const vm = localStorage.getItem(LS_VIEW_MODE);
    if (vm === 'cards' || vm === 'table') TABLE_STATE.viewMode = vm;

    const cols = localStorage.getItem(LS_TABLE_COLUMNS);
    if (cols) TABLE_STATE.enabledCols = JSON.parse(cols);

    const sort = localStorage.getItem(LS_TABLE_SORT);
    if (sort) {
      const parsed = JSON.parse(sort);
      if (parsed && parsed.col && (parsed.dir === 'asc' || parsed.dir === 'desc')) {
        TABLE_STATE.sort = parsed;
      }
    }
  } catch (e) {
    console.warn('Klarte ikke å lese tabell-state fra localStorage:', e);
  }
}

function saveViewMode(mode) { localStorage.setItem(LS_VIEW_MODE, mode); }
function saveEnabledCols(cols) { localStorage.setItem(LS_TABLE_COLUMNS, JSON.stringify(cols)); }
function saveSort(sort) { localStorage.setItem(LS_TABLE_SORT, JSON.stringify(sort)); }

// === View-toggle ===
function wireViewToggle() {
  const toggle = document.getElementById('view-toggle');
  if (!toggle) return;
  for (const btn of toggle.querySelectorAll('button')) {
    btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
  }
  // Skjul toggle på mobil
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    toggle.style.display = 'none';
  }
}

function setViewMode(mode, { persist = true } = {}) {
  TABLE_STATE.viewMode = mode;
  if (persist) saveViewMode(mode);
  applyViewMode();
  if (mode === 'table' && TABLE_STATE.rows.length) renderTable();
}

function applyViewMode() {
  const mode = TABLE_STATE.viewMode;
  document.getElementById('cards').hidden = mode !== 'cards';
  document.getElementById('table-view').hidden = mode !== 'table';
  document.getElementById('pagination').hidden = mode !== 'cards';
  document.getElementById('column-picker-wrap').hidden = mode !== 'table';
  // Cards-sortering-dropdown er bare meningsfull i cards-modus
  document.getElementById('sort').disabled = mode !== 'cards';

  for (const btn of document.querySelectorAll('#view-toggle button')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
}

// === Render (placeholder — implementeres i Task 6) ===
function renderTable() {
  const root = document.getElementById('table-view');
  root.innerHTML = '<p class="muted">Tabell kommer (Task 6)…</p>';
}

// === Helpers ===
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
