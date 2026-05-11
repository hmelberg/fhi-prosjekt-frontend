# Tabell-visning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legge til en alternativ tabell-visning til index.html (toggle Cards↔Tabell), med konfigurerbare kolonner, kolonneklikk-sortering, og modal for fullt celleinnhold.

**Architecture:** Vanilla JS + HTML-tabell, ingen nye dependencies. Ny fil `tabell.js` (~250 linjer) lytter på et `projects-loaded`-event fra `browse.js` og rendrer en `<table>` ved siden av (men i samme container som) cards-grid. State (visningsmodus, kolonner, sortering) lagres i `localStorage`. Backend-endring: tillat `page_size=0` for å hente alle filtrerte og utvid `_serialize_card`.

**Tech Stack:** Vanlig HTML/CSS/JS. Anvil Python-backend. Ingen testrammeverk (frontend har ingen tester i dag — spec sier eksplisitt at v1 verifiseres manuelt).

**Spec:** [`../specs/2026-05-11-tabell-visning-design.md`](../specs/2026-05-11-tabell-visning-design.md)

**Avvik fra standard skill-prosess:** Spec'en sier "ingen automatiserte tester i v1". Hver task har derfor en **Manuell verifisering**-blokk i stedet for TDD-stegene. Vi committer fortsatt hyppig (én commit per task).

---

## Forutsetninger og oppsett

- Arbeidsmappe: `/Users/hom/claude/fhiprosjekt/`
- Frontend-git-repo: `/Users/hom/claude/fhiprosjekt/frontend/` (remote: `hmelberg/fhi-prosjekt-frontend`)
- Backend-koden ligger i `/Users/hom/claude/fhiprosjekt/anvil_app/` — denne mappen er **ikke** koblet til git på denne maskinen. Anvil synker selv via `hmelberg/fhi-prosjekt`-repoet. Etter Task 1 må endringen i `search.py` enten:
  - (a) Pushes via separat sjekkout av `hmelberg/fhi-prosjekt`, eller
  - (b) Limes inn manuelt i Anvil-IDE-en (Server Code → search.py)
- Live API: `https://fhi-prosjekt.anvil.app/_/api`
- Live frontend: deployes automatisk fra `main`-branch via Netlify

---

## Filoversikt

| Fil | Hva |
|---|---|
| `anvil_app/server_code/search.py` | **MODIFY** — `page_size=0`-støtte, utvid `_serialize_card` |
| `frontend/index.html` | **MODIFY** — toolbar-utvidelse, `<dialog id="cell-dialog">`, `<script src="tabell.js">` |
| `frontend/app.js` | **MODIFY** — legg til `SOURCE_NAMES`, `sourceBadge()`, eksponere `openDetail` |
| `frontend/browse.js` | **MODIFY** — emit `projects-loaded`-event etter datalasting |
| `frontend/tabell.js` | **CREATE** — all tabell-spesifikk kode (~250 linjer) |
| `frontend/styles.css` | **MODIFY** — tabell, toolbar-knapper, source-badges, cell-dialog, mobil |

---

## Task 1: Backend — page_size=0 + utvidet `_serialize_card`

**Files:**
- Modify: `anvil_app/server_code/search.py` (linjer 91-127)

- [ ] **Step 1: Åpne `search.py` og oppdater paginerings-logikken**

I funksjonen `search_projects`, finn dette (rundt linje 99-103):

```python
    total = len(out)
    page = max(0, int(page))
    page_size = max(1, min(int(page_size), 200))
    items = out[page * page_size : (page + 1) * page_size]
```

Erstatt med:

```python
    total = len(out)
    page = max(0, int(page))
    ps = int(page_size)
    if ps <= 0:
        # page_size=0 betyr "alle filtrerte rader" (brukes av tabell-visning)
        page_size = total if total > 0 else 1
        items = out
    else:
        page_size = max(1, min(ps, 500))   # cap økt fra 200 til 500
        items = out[page * page_size : (page + 1) * page_size]
```

- [ ] **Step 2: Utvid `_serialize_card` med felter tabellen trenger**

Finn funksjonen (linje 113-127) og erstatt hele kroppen med:

```python
def _serialize_card(r: dict) -> dict:
    return {
        "slug": r["slug"],
        "title": r.get("title"),
        "description": r.get("description"),
        "url": r.get("url"),
        "status": r.get("status"),
        "area": r.get("area"),
        "main_group": r.get("main_group"),
        "tags": r.get("tags") or [],
        "project_start": r.get("project_start"),
        "project_end": r.get("project_end"),
        "image_url": r.get("image_url"),
        "admin_added": bool(r.get("_admin_added")),
        # Nye felt for tabell-visning:
        "source": r.get("source"),
        "sources": r.get("sources") or [],
        "responsible": r.get("responsible"),
        "funding": r.get("funding"),
        "date_changed": r.get("date_changed"),
        "extra_fields": r.get("extra_fields") or {},
    }
```

- [ ] **Step 3: Manuell verifisering — lokal syntaks-sjekk**

Kjør:

```bash
python3 -c "import ast; ast.parse(open('/Users/hom/claude/fhiprosjekt/anvil_app/server_code/search.py').read()); print('OK')"
```

Forventet output: `OK`

- [ ] **Step 4: Distribuer endringen til Anvil**

Velg én av:

