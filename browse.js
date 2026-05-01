// Browse-side: filterbar liste over prosjekter med paginering, sortering og søk.

const STATE = {
  filters: { area: '', main_group: '', tags: new Set(), status: '', q: '' },
  sort: 'date_changed',
  page: 0,
  pageSize: 25,
  total: 0,
  facets: null,
};

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupEventListeners();
  await loadFacets();
  loadProjects();
}

function setupEventListeners() {
  $('text-search').addEventListener('input', debounce(() => {
    STATE.filters.q = $('text-search').value.trim();
    STATE.page = 0;
    loadProjects();
  }, 300));

  $('sort').addEventListener('change', () => {
    STATE.sort = $('sort').value;
    STATE.page = 0;
    loadProjects();
  });

  $('reset-filters').addEventListener('click', () => {
    STATE.filters = { area: '', main_group: '', tags: new Set(), status: '', q: '' };
    STATE.sort = 'date_changed';
    STATE.page = 0;
    $('text-search').value = '';
    $('sort').value = 'date_changed';
    document.querySelectorAll('input[type=radio][value=""]').forEach(r => r.checked = true);
    document.querySelectorAll('#area-filter input, #tag-filter input').forEach(c => c.checked = false);
    loadProjects();
  });

  $('tag-search').addEventListener('input', () => {
    const q = $('tag-search').value.toLowerCase();
    document.querySelectorAll('#tag-filter label').forEach(l => {
      l.style.display = l.dataset.searchText.includes(q) ? '' : 'none';
    });
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadFacets() {
  try {
    STATE.facets = await api('/api/facets');
  } catch (e) {
    console.error('Kunne ikke laste facets:', e);
    return;
  }
  renderMainGroupFilter(STATE.facets.main_groups);
  renderAreaFilter(STATE.facets.areas);
  renderTagFilter(STATE.facets.tags);
}

function renderMainGroupFilter(groups) {
  const root = $('main-group-filter');
  for (const g of groups) {
    const id = `mg-${g.code}`;
    const lbl = el('label', {},
      el('input', { type: 'radio', name: 'main_group', value: g.code, id }),
      ` ${g.name}`,
      el('span', { class: 'filter-count' }, ` (${g.count})`),
    );
    lbl.querySelector('input').addEventListener('change', e => {
      STATE.filters.main_group = e.target.value;
      STATE.page = 0;
      loadProjects();
    });
    root.appendChild(lbl);
  }
}

function renderAreaFilter(areas) {
  const root = $('area-filter');
  root.innerHTML = '';
  for (const a of areas) {
    const lbl = el('label', { 'data-search-text': a.name.toLowerCase() },
      el('input', { type: 'checkbox', value: a.code }),
      ` ${a.code} – ${a.name}`,
      el('span', { class: 'filter-count' }, ` (${a.count})`),
    );
    lbl.querySelector('input').addEventListener('change', e => {
      // Bare ett område kan velges via checkboxer (vi bruker dem som radio for enkelhet)
      const target = e.target;
      document.querySelectorAll('#area-filter input').forEach(c => { if (c !== target) c.checked = false; });
      STATE.filters.area = target.checked ? target.value : '';
      STATE.page = 0;
      loadProjects();
    });
    root.appendChild(lbl);
  }
}

function renderTagFilter(tags) {
  const root = $('tag-filter');
  root.innerHTML = '';
  for (const t of tags) {
    const lbl = el('label', { 'data-search-text': t.display_name.toLowerCase() },
      el('input', { type: 'checkbox', value: t.id }),
      ` ${t.display_name}`,
      el('span', { class: 'filter-count' }, ` (${t.count})`),
    );
    lbl.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) STATE.filters.tags.add(e.target.value);
      else STATE.filters.tags.delete(e.target.value);
      STATE.page = 0;
      loadProjects();
    });
    root.appendChild(lbl);
  }
}

async function loadProjects() {
  const params = new URLSearchParams();
  if (STATE.filters.area) params.set('area', STATE.filters.area);
  if (STATE.filters.main_group) params.set('main_group', STATE.filters.main_group);
  if (STATE.filters.tags.size) params.set('tags', [...STATE.filters.tags].join(','));
  if (STATE.filters.status) params.set('status', STATE.filters.status);
  if (STATE.filters.q) params.set('q', STATE.filters.q);
  params.set('sort', STATE.sort);
  params.set('page', STATE.page);
  params.set('page_size', STATE.pageSize);

  const cards = $('cards');
  cards.innerHTML = '<p class="muted">Laster…</p>';
  try {
    const data = await api('/api/projects?' + params);
    STATE.total = data.total;
    renderCards(data.items);
    renderPagination();
    $('result-count').textContent = `${data.total} prosjekter`;
  } catch (e) {
    cards.innerHTML = `<p class="muted">Feil: ${escapeHtml(e.message)}</p>`;
  }

  // Status-radio
  document.querySelectorAll('input[name=status]').forEach(r => {
    r.onchange = () => { STATE.filters.status = r.value; STATE.page = 0; loadProjects(); };
  });
}

