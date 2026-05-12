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
window.TABLE_STATE = TABLE_STATE;

// === Init ===
document.addEventListener('DOMContentLoaded', initTabell);

function initTabell() {
  loadStateFromStorage();
  wireViewToggle();
  wireColumnPicker();
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
  } else if (TABLE_STATE.viewMode === 'table') {
    markTruncated();
  }
}

// === LocalStorage ===
// Gamle default-sett vi migrerer brukere bort fra
const OLD_DEFAULT_SETS = [
  ['title', 'area', 'status', 'source', 'tags', 'period', 'responsible'], // pre-2026-05-12
];

function loadStateFromStorage() {
  try {
    const vm = localStorage.getItem(LS_VIEW_MODE);
    if (vm === 'cards' || vm === 'table' || vm === 'analyse') TABLE_STATE.viewMode = vm;

    const cols = localStorage.getItem(LS_TABLE_COLUMNS);
    if (cols) {
      const parsed = JSON.parse(cols);
      if (Array.isArray(parsed)) {
        const sig = JSON.stringify(parsed);
        const isOldDefault = OLD_DEFAULT_SETS.some(s => JSON.stringify(s) === sig);
        if (isOldDefault) {
          // Migrer: bruker hadde det gamle default-settet (med status osv.),
          // bytt til det nye default-settet
          TABLE_STATE.enabledCols = null;
          localStorage.removeItem(LS_TABLE_COLUMNS);
        } else {
          TABLE_STATE.enabledCols = parsed;
        }
      }
    }

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
  const prevMode = TABLE_STATE.viewMode;
  TABLE_STATE.viewMode = mode;
  if (persist) saveViewMode(mode);
  applyViewMode();
  // Bytte mellom modi krever ofte ny mengde data (paginering vs alle):
  if (prevMode !== mode && typeof loadProjects === 'function') {
    loadProjects();
  } else if (mode === 'table' && TABLE_STATE.rows.length) {
    renderTable();
  }
}

function applyViewMode() {
  const mode = TABLE_STATE.viewMode;
  document.getElementById('cards').hidden = mode !== 'cards';
  document.getElementById('table-view').hidden = mode !== 'table';
  const analyseEl = document.getElementById('analyse-view');
  if (analyseEl) analyseEl.hidden = mode !== 'analyse';
  document.getElementById('pagination').hidden = mode !== 'cards';
  document.getElementById('column-picker-wrap').hidden = mode !== 'table';
  const presetWrap = document.getElementById('preset-menu-wrap');
  if (presetWrap) presetWrap.hidden = mode !== 'analyse';
  // Cards-sortering-dropdown er bare meningsfull i cards-modus
  document.getElementById('sort').disabled = mode !== 'cards';

  for (const btn of document.querySelectorAll('#view-toggle button')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
}

// === Kolonnedefinisjoner ===
const COLUMNS = [
  { id: 'title', label: 'Tittel', group: 'standard', width: 420,
    get: r => r.title || '',
    format: (v, r) => el('span', { class: 'cell-title-link', 'data-slug': r.slug }, v || '(uten tittel)'),
    sortKey: r => (r.title || '').toLowerCase() },
  { id: 'area', label: 'Område', group: 'standard', width: 80,
    get: r => r.area || '',
    format: v => areaBadge(v),
    sortKey: r => r.area || '' },
  { id: 'status', label: 'Status', group: 'standard', width: 100,
    get: r => r.status || '',
    format: v => statusBadge(v),
    sortKey: r => r.status || '' },
  { id: 'source', label: 'Kilde', group: 'standard', width: 160,
    get: r => (r.sources && r.sources.length ? r.sources : (r.source ? [r.source] : [])),
    format: srcs => sourcesCell(srcs),
    sortKey: r => (r.sources && r.sources[0]) || r.source || '' },
  { id: 'tags', label: 'Stikkord', group: 'standard', width: 220,
    get: r => r.tags || [],
    format: tags => formatTagsCell(tags),
    sortKey: r => (r.tags || []).join(',') },
  { id: 'period', label: 'Periode', group: 'standard', width: 140,
    get: r => formatPeriod(r),
    sortKey: r => r.project_start || '' },
  { id: 'responsible', label: 'Prosjektleder', group: 'standard', width: 180,
    get: r => r.responsible || '',
    sortKey: r => (r.responsible || '').toLowerCase() },
  // Ekstra standard-kolonner (tilgjengelige i kolonneplukker)
  { id: 'main_group', label: 'Hovedgruppe', group: 'standard', width: 180,
    get: r => r.main_group || '',
    sortKey: r => r.main_group || '' },
  { id: 'funding', label: 'Finansiering', group: 'standard', width: 200,
    get: r => r.funding || '',
    sortKey: r => (r.funding || '').toLowerCase() },
  { id: 'date_changed', label: 'Sist endret', group: 'standard', width: 120,
    get: r => formatDateShort(r.date_changed),
    sortKey: r => r.date_changed || '' },
  { id: 'description', label: 'Beskrivelse', group: 'standard', width: 320,
    get: r => stripHtml(r.description || ''),
    sortKey: r => (r.description || '').toLowerCase() },
  // Avledede
  { id: 'n_tags', label: '# stikkord', group: 'avledede', width: 80, align: 'right',
    get: r => (r.tags || []).length,
    sortKey: r => (r.tags || []).length },
  { id: 'n_sources', label: '# kilder', group: 'avledede', width: 80, align: 'right',
    get: r => (r.sources || []).length,
    sortKey: r => (r.sources || []).length },
  { id: 'year_changed', label: 'År endret', group: 'avledede', width: 80, align: 'right',
    get: r => (r.date_changed || '').slice(0, 4),
    sortKey: r => (r.date_changed || '').slice(0, 4) },
];

const DEFAULT_COLUMNS = ['title', 'area', 'source', 'tags', 'period', 'responsible'];

function getActiveColumns() {
  const enabled = TABLE_STATE.enabledCols || DEFAULT_COLUMNS;
  const all = allColumnsForCurrentData();
  return enabled
    .map(id => all.find(c => c.id === id))
    .filter(Boolean);
}

function allColumnsForCurrentData() {
  const extras = discoverExtraFieldColumns(TABLE_STATE.rows);
  return COLUMNS.concat(extras);
}

// === Render ===
function renderTable() {
  try {
    _renderTableInner();
  } catch (e) {
    console.error('Feil i tabell-rendring:', e);
    const root = document.getElementById('table-view');
    root.innerHTML = '';
    const banner = el('div', {
      style: 'padding:1rem;margin:1rem 0;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;color:#991b1b',
    });
    banner.appendChild(el('strong', {}, 'Tabell-feil: '));
    banner.appendChild(document.createTextNode(String(e && e.message || e)));
    banner.appendChild(el('pre', {
      style: 'margin-top:0.5rem;font-size:0.75rem;white-space:pre-wrap;color:#7f1d1d',
    }, e && e.stack ? e.stack : '(ingen stack)'));
    root.appendChild(banner);
    // Bytter IKKE tilbake til kort — vi vil at brukeren skal se feilen og rapportere.
  }
}

function _renderTableInner() {
  const root = document.getElementById('table-view');
  root.innerHTML = '';
  if (!TABLE_STATE.rows.length) {
    root.appendChild(el('p', { class: 'muted', style: 'padding:1rem' },
      'Ingen prosjekter matcher filtrene.'));
    return;
  }

  const cols = getActiveColumns();
  const sortedRows = sortRows(TABLE_STATE.rows, cols);

  // Beregn proporsjonale bredder fra col.width-hintene så tabellen alltid
  // fyller tilgjengelig bredde og skalerer ned/opp med viewport.
  const totalWidth = cols.reduce((s, c) => s + (c.width || 100), 0) || 1;
  const pctWidths = cols.map(c => ((c.width || 100) / totalWidth * 100).toFixed(2));

  const table = el('table', { class: 'data-table' });
  table.appendChild(renderHeader(cols, pctWidths));
  const tbody = el('tbody', {});
  for (const row of sortedRows) tbody.appendChild(renderRow(row, cols, pctWidths));
  table.appendChild(tbody);
  root.appendChild(table);
  wireTableClicks(table);
  requestAnimationFrame(markTruncated);
}

function renderHeader(cols, pctWidths) {
  const thead = el('thead', {});
  const tr = el('tr', {});
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const isSorted = TABLE_STATE.sort.col === col.id;
    const arrow = !isSorted ? '↕' : (TABLE_STATE.sort.dir === 'asc' ? '↑' : '↓');
    const th = el('th', {
      class: isSorted ? 'sorted' : '',
      style: `width:${pctWidths[i]}%;text-align:${col.align || 'left'}`,
      title: 'Klikk for å sortere',
      onclick: () => onHeaderClick(col.id),
    }, col.label, ' ', el('span', { class: 'sort-arrow' }, arrow));
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function renderRow(row, cols, pctWidths) {
  const tr = el('tr', { 'data-slug': row.slug });
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const val = col.get(row);
    const cellContent = col.format ? col.format(val, row) : (val == null ? '' : String(val));
    const td = el('td', {
      class: 'cell',
      'data-col-id': col.id,
      style: `width:${pctWidths[i]}%;text-align:${col.align || 'left'}`,
    });
    if (cellContent instanceof Node) td.appendChild(cellContent);
    else if (cellContent && typeof cellContent === 'object' && cellContent.nodeType === undefined) td.append(cellContent);
    else td.appendChild(document.createTextNode(String(cellContent ?? '')));
    tr.appendChild(td);
  }
  return tr;
}

// === Klikk-håndtering ===
function wireTableClicks(table) {
  table.addEventListener('click', (e) => {
    // Titlel-klikk → detail-dialog
    const titleSpan = e.target.closest('.cell-title-link');
    if (titleSpan) {
      const slug = titleSpan.dataset.slug;
      if (slug && typeof window.openDetail === 'function') {
        window.openDetail(slug);
      }
      return;
    }
    // Celle-klikk (kun avkortede celler er klikkbare)
    const td = e.target.closest('td.truncated');
    if (td) {
      const colId = td.dataset.colId;
      const tr = td.closest('tr');
      const slug = tr && tr.dataset.slug;
      const row = TABLE_STATE.rows.find(r => r.slug === slug);
      const col = allColumnsForCurrentData().find(c => c.id === colId);
      if (row && col) openCellDialog(col, row);
    }
  });
}

function markTruncated() {
  const tds = document.querySelectorAll('.data-table tbody td');
  for (const td of tds) {
    const isTrunc = td.scrollWidth > td.clientWidth + 1;
    td.classList.toggle('truncated', isTrunc);
  }
}

function openCellDialog(col, row) {
  const dlg = document.getElementById('cell-dialog');
  const root = document.getElementById('cell-content');
  root.innerHTML = '';
  root.appendChild(el('h3', {}, col.label));

  const val = col.get(row);
  root.appendChild(renderCellValue(val, col, row));

  // Lenke til full prosjekt-detalj
  if (row.slug) {
    root.appendChild(el('p', { style: 'margin-top:1rem;border-top:1px solid #eee;padding-top:0.5rem' },
      el('a', {
        href: '#',
        onclick: (ev) => {
          ev.preventDefault();
          dlg.close();
          if (typeof window.openDetail === 'function') window.openDetail(row.slug);
        },
      }, '↗ Gå til prosjekt-detalj'),
    ));
  }
  dlg.showModal();
}

function renderCellValue(val, col, row) {
  // Lenke-felt (kun http/https — blokker javascript:-URL-er)
  if (typeof val === 'string' && /^https?:\/\//.test(val)) {
    return el('p', {}, el('a', { href: val, target: '_blank', rel: 'noopener' }, val));
  }
  // Liste (stikkord, partnere, sources)
  if (Array.isArray(val)) {
    if (!val.length) return el('p', { class: 'muted' }, '(tom)');
    const ul = el('ul', {});
    for (const item of val) ul.appendChild(el('li', {}, String(item)));
    return ul;
  }
  // Tall
  if (typeof val === 'number') return el('p', {}, String(val));
  // Strenger: prøv JSON-parse (Cristin extra_fields-verdier er ofte JSON-strenger)
  if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
    try {
      const parsed = JSON.parse(val);
      return el('pre', {}, JSON.stringify(parsed, null, 2));
    } catch {
      // fall through til ren tekst
    }
  }
  // Default: ren tekst med wrap
  return el('p', { style: 'white-space:pre-wrap;word-break:break-word' }, String(val ?? ''));
}

// === Sortering ===
function sortRows(rows, cols) {
  const sortCol = allColumnsForCurrentData().find(c => c.id === TABLE_STATE.sort.col);
  if (!sortCol) return rows.slice();
  const keyFn = sortCol.sortKey || (r => sortCol.get(r));
  const dir = TABLE_STATE.sort.dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const ka = keyFn(a), kb = keyFn(b);
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1 * dir;
    if (kb == null) return -1 * dir;
    if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
    return String(ka).localeCompare(String(kb), 'nb') * dir;
  });
}