(a) Hvis du har `hmelberg/fhi-prosjekt`-repoet sjekket ut et annet sted: kopier den endrede `search.py` dit, commit og push. Anvil henter automatisk.

(b) Åpne Anvil-IDE → Server Code → `search.py`. Lim inn de to endringene over manuelt. Trykk "Publish".

- [ ] **Step 5: Manuell verifisering — live API**

Etter at Anvil har deployet (~30 sek), kjør:

```bash
# page_size=0 skal returnere alle filtrerte
curl -s "https://fhi-prosjekt.anvil.app/_/api/projects?page_size=0" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'total={d[\"total\"]} items={len(d[\"items\"])} page_size={d[\"page_size\"]}')
print(f'first item has source: {\"source\" in d[\"items\"][0]}')
print(f'first item has extra_fields: {\"extra_fields\" in d[\"items\"][0]}')
"
```

Forventet: total == items (alle returnert), og både `source` og `extra_fields` finnes i hver rad.

- [ ] **Step 6: Commit**

Backend-koden ligger ikke i samme git-repo som frontend. Hvis du gjorde (a) i Step 4, committet du allerede. Hvis (b), så er endringen committet av Anvil sin egen GitHub-sync. Ingen lokal commit nødvendig herfra.

---

## Task 2: Frontend-helpers — `sourceBadge`, `SOURCE_NAMES`, badge-CSS

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Legg til `SOURCE_NAMES`-konstant og `sourceBadge`-helper i `app.js`**

Etter `AREA_NAMES` og `STATUS_NAMES` (rundt linje 79), legg til:

```js
const SOURCE_NAMES = {
  NVA: 'NVA / Cristin',
  eProtokoll: 'eProtokoll',
  TILDELINGSBREV: 'Tildelingsbrev',
  VIRKSOMHETSPLAN: 'Virksomhetsplan',
  FF: 'Folkehelse og forebygging',
  SM: 'Smittevern',
  KRG: 'Kreftregisteret',
  HT: 'Helsetjenester',
  HD: 'Helsedata og digitalisering',
  MH: 'Miljø og helse',
  RAPPORT: 'Rapport',
};

function sourceBadge(source) {
  if (!source) return el('span', { class: 'source-badge', title: 'Ukjent kilde' }, '—');
  const title = SOURCE_NAMES[source] || source;
  return el('span', { class: `source-badge source-${source}`, title }, source);
}

function sourcesCell(sources) {
  // Returnerer et fragment med en badge per kilde
  const frag = document.createDocumentFragment();
  for (const s of sources) frag.appendChild(sourceBadge(s));
  return frag;
}
```

- [ ] **Step 2: Legg til CSS for source-badges i `styles.css`**

På bunnen av `styles.css`, legg til:

```css
/* ===== Source badges ===== */
.source-badge {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  background: #e0e7ff;
  color: #3730a3;
  margin-right: 0.2rem;
  white-space: nowrap;
}
.source-NVA            { background: #fef3c7; color: #92400e; }
.source-eProtokoll     { background: #d1fae5; color: #065f46; }
.source-TILDELINGSBREV { background: #fce7f3; color: #9d174d; }
.source-VIRKSOMHETSPLAN { background: #ede9fe; color: #5b21b6; }
.source-FF             { background: #fee2e2; color: #991b1b; }
.source-SM             { background: #dbeafe; color: #1e40af; }
.source-KRG            { background: #fef9c3; color: #854d0e; }
.source-HT             { background: #dcfce7; color: #166534; }
.source-HD             { background: #cffafe; color: #155e75; }
.source-MH             { background: #ecfccb; color: #3f6212; }
```

- [ ] **Step 3: Manuell verifisering**

```bash
cd /Users/hom/claude/fhiprosjekt/frontend
python3 -m http.server 8000 &
sleep 1
open http://localhost:8000
```

Åpne Konsoll i nettleseren. Skriv:

```js
document.body.appendChild(sourceBadge('NVA'));
document.body.appendChild(sourceBadge('eProtokoll'));
document.body.appendChild(sourceBadge('FF'));
```

Forventet: tre fargede badges vises på siden, hver med riktig kilde-farge.

Stopp http-serveren etter sjekk: `kill %1`.

- [ ] **Step 4: Commit**

```bash
cd /Users/hom/claude/fhiprosjekt/frontend
git add app.js styles.css
git commit -m "$(cat <<'EOF'
Legg til sourceBadge-helper og SOURCE_NAMES-konstant

Forberedelse for tabell-visning (feature #1). Brukes også
senere når kilde blir filter-dimensjon (feature #2).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Emit `projects-loaded`-event fra browse.js

**Files:**
- Modify: `frontend/browse.js` (rundt linje 143-145)

- [ ] **Step 1: Legg til event-emit i `loadProjects`**

Finn (linje 142-147 omtrent):

```js
  try {
    const data = await api('/api/projects?' + params);
    STATE.total = data.total;
    renderCards(data.items);
    renderPagination();
    $('result-count').textContent = `${data.total} prosjekter`;
  } catch (e) {
    cards.innerHTML = `<p class="muted">Feil: ${escapeHtml(e.message)}</p>`;
  }