function renderCards(items) {
  const root = $('cards');
  if (!items.length) {
    root.innerHTML = '<p class="muted">Ingen prosjekter matcher filtrene.</p>';
    return;
  }
  root.innerHTML = '';
  for (const p of items) {
    const card = el('article', { class: 'card', onclick: () => openDetail(p.slug) },
      el('h3', {}, p.title),
      el('p', { class: 'desc' }, (p.description || '').slice(0, 200)),
      el('div', { class: 'meta' },
        areaBadge(p.area),
        statusBadge(p.status),
        ...(p.tags || []).slice(0, 4).map(t => el('span', { class: 'tag-chip' }, t)),
        (p.tags || []).length > 4 ? el('span', { class: 'tag-chip' }, `+${p.tags.length - 4}`) : null,
      ),
    );
    root.appendChild(card);
  }
}

function renderPagination() {
  const root = $('pagination');
  root.innerHTML = '';
  const totalPages = Math.ceil(STATE.total / STATE.pageSize);
  if (totalPages <= 1) return;
  const goto = (p) => { STATE.page = p; loadProjects(); window.scrollTo(0, 0); };

  root.appendChild(el('button', { onclick: () => goto(Math.max(0, STATE.page - 1)),
    disabled: STATE.page === 0 ? '' : false }, '← Forrige'));

  // Side-tall, men maks ~10 vist
  const pages = [];
  const start = Math.max(0, STATE.page - 4);
  const end = Math.min(totalPages, start + 10);
  for (let i = start; i < end; i++) pages.push(i);
  for (const p of pages) {
    root.appendChild(el('button', {
      class: p === STATE.page ? 'active' : '',
      onclick: () => goto(p),
    }, String(p + 1)));
  }

  root.appendChild(el('button', { onclick: () => goto(Math.min(totalPages - 1, STATE.page + 1)),
    disabled: STATE.page >= totalPages - 1 ? '' : false }, 'Neste →'));
}

async function openDetail(slug) {
  const root = $('detail-content');
  root.innerHTML = '<p class="muted">Laster…</p>';
  $('detail-dialog').showModal();
  try {
    const p = await api('/api/projects/' + encodeURIComponent(slug));
    root.innerHTML = '';
    root.appendChild(el('h2', {}, p.title));
    root.appendChild(el('div', { class: 'meta', style: 'margin-bottom:1rem' },
      areaBadge(p.area),
      statusBadge(p.status),
      ...(p.tags || []).map(t => el('span', { class: 'tag-chip' }, t)),
    ));

    if (p.description) root.appendChild(el('p', { class: 'muted' }, p.description));

    const dl = el('dl', { style: 'margin: 0.5rem 0' });
    if (p.responsible)   dl.append(el('dt', {}, 'Prosjektleder:'),  el('dd', {}, p.responsible));
    if (p.partners?.length) dl.append(el('dt', {}, 'Medarbeidere:'), el('dd', {}, p.partners.join(', ')));
    if (p.funding)       dl.append(el('dt', {}, 'Finansiering:'),   el('dd', {}, p.funding));
    if (p.project_start) dl.append(el('dt', {}, 'Periode:'),         el('dd', {}, `${p.project_start}${p.project_end ? ' – ' + p.project_end : ''}`));
    if (dl.children.length) root.appendChild(dl);

    const SECTION_TITLES = {
      sammendrag: 'Sammendrag', bakgrunn: 'Bakgrunn', hensikt: 'Hensikt',
      gjennomforing: 'Gjennomføring', organisering: 'Organisering',
      resultater: 'Resultater og publikasjoner', status: 'Status',
      funn: 'Funn', publikasjoner: 'Publikasjoner',
    };
    for (const [key, text] of Object.entries(p.sections || {})) {
      if (!text) continue;
      const block = el('div', { class: 'section-block' },
        el('h3', {}, SECTION_TITLES[key] || key),
        el('p', {}, text),
      );
      root.appendChild(block);
    }

    if (p.url) {
      const fullUrl = p.url.startsWith('http') ? p.url : 'https://www.fhi.no' + p.url;
      root.appendChild(el('p', {},
        el('a', { href: fullUrl, target: '_blank', rel: 'noopener' }, 'Se prosjektet på fhi.no →'),
      ));
    }
  } catch (e) {
    root.innerHTML = `<p class="muted">Feil: ${escapeHtml(e.message)}</p>`;
  }
}