function onHeaderClick(colId) {
  if (TABLE_STATE.sort.col === colId) {
    TABLE_STATE.sort.dir = TABLE_STATE.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    TABLE_STATE.sort = { col: colId, dir: 'asc' };
  }
  saveSort(TABLE_STATE.sort);
  renderTable();
}

// === Formattere ===
function formatPeriod(r) {
  const start = r.project_start ? r.project_start.slice(0, 4) : '';
  const end = r.project_end ? r.project_end.slice(0, 4) : '';
  if (!start && !end) return '';
  if (start && !end) return `${start} –`;
  if (!start && end) return `– ${end}`;
  return `${start} – ${end}`;
}

function formatDateShort(d) {
  if (!d) return '';
  return d.slice(0, 10);
}

function formatTagsCell(tags) {
  if (!tags || !tags.length) return document.createTextNode('');
  const frag = document.createDocumentFragment();
  const show = tags.slice(0, 3);
  for (const t of show) frag.appendChild(el('span', { class: 'tag-chip' }, t));
  if (tags.length > 3) frag.appendChild(el('span', { class: 'tag-chip' }, `+${tags.length - 3}`));
  return frag;
}

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// === Dynamiske extra_fields-kolonner ===
function discoverExtraFieldColumns(rows) {
  // Returnerer kolonne-definisjoner for hver unik extra_fields-nøkkel,
  // gruppert etter hvilken kilde den primært tilhører.
  const byKeyAndSource = new Map();   // key -> Set<source>
  for (const r of rows) {
    const ef = r.extra_fields || {};
    const src = r.source || 'ukjent';
    for (const key of Object.keys(ef)) {
      if (!byKeyAndSource.has(key)) byKeyAndSource.set(key, new Set());
      byKeyAndSource.get(key).add(src);
    }
  }

  const cols = [];
  for (const [key, sources] of byKeyAndSource.entries()) {
    // Mest hyppige kilde for denne nøkkelen blir gruppen
    const group = pickGroup(sources, rows, key);
    cols.push({
      id: `ef:${key}`,
      label: key,
      group,
      width: 200,
      get: (r) => {
        const ef = (r.extra_fields || {})[key];
        if (!ef) return '';
        const v = (typeof ef === 'object' && 'value' in ef) ? ef.value : ef;
        return v == null ? '' : String(v);
      },
      sortKey: (r) => {
        const ef = (r.extra_fields || {})[key];
        if (!ef) return '';
        const v = (typeof ef === 'object' && 'value' in ef) ? ef.value : ef;
        if (v == null || v === '') return '';
        // Tallverdier sorteres som tall hvis mulig
        const n = Number(v);
        return Number.isFinite(n) ? n : String(v).toLowerCase();
      },
    });
  }
  return cols;
}