```

Erstatt med:

```js
  try {
    const data = await api('/api/projects?' + params);
    STATE.total = data.total;
    renderCards(data.items);
    renderPagination();
    $('result-count').textContent = `${data.total} prosjekter`;
    // Tabell-visningen lytter på dette eventet — den bruker samme datasett
    window.dispatchEvent(new CustomEvent('projects-loaded', {
      detail: { items: data.items, total: data.total, params: params.toString() },
    }));
  } catch (e) {
    cards.innerHTML = `<p class="muted">Feil: ${escapeHtml(e.message)}</p>`;
    window.dispatchEvent(new CustomEvent('projects-error', { detail: { error: e } }));
  }
```

- [ ] **Step 2: Manuell verifisering**

```bash
cd /Users/hom/claude/fhiprosjekt/frontend
python3 -m http.server 8000 &
sleep 1
open http://localhost:8000
```

I konsollen:

```js
window.addEventListener('projects-loaded', e => console.log('GOT', e.detail.items.length, 'items'));
// Trigger ved å endre et filter eller laste siden på nytt
location.reload();
```

Forventet: Etter ny lasting, log-melding "GOT N items" hvor N matcher antallet kort som vises.

Stopp serveren: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add browse.js
git commit -m "$(cat <<'EOF'
Emit projects-loaded-event etter datalasting

Tabell-visningen (kommer) abonnerer på dette eventet for å
rendre samme datasett som cards uten å gjøre ny API-request.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: HTML-scaffold — toolbar, tabell-container, cell-dialog

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Utvid `.results-bar` i `index.html`**

Finn (linje 55-64):

```html
  <section class="results">
    <div class="results-bar">
      <input type="search" id="text-search" placeholder="Fritekst-søk i tittel og beskrivelse…">
      <select id="sort">
        <option value="date_changed">Sist endret</option>
        <option value="title">Tittel A-Å</option>
        <option value="project_start">Prosjektstart</option>
      </select>
      <span id="result-count" class="muted"></span>
    </div>
    <div id="cards" class="card-grid"></div>
    <div id="pagination" class="pagination"></div>
  </section>
```

Erstatt med:

```html
  <section class="results">
    <div class="results-bar">
      <input type="search" id="text-search" placeholder="Fritekst-søk i tittel og beskrivelse…">
      <select id="sort" aria-label="Sortering for kort-visning">
        <option value="date_changed">Sist endret</option>
        <option value="title">Tittel A-Å</option>
        <option value="project_start">Prosjektstart</option>
      </select>
      <div class="view-toggle" id="view-toggle" role="group" aria-label="Visningsmodus">
        <button type="button" data-mode="cards" class="active">Kort</button>
        <button type="button" data-mode="table">Tabell</button>
      </div>
      <div class="column-picker-wrap" id="column-picker-wrap" hidden>
        <button type="button" id="column-picker-btn" aria-haspopup="true" aria-expanded="false">
          Kolonner ▾
        </button>
        <div class="column-picker-panel" id="column-picker-panel" hidden></div>
      </div>
      <span id="result-count" class="muted"></span>
    </div>
    <div id="cards" class="card-grid"></div>
    <div id="table-view" class="table-view" hidden></div>
    <div id="pagination" class="pagination"></div>
  </section>
```

- [ ] **Step 2: Legg til `<dialog id="cell-dialog">` rett etter eksisterende detail-dialog**

Finn (linje 70-73):

```html
<dialog id="detail-dialog">
  <div class="dialog-inner" id="detail-content"></div>
  <button class="dialog-close" onclick="document.getElementById('detail-dialog').close()">Lukk</button>
</dialog>
```

Like under den, legg til:

```html
<dialog id="cell-dialog">
  <div class="dialog-inner" id="cell-content"></div>
  <button class="dialog-close" onclick="document.getElementById('cell-dialog').close()">Lukk</button>
</dialog>
```

- [ ] **Step 3: Legg `<script src="tabell.js">` etter `browse.js`**

Finn (linje 79-80):

```html
<script src="app.js"></script>
<script src="browse.js"></script>
```

Endre til:

```html
<script src="app.js"></script>
<script src="browse.js"></script>
<script src="tabell.js"></script>
```

- [ ] **Step 4: Manuell verifisering**

```bash
cd /Users/hom/claude/fhiprosjekt/frontend
python3 -m http.server 8000 &
sleep 1
open http://localhost:8000
```

Forventet:
- Siden lastes. Toolbar har nå "Kort / Tabell"-toggle synlig (Kort er aktiv)
- "Kolonner ▾"-knappen er skjult (parent har `hidden`)
- Konsoll viser én 404 for `tabell.js` (filen finnes ikke ennå) — det er forventet
- Kort-visning ser uendret ut bortsett fra de nye knappene

Stopp serveren: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
HTML-scaffold for tabell-visning

Legger til toggle Cards↔Tabell, kolonneplukker-knapp,
tabell-container, cell-dialog, og script-tag for tabell.js.
tabell.js opprettes i neste task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Opprett `tabell.js` — skjelett, state, view-toggle

**Files:**
- Create: `frontend/tabell.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Opprett `tabell.js` med skjelett, state og view-toggle**

Lag ny fil `frontend/tabell.js`:

```js
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
```

- [ ] **Step 2: Legg til CSS for view-toggle og placeholder-tabell i `styles.css`**

På bunnen av `styles.css`:

```css
/* ===== View toggle ===== */
.view-toggle {
  display: inline-flex;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: hidden;
  margin-left: 0.5rem;
}
.view-toggle button {
  padding: 0.4rem 0.8rem;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.view-toggle button.active {
  background: #3730a3;
  color: white;
}
.view-toggle button:hover:not(.active) { background: #f3f4f6; }

/* ===== Tabell-container ===== */
.table-view {
  margin-top: 0.5rem;
  overflow-x: auto;
}

/* ===== Mobil ===== */
@media (max-width: 640px) {
  .view-toggle { display: none !important; }
  .column-picker-wrap { display: none !important; }
  .table-view { display: none !important; }
}
```

- [ ] **Step 3: Manuell verifisering**

```bash
cd /Users/hom/claude/fhiprosjekt/frontend
python3 -m http.server 8000 &
sleep 1
open http://localhost:8000
```

Forventet:
- 404 for tabell.js er borte
- Klikk "Tabell" → cards skjules, tabellen viser "Tabell kommer (Task 6)…", "Kolonner ▾"-knappen blir synlig
- Klikk "Kort" → tilbake
- Sortering-dropdown blir grå/disabled i tabell-modus
- Last siden på nytt etter å ha valgt "Tabell" → siden åpnes i tabell-modus
- Krymp vinduet under 640 px → toggle og "Kolonner" forsvinner

Stopp serveren: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add tabell.js styles.css
git commit -m "$(cat <<'EOF'
tabell.js skjelett: view-toggle + localStorage-state

State for view-mode/kolonner/sortering lagres i localStorage.
Toggle Cards↔Tabell veksler synlighet for cards-grid og
tabell-container. Selve tabell-rendringen kommer i Task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Tabell-render — kolonnedefinisjoner, header, rader

**Files:**
- Modify: `frontend/tabell.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Erstatt placeholder-`renderTable` med ekte rendering**

I `tabell.js`, erstatt blokken `// === Render (placeholder ...) ===` med:

```js
// === Kolonnedefinisjoner ===
const COLUMNS = [
  { id: 'title', label: 'Tittel', group: 'standard', width: 280,
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

const DEFAULT_COLUMNS = ['title', 'area', 'status', 'source', 'tags', 'period', 'responsible'];

function getActiveColumns() {
  const enabled = TABLE_STATE.enabledCols || DEFAULT_COLUMNS;
  return enabled
    .map(id => COLUMNS.find(c => c.id === id))
    .filter(Boolean);
}

// === Render ===
function renderTable() {
  const root = document.getElementById('table-view');
  root.innerHTML = '';
  if (!TABLE_STATE.rows.length) {
    root.appendChild(el('p', { class: 'muted', style: 'padding:1rem' },
      'Ingen prosjekter matcher filtrene.'));
    return;
  }

  const cols = getActiveColumns();
  const sortedRows = sortRows(TABLE_STATE.rows, cols);

  const table = el('table', { class: 'data-table' });
  table.appendChild(renderHeader(cols));
  const tbody = el('tbody', {});
  for (const row of sortedRows) tbody.appendChild(renderRow(row, cols));
  table.appendChild(tbody);
  root.appendChild(table);
}

function renderHeader(cols) {
  const thead = el('thead', {});
  const tr = el('tr', {});
  for (const col of cols) {
    const isSorted = TABLE_STATE.sort.col === col.id;
    const arrow = !isSorted ? '↕' : (TABLE_STATE.sort.dir === 'asc' ? '↑' : '↓');
    const th = el('th', {
      class: isSorted ? 'sorted' : '',
      style: `width:${col.width}px;text-align:${col.align || 'left'}`,
      title: 'Klikk for å sortere',
      onclick: () => onHeaderClick(col.id),
    }, col.label, ' ', el('span', { class: 'sort-arrow' }, arrow));
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function renderRow(row, cols) {
  const tr = el('tr', { 'data-slug': row.slug });
  for (const col of cols) {
    const val = col.get(row);
    const cellContent = col.format ? col.format(val, row) : (val == null ? '' : String(val));
    const td = el('td', {
      class: 'cell',
      'data-col-id': col.id,
      style: `text-align:${col.align || 'left'}`,
    });
    if (cellContent instanceof Node) td.appendChild(cellContent);
    else if (cellContent && typeof cellContent === 'object' && cellContent.nodeType === undefined) td.append(cellContent);
    else td.appendChild(document.createTextNode(String(cellContent ?? '')));
    tr.appendChild(td);
  }
  return tr;
}

// === Sortering ===
function sortRows(rows, cols) {
  const sortCol = COLUMNS.find(c => c.id === TABLE_STATE.sort.col);
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
```

- [ ] **Step 2: Legg til CSS for tabellen i `styles.css`**

På bunnen:

```css
/* ===== Data table ===== */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  table-layout: fixed;
}
.data-table thead th {
  position: sticky;
  top: 0;
  background: #f5f5f5;
  border-bottom: 2px solid #d0d7de;
  padding: 0.5rem 0.75rem;
  text-align: left;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  z-index: 1;
  white-space: nowrap;
}
.data-table thead th:hover { background: #ececec; }
.data-table thead th .sort-arrow {
  margin-left: 0.25rem;
  opacity: 0.4;
  font-size: 0.75rem;
}
.data-table thead th.sorted .sort-arrow { opacity: 1; }

.data-table tbody td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #eee;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: top;
}
.data-table tbody tr:hover { background: rgba(0,0,0,0.025); }

.data-table .cell-title-link {
  color: #3730a3;
  cursor: pointer;
}
.data-table .cell-title-link:hover { text-decoration: underline; }
```

