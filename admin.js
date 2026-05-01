// Admin-side: legg til, rediger eller reklassifiser prosjekter.

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

function init() {
  if (!adminKey()) {
    $('key-prompt').classList.remove('hidden');
    $('admin-tabs').classList.add('hidden');
  }
  $('save-admin-key').addEventListener('click', () => {
    const v = $('admin-key-input').value.trim();
    if (!v) return;
    setAdminKey(v);
    $('key-prompt').classList.add('hidden');
    $('admin-tabs').classList.remove('hidden');
  });

  // Tab-switch
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  $('url-submit').addEventListener('click', submitUrl);
  $('manual-form').addEventListener('submit', submitManual);
  $('load-andre').addEventListener('click', loadAndre);
  $('reclassify-btn').addEventListener('click', runReclassify);
}

async function submitUrl() {
  const url = $('url-input').value.trim();
  if (!url) return;
  const result = $('url-result');
  result.innerHTML = '<p class="muted">Skraper…</p>';
  try {
    const r = await api('/api/admin/add', {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey() },
      body: JSON.stringify({ url }),
    });
    result.innerHTML = `<p style="color:var(--ok)">Lagret: <strong>${escapeHtml(r.title)}</strong>
      (område: ${r.area}, stikkord: ${(r.tags || []).join(', ') || '—'})</p>`;
    $('url-input').value = '';
  } catch (e) {
    if (e.message.startsWith('401')) {
      clearAdminKey();
      result.innerHTML = '<p style="color:var(--error)">Feil admin-nøkkel. <a href="javascript:location.reload()">Prøv igjen</a>.</p>';
    } else {
      result.innerHTML = `<p style="color:var(--error)">Feil: ${escapeHtml(e.message)}</p>`;
    }
  }
}

async function submitManual(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());

  // Bygg sections-objektet
  const sections = {};
  for (const k of ['sammendrag', 'bakgrunn', 'hensikt', 'gjennomforing']) {
    if (data[k]) sections[k] = data[k];
    delete data[k];
  }

  // Splitt partners på linjeskift
  data.partners = (data.partners || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  data.sections = sections;

  const result = $('manual-result');
  result.innerHTML = '<p class="muted">Lagrer…</p>';
  try {
    const r = await api('/api/admin/add', {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey() },
      body: JSON.stringify({ manual: data }),
    });
    result.innerHTML = `<p style="color:var(--ok)">Lagret: <strong>${escapeHtml(r.title)}</strong>
      (slug: ${r.slug}, område: ${r.area})</p>`;
    e.target.reset();
  } catch (e2) {
    result.innerHTML = `<p style="color:var(--error)">Feil: ${escapeHtml(e2.message)}</p>`;
  }
}

async function loadAndre() {
  const root = $('andre-list');
  root.innerHTML = '<p class="muted">Laster…</p>';
  try {
    const r = await api('/api/projects?area=ANDRE&page=0&page_size=200');
    root.innerHTML = `<p class="muted">${r.total} prosjekter klassifisert som ANDRE.</p>`;
    for (const p of r.items) {
      const row = renderAndreRow(p);
      root.appendChild(row);
    }
  } catch (e) {
    root.innerHTML = `<p style="color:var(--error)">Feil: ${escapeHtml(e.message)}</p>`;
  }
}

function renderAndreRow(p) {
  const select = el('select', {},
    el('option', { value: '' }, '— velg område —'),
    ...['HT', 'FF', 'SM', 'MH', 'HD', 'KRG', 'ANDRE'].map(c =>
      el('option', { value: c }, `${c} — ${AREA_NAMES[c]}`),
    ),
  );
  const status = el('span', { class: 'muted' }, '');

  const save = el('button', { class: 'btn-link' }, 'Lagre');
  save.addEventListener('click', async () => {
    const area = select.value;
    if (!area) return;
    status.textContent = 'Lagrer…';
    try {
      const main_group = (area === 'HT' || area === 'HD') ? 'helsetjenesten'
                       : (area === 'ANDRE' ? 'ukjent' : 'folkehelse');
      await api('/api/admin/projects/' + encodeURIComponent(p.slug), {
        method: 'PATCH',
        headers: { 'X-Admin-Key': adminKey() },
        body: JSON.stringify({ area, main_group }),
      });
      status.textContent = 'Lagret ✓';
      status.style.color = 'var(--ok)';
    } catch (e) {
      status.textContent = 'Feil: ' + e.message;
      status.style.color = 'var(--error)';
    }
  });

  return el('div', { class: 'card', style: 'margin-bottom: 0.5rem' },
    el('h4', {}, p.title),
    el('p', { class: 'muted' }, (p.description || '').slice(0, 200)),
    el('div', { style: 'display:flex;gap:0.5rem;align-items:center' }, select, save, status),
  );
}

async function runReclassify() {
  const force = $('force-reclassify').checked;
  const result = $('reclassify-result');
  result.innerHTML = '<p class="muted">Kjører… (kan ta 30-60 sek for 763 prosjekter)</p>';
  try {
    const r = await api('/api/admin/reclassify', {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey() },
      body: JSON.stringify({ force }),
    });
    result.innerHTML = `<p style="color:var(--ok)">Ferdig. Totalt ${r.total},
      endret ${r.changed}, hoppet over ${r.skipped_manual} manuelle.</p>`;
  } catch (e) {
    result.innerHTML = `<p style="color:var(--error)">Feil: ${escapeHtml(e.message)}</p>`;
  }
}