function pickGroup(sourceSet, rows, key) {
  // Tell hvor mange rader per kilde har denne nøkkelen
  const counts = {};
  for (const r of rows) {
    if (r.extra_fields && key in r.extra_fields) {
      const s = r.source || 'ukjent';
      counts[s] = (counts[s] || 0) + 1;
    }
  }
  let best = null, bestN = -1;
  for (const [s, n] of Object.entries(counts)) {
    if (n > bestN) { best = s; bestN = n; }
  }
  if (best === 'NVA') return 'NVA';
  if (best === 'eProtokoll') return 'eProtokoll';
  if (best && ['FF', 'SM', 'KRG', 'HT', 'HD', 'MH'].includes(best)) return 'fhi.no';
  return 'avledede';
}

// === Kolonneplukker ===
function wireColumnPicker() {
  const btn = document.getElementById('column-picker-btn');
  const panel = document.getElementById('column-picker-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.hidden;
    if (isOpen) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    } else {
      renderColumnPicker();
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

function renderColumnPicker() {
  const panel = document.getElementById('column-picker-panel');
  panel.innerHTML = '';
  const active = new Set(TABLE_STATE.enabledCols || DEFAULT_COLUMNS);

  // Grupper kolonner
  const groups = {};
  for (const col of allColumnsForCurrentData()) {
    (groups[col.group] = groups[col.group] || []).push(col);
  }
  const groupOrder = ['standard', 'eProtokoll', 'NVA', 'fhi.no', 'avledede'];
  const groupLabel = {
    standard: 'Standard',
    eProtokoll: 'eProtokoll',
    NVA: 'NVA / Cristin',
    'fhi.no': 'fhi.no',
    avledede: 'Avledede',
  };

  for (const groupId of groupOrder) {
    const cols = groups[groupId] || [];
    if (!cols.length) continue;
    panel.appendChild(el('h4', { class: 'picker-group' }, groupLabel[groupId] || groupId));
    for (const col of cols) {
      const id = `pick-${col.id}`;
      const label = el('label', { class: 'picker-row' },
        el('input', {
          type: 'checkbox',
          id,
          checked: active.has(col.id) ? '' : false,
        }),
        ' ',
        col.label,
      );
      label.querySelector('input').addEventListener('change', (e) => {
        toggleColumn(col.id, e.target.checked);
      });
      panel.appendChild(label);
    }
  }

  const reset = el('button', {
    type: 'button',
    class: 'picker-reset',
    onclick: resetColumns,
  }, 'Nullstill til standard');
  panel.appendChild(reset);
}

function toggleColumn(colId, on) {
  const current = TABLE_STATE.enabledCols || DEFAULT_COLUMNS.slice();
  let next;
  if (on) {
    if (!current.includes(colId)) {
      // Plasser i samme rekkefølge som COLUMNS-array
      const order = allColumnsForCurrentData().map(c => c.id);
      next = current.concat(colId).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    } else {
      next = current.slice();
    }
  } else {
    next = current.filter(id => id !== colId);
  }
  TABLE_STATE.enabledCols = next;
  saveEnabledCols(next);
  renderTable();
}

function resetColumns() {
  TABLE_STATE.enabledCols = null;
  localStorage.removeItem(LS_TABLE_COLUMNS);
  renderColumnPicker();
  renderTable();
}

// === Helpers ===
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