- [ ] **Step 3: Manuell verifisering**

Start serveren og last siden. Bytt til Tabell-modus.

Forventet:
- Tabellen viser 7 default-kolonner (Tittel, Område, Status, Kilde, Stikkord, Periode, Prosjektleder)
- Header har ↕-piler i alle kolonner, og pilen ved aktiv sortering er solid (↑/↓)
- Klikk på en header → rader sorteres, pil-retning bytter ved ny klikk
- Stikkord vises som chips (maks 3 + "+N")
- Kilde vises som badge per kilde
- Lange tittel-celler avkortes med "..."
- Siste sortering huskes ved sidelast

- [ ] **Step 4: Commit**

```bash
git add tabell.js styles.css
git commit -m "$(cat <<'EOF'
Tabell-render: 7 default-kolonner med klikkbar sortering

Sortering kjøres klient-side på allerede hentet datasett.
Inkluderer formattere for periode, dato, stikkord og kilde-liste.
Klikk på tittel/celler hekter ikke noe ennå — kommer i Task 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Bruk `page_size=0` når tabellen er aktiv

**Files:**
- Modify: `frontend/browse.js`

Tabellen ber om alle filtrerte rader. Cards beholder paginering.

- [ ] **Step 1: Endre `loadProjects` til å justere `page_size` etter modus**

I `browse.js`, finn `async function loadProjects()` (rundt linje 129) og finn linjen:

```js
  params.set('page_size', STATE.pageSize);
```

Erstatt med:

```js
  // Tabell-modus laster alle filtrerte; cards beholder paginering.
  // window.TABLE_STATE settes av tabell.js ved init.
  const inTableMode = window.TABLE_STATE && TABLE_STATE.viewMode === 'table';
  params.set('page_size', inTableMode ? 0 : STATE.pageSize);
```

- [ ] **Step 2: Gjør `TABLE_STATE` globalt fra `tabell.js`**

Øverst i `tabell.js`, etter erklæringen av `TABLE_STATE`, legg til:

```js
window.TABLE_STATE = TABLE_STATE;
```

(Plasser direkte under `const TABLE_STATE = { ... };`-blokken.)

- [ ] **Step 3: Re-load ved bytte til tabell-modus**

I `tabell.js`, finn `setViewMode`:

```js
function setViewMode(mode, { persist = true } = {}) {
  TABLE_STATE.viewMode = mode;
  if (persist) saveViewMode(mode);
  applyViewMode();
  if (mode === 'table' && TABLE_STATE.rows.length) renderTable();
}
```

Erstatt med:

```js
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
```

- [ ] **Step 4: Manuell verifisering**

Start serveren, åpne siden, sjekk Network-tab i nettleser-DevTools.

Forventet:
- I cards-modus: `GET /api/projects?...&page_size=25` (eller 25)
- Bytt til Tabell → ny request `GET /api/projects?...&page_size=0`, returnerer alle ~500 (aktive) eller ~2353 (ufiltrert) rader
- Tabellen viser alle filtrerte rader, ingen paginering vises
- Bytt tilbake til Kort → ny request med `page_size=25`, paginering viser opp igjen

- [ ] **Step 5: Commit**

```bash
git add browse.js tabell.js
git commit -m "$(cat <<'EOF'
Tabell-modus laster alle filtrerte (page_size=0)

Cards beholder paginering (page_size=25). Bytte mellom modi
trigger ny API-request fordi mengden data er forskjellig.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Klikk på celler — detail-dialog + cell-dialog

**Files:**
- Modify: `frontend/tabell.js`
- Modify: `frontend/browse.js` (gjøre `openDetail` global)
- Modify: `frontend/styles.css`

- [ ] **Step 1: Eksponer `openDetail` på `window` fra `browse.js`**

På bunnen av `browse.js` (etter `async function openDetail(slug)`), legg til:

```js
window.openDetail = openDetail;
```

- [ ] **Step 2: Legg til klikkhåndtering og avkortet-deteksjon i `tabell.js`**

Etter `renderRow`-funksjonen, legg til:

```js
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
      const col = COLUMNS.find(c => c.id === colId);
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
  // Lenke-felt
  if (col.id === 'url' || (typeof val === 'string' && /^https?:\/\//.test(val))) {
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
```

- [ ] **Step 3: Hekt klikk-handling og truncation-mark inn i render-flyten**

Finn `renderTable` og oppdater slik at den hekter inn klikkhandling og kjører markTruncated etter render:

Finn (i nylig skrevet renderTable):

```js
  table.appendChild(renderHeader(cols));
  const tbody = el('tbody', {});
  for (const row of sortedRows) tbody.appendChild(renderRow(row, cols));
  table.appendChild(tbody);
  root.appendChild(table);
}
```

Erstatt med:

```js
  table.appendChild(renderHeader(cols));
  const tbody = el('tbody', {});
  for (const row of sortedRows) tbody.appendChild(renderRow(row, cols));
  table.appendChild(tbody);
  root.appendChild(table);
  wireTableClicks(table);
  // requestAnimationFrame for å sikre at layout har kjørt før vi måler
  requestAnimationFrame(markTruncated);
}
```

- [ ] **Step 4: Re-mål truncation ved vindusresize**

I `tabell.js`, finn `onResize`:

```js
function onResize() {
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  document.getElementById('view-toggle').style.display = isMobile ? 'none' : '';
  if (isMobile && TABLE_STATE.viewMode === 'table') {
    setViewMode('cards', { persist: false });
  }
}
```

Erstatt med:

```js
function onResize() {
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  document.getElementById('view-toggle').style.display = isMobile ? 'none' : '';
  if (isMobile && TABLE_STATE.viewMode === 'table') {
    setViewMode('cards', { persist: false });
  } else if (TABLE_STATE.viewMode === 'table') {
    markTruncated();
  }
}
```

- [ ] **Step 5: CSS-justering for avkortede celler og cell-dialog**

På bunnen av `styles.css`:

```css
/* Bare avkortede celler blir klikkbare */
.data-table tbody td.truncated { cursor: pointer; }
.data-table tbody td.truncated:hover { background: rgba(55, 48, 163, 0.05); }
.data-table tbody td.cell:not(.truncated) { cursor: default; }

/* Title-celle er alltid klikkbar (hele lenke-spannet) */
.data-table tbody td[data-col-id="title"] { cursor: default; }
.data-table tbody td[data-col-id="title"] .cell-title-link { cursor: pointer; }

/* Cell-dialog */
#cell-dialog .dialog-inner {
  min-width: 320px;
  max-width: min(640px, 90vw);
  max-height: 70vh;
  overflow-y: auto;
}
#cell-dialog h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: #3730a3;
}
#cell-dialog pre {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f6f8fa;
  padding: 0.5rem;
  border-radius: 4px;
  margin: 0;
}
#cell-dialog ul { margin: 0; padding-left: 1.25rem; }
```

- [ ] **Step 6: Manuell verifisering**

Start serveren, åpne siden, bytt til Tabell.

Forventet:
- Klikk på en tittel → detail-dialog åpnes med full prosjekt-info (samme som dagens cards)
- Klikk på en lang/avkortet beskrivelses-celle → cell-dialog åpnes med "Beskrivelse" som tittel og full tekst
- Klikk på "Status"-cellen (kort verdi som "active") → ingenting skjer
- Klikk på en stikkord-celle med mange tags → cell-dialog viser hele lista som `<ul>`
- I cell-dialog, klikk "↗ Gå til prosjekt-detalj" → cell-dialog lukkes, detail-dialog åpnes
- Krymp og voks vinduet → flere/færre celler blir avkortet, klikk fungerer fortsatt

- [ ] **Step 7: Commit**

```bash
git add tabell.js browse.js styles.css
git commit -m "$(cat <<'EOF'
Tabell: klikk-flyt for detail-dialog og cell-dialog

Tittel-celle åpner full prosjekt-detalj (gjenbruker openDetail).
Avkortede celler (scrollWidth > clientWidth) åpner cell-dialog
med kolonnens navn og full verdi. Cristin JSON-strenger pretty-
printes som <pre>. Celler som passer er ikke klikkbare.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Kolonneplukker — panel, checkbokser, persistens

**Files:**
- Modify: `frontend/tabell.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Legg til kolonneplukker-render i `tabell.js`**

På bunnen av `tabell.js` (før den siste `// === Helpers ===`-blokken), legg til:

```js
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
  for (const col of COLUMNS) {
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
      const order = COLUMNS.map(c => c.id);
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
```

- [ ] **Step 2: Hekt `wireColumnPicker` inn i `initTabell`**

Finn `initTabell()`:

```js
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
```

Erstatt med:

```js
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
```

- [ ] **Step 3: Legg til CSS for kolonneplukker-panel**

På bunnen av `styles.css`:

```css
/* ===== Column picker ===== */
.column-picker-wrap {
  position: relative;
  display: inline-block;
  margin-left: 0.5rem;
}
#column-picker-btn {
  padding: 0.4rem 0.8rem;
  background: white;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}
#column-picker-btn:hover { background: #f3f4f6; }

.column-picker-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 280px;
  max-height: 60vh;
  overflow-y: auto;
  background: white;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 0.5rem;
  z-index: 100;
}
.column-picker-panel h4.picker-group {
  margin: 0.5rem 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
}
.column-picker-panel h4.picker-group:first-child { margin-top: 0; }
.picker-row {
  display: flex;
  align-items: center;
  padding: 0.2rem 0.25rem;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.875rem;
}
.picker-row:hover { background: #f3f4f6; }
.picker-row input { margin-right: 0.5rem; }
.picker-reset {
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.4rem;
  background: #f3f4f6;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}
.picker-reset:hover { background: #e5e7eb; }
```

- [ ] **Step 4: Manuell verifisering**

Start serveren, bytt til Tabell-modus.

Forventet:
- "Kolonner ▾" åpner et panel under knappen
- Panelet har "STANDARD" og "AVLEDEDE" som grupperinger med checkbokser
- 7 default-kolonner er huket på
- Klikk på "Beskrivelse"-checkboks → kolonnen vises i tabellen, plassert i samme rekkefølge som COLUMNS-array
- Klikk for å huke av en kolonne → forsvinner fra tabellen
- "Nullstill til standard" → 7 default-kolonner igjen
- Klikk utenfor panelet → panelet lukkes
- Last siden på nytt → kolonnevalgene huskes

- [ ] **Step 5: Commit**

```bash
git add tabell.js styles.css
git commit -m "$(cat <<'EOF'
Tabell: kolonneplukker med checkbokser og persistens

Panel åpnes under 'Kolonner ▾'-knappen. Kolonnene grupperes
etter source. Valget lagres i localStorage. Nullstill-knapp
gjenoppretter standard-settet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Extra_fields-oppdagelse — dynamiske kolonner per kilde

**Files:**
- Modify: `frontend/tabell.js`

- [ ] **Step 1: Legg til oppdagelses-funksjon**

I `tabell.js`, like før `// === Kolonneplukker ===`-blokken, legg til:

```js
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
        // Tallverdier sorteres som tall hvis mulig
        const n = Number(v);
        return Number.isFinite(n) ? n : String(v ?? '').toLowerCase();
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
```

- [ ] **Step 2: Slå sammen ekstra-kolonner med statiske i `getActiveColumns`**

Erstatt eksisterende `getActiveColumns`:

```js
function getActiveColumns() {
  const enabled = TABLE_STATE.enabledCols || DEFAULT_COLUMNS;
  const all = allColumnsForCurrentData();
  return enabled
    .map(id => all.find(c => c.id === id))
    .filter(Boolean);
}
```

Og legg til:

```js
function allColumnsForCurrentData() {
  const extras = discoverExtraFieldColumns(TABLE_STATE.rows);
  return COLUMNS.concat(extras);
}
```

- [ ] **Step 3: Bruk `allColumnsForCurrentData()` i kolonneplukker og sortering**

I `renderColumnPicker()`, erstatt linjen:

```js
  for (const col of COLUMNS) {
```

med:

```js
  for (const col of allColumnsForCurrentData()) {
```

I `sortRows()`, erstatt:

```js
  const sortCol = COLUMNS.find(c => c.id === TABLE_STATE.sort.col);
```

med:

```js
  const sortCol = allColumnsForCurrentData().find(c => c.id === TABLE_STATE.sort.col);
```

I `onHeaderClick` og `toggleColumn`, erstatt referanser til `COLUMNS` med `allColumnsForCurrentData()` der det brukes til oppslag. Konkret:

I `toggleColumn`:

```js
    if (!current.includes(colId)) {
      const order = COLUMNS.map(c => c.id);
      next = current.concat(colId).sort((a, b) => order.indexOf(a) - order.indexOf(b));
```

Erstatt med:

```js
    if (!current.includes(colId)) {
      const order = allColumnsForCurrentData().map(c => c.id);
      next = current.concat(colId).sort((a, b) => order.indexOf(a) - order.indexOf(b));
```

- [ ] **Step 4: Skjul tomme grupper**

I `renderColumnPicker`, finn:

```js
  for (const groupId of groupOrder) {
    const cols = groups[groupId] || [];
    if (!cols.length) continue;
```

Dette håndteres allerede. Ingen endring.

- [ ] **Step 5: Manuell verifisering**

Start serveren, bytt til Tabell-modus.

Forventet:
- Med ufiltrert data (alle 1975-2353 rader): "Kolonner ▾" viser nå STANDARD, NVA, eProtokoll, og AVLEDEDE som grupper
- eProtokoll-gruppen har felter som "Antall månedsverk i 2025", "Kategori", "Type prosjekt", "Prosjektleder (FHI)" osv.
- NVA-gruppen har "type", "identifiers", "contributors", "published" osv.
- Slå på "Antall månedsverk i 2025" → kolonnen vises. Verdier vises for eProtokoll-rader, tomme for andre
- Klikk på sortpil i "Antall månedsverk i 2025" → rader sorteres numerisk (ikke alfabetisk)
- Filtrer i sidepanelet til et område som ikke har NVA-prosjekter → NVA-gruppen blir tom og forsvinner fra plukkeren
- Klikk celle med Cristin-`contributors`-verdi → cell-dialog viser pretty-printet JSON

- [ ] **Step 6: Commit**

```bash
git add tabell.js
git commit -m "$(cat <<'EOF'
Tabell: oppdag extra_fields som dynamiske kolonner

Skanner extra_fields i synlige rader og lager kolonner per
unik nøkkel, gruppert etter dominant kilde (NVA/eProtokoll/
fhi.no/avledede). Talledverdier sorteres numerisk.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Feiltoleranse — try/catch fallback til cards

**Files:**
- Modify: `frontend/tabell.js`

- [ ] **Step 1: Pakk `renderTable` i try/catch**

Finn `function renderTable()` og erstatt hele funksjonen med:

```js
function renderTable() {
  try {
    _renderTableInner();
  } catch (e) {
    console.error('Feil i tabell-rendring, faller tilbake til kort:', e);
    const root = document.getElementById('table-view');
    root.innerHTML = '';
    root.appendChild(el('p', { class: 'muted', style: 'padding:1rem;color:#991b1b' },
      'Tabell-rendringen feilet. Bytter til kort-visning. Detaljer i konsollen.'));
    setViewMode('cards', { persist: false });
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

  const table = el('table', { class: 'data-table' });
  table.appendChild(renderHeader(cols));
  const tbody = el('tbody', {});
  for (const row of sortedRows) tbody.appendChild(renderRow(row, cols));
  table.appendChild(tbody);
  root.appendChild(table);
  wireTableClicks(table);
  requestAnimationFrame(markTruncated);
}
```

- [ ] **Step 2: Manuell verifisering**

Test rollback ved å midlertidig sabotere en eksisterende kolonne så `format` kaster. Åpne nettleser-konsollen i tabell-modus og kjør:

```js
const c = COLUMNS.find(x => x.id === 'title');
const origFormat = c.format;
c.format = () => { throw new Error('test-feil'); };
renderTable();
// Rydd opp:
c.format = origFormat;
```

Forventet:
- Konsoll-feilmelding `"Feil i tabell-rendring, faller tilbake til kort: Error: test-feil"`
- Tabellen viser kort feilmelding "Tabell-rendringen feilet. Bytter til kort-visning..."
- Visningen bytter tilbake til cards (uten å persistere — neste sidelast åpner i tabell hvis det var siste valgte modus)

Verifiser også at `getActiveColumns` håndterer ukjente kolonne-id-er pent (ikke crash, bare færre kolonner):

```js
TABLE_STATE.enabledCols = ['fake_col', 'title'];
renderTable();
// Forventet: tabellen viser kun "Tittel"-kolonnen, ingen feil
```

Rydd opp:

```js
TABLE_STATE.enabledCols = null;
localStorage.removeItem('fhi_table_columns');
location.reload();
```

- [ ] **Step 3: Commit**

```bash
git add tabell.js
git commit -m "$(cat <<'EOF'
Tabell: try/catch i renderTable, fallback til cards ved feil

Beskytter mot at en korrupt kolonne-id i localStorage eller en
uventet datastruktur bryter hele siden. Feilen loggføres,
brukeren får en kort melding og siden faller tilbake til kort.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: End-to-end manuell verifisering

**Files:** Ingen kodeendringer.

- [ ] **Step 1: Sett opp test-økt**

```bash
cd /Users/hom/claude/fhiprosjekt/frontend
python3 -m http.server 8000 &
sleep 1
open http://localhost:8000
```

- [ ] **Step 2: Gå gjennom verifiserings-listen fra spec'en**

For hvert punkt — kryss av når det fungerer:

1. **Toggle**: Klikk "Tabell" → cards skjules, tabellen vises. Klikk "Kort" → omvendt. Last siden på nytt → toggle husker valget
2. **Default-kolonner**: Tabellen åpnes med 7 kolonner i rekkefølge: Tittel, Område, Status, Kilde, Stikkord, Periode, Prosjektleder
3. **Sortering**: Klikk Tittel → A→Å. Klikk igjen → Å→A. Klikk Område → bytter sortering. Sortpil bare i aktiv kolonne. Last siden → sortering husker
4. **Tittel-klikk**: Åpner detail-dialog (samme som dagens cards-flyt). Lenke til fhi.no fungerer
5. **Celle-klikk på avkortet celle** (f.eks. lang beskrivelse): cell-dialog åpnes med kolonnenavn som tittel og full verdi
6. **Celle-klikk på kort celle** (f.eks. status="active"): ingenting skjer, cursoren forblir default
7. **JSON-felt** (NVA-rader, `contributors`): cell-dialog viser pretty-printet JSON
8. **Kolonneplukker**: Åpne dropdown → se grupper STANDARD, NVA, eProtokoll, AVLEDEDE. Slå på "Antall månedsverk i 2025" → kolonnen vises. Last siden → valget huskes
9. **Extra_fields-oppdagelse**: Filtrer til kun eProtokoll-prosjekter (via område HD, eller fra status=active) → eProtokoll-gruppen i plukkeren er rik
10. **Mobil**: Krymp viewport under 640 px → toggle-knappen skjules, tabellen skjules, cards vises. Voks tilbake → toggle dukker opp igjen
11. **Sticky header**: Scroll ned i tabellen → header forblir synlig
12. **Filter-integrasjon**: Slå på et filter i sidepanelet → tabellen oppdateres
13. **Ytelse**: Åpne tabellen uten filter (alle ~2300 rader) → respons innen ~2 sek, render innen ~500 ms

- [ ] **Step 3: Gå gjennom edge cases**

- Tom resultatliste (sett et filter som matcher 0): "Ingen prosjekter matcher filtrene." vises
- Manuelt ødelegg localStorage: `localStorage.setItem('fhi_table_columns', '["fake_col"]'); location.reload();` → tabellen viser tomme rader (fake_col matcher ingen kolonne), eller den faller tilbake. Begge er akseptabelt
- Rens etterpå: `localStorage.removeItem('fhi_table_columns'); location.reload();`

- [ ] **Step 4: Push til Netlify**

```bash
git push origin main
```

Vent på Netlify-deploy (~1 min). Hard-refresh https://prosjektbank.fhi.dev (Cmd+Shift+R) og gjenta sjekkene fra Step 2 mot live-versjonen.

- [ ] **Step 5: Stopp test-server**

```bash
kill %1
```

- [ ] **Step 6: Final commit (om noen rettelser ble gjort)**

Hvis du måtte gjøre småjusteringer underveis i verifiseringen, committ dem nå med:

```bash
git add -A
git commit -m "$(cat <<'EOF'
Småfiks etter manuell verifisering av tabell-visning

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Etter implementering

- Live frontend: https://prosjektbank.fhi.dev
- Frontend-repo: https://github.com/hmelberg/fhi-prosjekt-frontend
- Backend-repo: https://github.com/hmelberg/fhi-prosjekt (Anvil-synket)

Neste feature (per planen): **Feature #2 — Filter-utvidelse** (kollapsbare seksjoner, kilde-filter, default-aktive). Den er forberedt: `sources`-feltet er allerede i API-svaret takket være Task 1, og frontend har allerede source-badges.
