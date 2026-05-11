# Analyse-visning for FHI Prosjekt-utforsker

**Dato:** 2026-05-12
**Feature:** #4 i den reviderte planen (Analyse / groupby / Chart.js)
**Status:** Designet, ikke implementert

## Bakgrunn og mål

I dag kan brukeren browse'e og filtrere prosjekter (Feature #1 + delvis #2). Analyse-visningen lar brukeren aggregere det filtrerte settet — telle eller summere over én eller to dimensjoner og se resultatet som diagram. Innholdet er drevet av brukerstyrte kontroller (groupby, metric, diagram-type) og forhåndsdefinerte presets for vanlige spørringer.

Mål: en tredje visningsmodus (`Analyse`, ved siden av `Cards` og `Tabell`) som svarer på spørsmål som "hvor mange prosjekter er det per område, per kilde, per år", "hvor mange månedsverk brukes per stikkord", og "hvordan utvikler prosjekt-porteføljen seg over tid".

## Tverrgående beslutninger

- **Tredje view-mode:** Toggle utvides fra 2 til 3 valg. `'analyse'` er en mutually exclusive modus på samme nivå som `'cards'`/`'table'`.
- **Filter-integrasjon:** Analyse bruker det samme filtrerte settet som vises i sidepanelet (område, kilde, status, stikkord, fritekst-søk). Grafen oppdateres automatisk når filtrene endres.
- **Mobil (<640px):** Analyse-knapp og -view skjules. Forced cards.
- **Klient-side aggregering:** Backend rører vi ikke. Vi bruker `page_size=0` (allerede klart fra Task 7) som returnerer alle filtrerte rader. Aggregeringen kjøres i nettleseren.
- **Persistens:** Hele ANALYSE_STATE (uten `rows`) lagres i `localStorage` under `fhi_analyse_state`.

## Datamodell

### Groupby-dimensjoner (`DIMS`)

| ID | Label | Hent fra | Multi-value |
|---|---|---|---|
| `area` | Område | `r.area` | nei |
| `main_group` | Hovedgruppe | `r.main_group` | nei |
| `source_category` | Kilde | utled fra `r.sources` (Innsendt = FF/SM/KRG/HT/HD/MH; NVA, SFF, eProtokoll) | nei |
| `status` | Status | `r.status` | nei |
| `year_changed` | År endret | `r.date_changed.slice(0,4)` | nei |
| `year_started` | År startet | `r.project_start.slice(0,4)` | nei |
| `tag` | Stikkord | `r.tags` (array) | **ja** |

### Sum-bare verdikolonner (`VALUE_COLS`)

| ID | Label | Hent fra |
|---|---|---|
| `months_2025` | Antall månedsverk i 2025 | `r.extra_fields['Antall månedsverk i 2025'].value` (parset som tall) |
| `n_tags` | # stikkord | `r.tags.length` |
| `n_sources` | # kilder | `r.sources.length` |

### Metrics

- `count` (default): antall prosjekter per gruppe
- `sum` med valgt `valueCol`: sum av tallverdiene per gruppe
  - Når `imputeMissing = true`: prosjekter uten verdi får gjennomsnittet av de som har verdi

### Diagram-typer (`CHART_TYPES`)

| ID | Label | Chart.js-type | Notat |
|---|---|---|---|
| `bar` | Søyle | `bar` | default for kategoriske 1D |
| `hbar` | Søyle (horisontal) | `bar` med `indexAxis:'y'` | bra for mange tags |
| `line` | Linje | `line` | default for år/tidsserier |
| `pie` | Pie | `pie` | små kategori-sett |
| `stacked` | Stablet søyle | `bar` med `stacked` scales | 2D |
| `grouped` | Gruppert søyle | `bar` (default) | 2D |

### Ferdiglagde presets (`PRESETS`)

| ID | Navn | Gruppe | dim1 | dim2 | metric | valueCol | imputeMissing | chartType |
|---|---|---|---|---|---|---|---|---|
| `count-area` | Antall per område | Antall | area | — | count | — | — | bar |
| `count-source` | Antall per kilde | Antall | source_category | — | count | — | — | bar |
| `count-status` | Antall per status | Antall | status | — | count | — | — | bar |
| `count-tag` | Antall per stikkord (topp 20) | Antall | tag | — | count | — | — | hbar |
| `count-by-year` | Utvikling over år | Tidsserier | year_changed | — | count | — | — | line |
| `count-area-by-year` | Utvikling over år per område | Tidsserier | year_changed | area | count | — | — | line |
| `count-source-by-year` | Utvikling over år per kilde | Tidsserier | year_changed | source_category | count | — | — | stacked |
| `months-area` | Månedsverk per område | Månedsverk | area | — | sum | months_2025 | true | bar |
| `months-tag` | Månedsverk per stikkord | Månedsverk | tag | — | sum | months_2025 | true | hbar |

## State

```js
const ANALYSE_STATE = {
  rows: [],                     // samme datasett som tabell.js bruker
  dim1: 'area',
  dim2: null,                   // null = 1D
  metric: 'count',
  valueCol: null,
  imputeMissing: false,
  chartType: 'bar',
};
```

LocalStorage-nøkkel: `fhi_analyse_state`. Lagres etter hver state-endring; lastes ved init.

## UI-layout

### Toolbar (i `index.html`)

```
[Fritekst-søk]  [Sortering ▾]  [Kort | Tabell | Analyse]  [Kolonner ▾ / Ferdiglagde ▾]  N prosjekter
```

- `Kort | Tabell | Analyse` — eksisterende toggle utvides med en tredje knapp
- `Kolonner ▾` vises kun i tabell-modus
- `Ferdiglagde ▾` vises kun i analyse-modus

### Analyse-panel (i `#analyse-view`)

```
┌───────────────── kontroller ─────────────────┐
│ Grupper etter:   [Område ▾]   Andre dim: [— ▾]│
│ Mål:             [Antall ▾]                    │
│ Verdikolonne:    [— ▾]   [☐ Imputer manglende]│
│ Diagram:         [Søyle ▾]                     │
├───────────────── chart canvas (h=400px) ─────┤
│                                                │
│           [Chart.js render her]                │
│                                                │
├───────────────── agg-info ───────────────────┤
│ 2353 prosjekter • 222 har månedsverk-verdi   │
│ Imputert gjennomsnitt: 4.2                    │
├───────────────── eksport ────────────────────┤
│ [↓ Last ned som PNG]                          │
└────────────────────────────────────────────────┘
```

### Ferdiglagde-dropdown

```
┌─ Ferdiglagde grafer ─────────────────┐
│ ANTALL                               │
│ - Antall per område                  │
│ - Antall per kilde                   │
│ - Antall per status                  │
│ - Antall per stikkord (topp 20)      │
│ TIDSSERIER                           │
│ - Utvikling over år                  │
│ - Utvikling over år per område       │
│ - Utvikling over år per kilde        │
│ MÅNEDSVERK                           │
│ - Månedsverk per område              │
│ - Månedsverk per stikkord            │
└──────────────────────────────────────┘
```

Klikk på preset:
1. Fyller inn kontrollene (dim1, dim2, metric, valueCol, imputeMissing, chartType)
2. Lukker dropdown
3. Tegner grafen umiddelbart

Brukeren kan deretter justere individuelle kontroller — endring trigger re-render.

## Aggregerings-algoritme

```js
function aggregate(rows, state) {
  const dim1Fn = DIMS[state.dim1].get;
  const dim2Fn = state.dim2 ? DIMS[state.dim2].get : null;

  const buckets = new Map();   // dim1Key -> dim2Key -> [projects]

  for (const r of rows) {
    const d1Vals = toArray(dim1Fn(r));   // tag-dim returnerer array
    const d2Vals = dim2Fn ? toArray(dim2Fn(r)) : ['__total__'];

    for (const v1 of d1Vals) {
      for (const v2 of d2Vals) {
        const k1 = v1 || '(tom)';
        const k2 = v2 || '(tom)';
        if (!buckets.has(k1)) buckets.set(k1, new Map());
        const inner = buckets.get(k1);
        if (!inner.has(k2)) inner.set(k2, []);
        inner.get(k2).push(r);
      }
    }
  }

  let imputedMean = null;
  if (state.metric === 'sum' && state.imputeMissing) {
    imputedMean = computeMean(rows, state.valueCol);
  }

  const result = {};
  for (const [k1, inner] of buckets) {
    result[k1] = {};
    for (const [k2, projs] of inner) {
      result[k1][k2] = state.metric === 'count'
        ? projs.length
        : sumWithImpute(projs, state.valueCol, imputedMean);
    }
  }
  return { result, imputedMean, totalProjects: rows.length };
}
```

**Tag-håndtering:** `tag`-dim returnerer prosjektets `r.tags` (array). Et prosjekt med 3 tags bidrar til 3 grupper. Totals overstiger prosjekt-tallet — info-linjen under grafen sier dette eksplisitt.

**Imputering:** Når `imputeMissing` er på, brukes gjennomsnittet av ikke-tomme verdier som erstatning for manglende verdier. Når `imputeMissing` er av, hopper `sumWithImpute` over manglende verdier (samme effekt som å bare summere de som har verdi).

**Top-N:** Når `dim1 = 'tag'`, limiter vi til topp 20 grupper (etter verdi, descending). Andre dimensjoner ingen limit.

**Sortering av grupper:**
- Numeriske (år-dimensjoner): stigende
- Kategoriske: descending verdi
- Tags: descending verdi, topp 20

**Agg-info-linjer under grafen:**
- Alltid: `N prosjekter` (etter filter)
- Hvis `metric=sum`: `M har <valueCol>-verdi`
- Hvis `imputeMissing=true`: `Imputert gjennomsnitt: <mean>`
- Hvis `dim1=tag`: `Totaler overstiger N (et prosjekt kan ha flere stikkord)`

## Chart.js-integrasjon

### Loading

I `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
```

CSP-en tillater `cdn.jsdelivr.net` allerede (Netlify-konfig).

### Rendering

```js
let chartInstance = null;

function renderChart() {
  const canvas = document.getElementById('analyse-chart-canvas');
  if (chartInstance) chartInstance.destroy();

  const { result, imputedMean, totalProjects } = aggregate(ANALYSE_STATE.rows, ANALYSE_STATE);
  if (!Object.keys(result).length) {
    renderEmptyState();
    return;
  }

  const config = buildChartConfig(result, ANALYSE_STATE);
  chartInstance = new Chart(canvas.getContext('2d'), config);
  renderAggInfo(totalProjects, imputedMean);
}
```

### Konfigurasjon

1D: én dataset, labels = dim1-nøkler, data = `result[k1]['__total__']`.

2D: én dataset per dim2-verdi, hver dataset har en farge fra CHART_COLORS.

`chartTypeMap` mapper interne navn til Chart.js-typer:
- `bar`, `hbar`, `stacked`, `grouped` → `bar`
- `line` → `line`
- `pie` → `pie`

`stacked` setter `scales.x.stacked = true` og `scales.y.stacked = true`.

`hbar` setter `indexAxis = 'y'`.

### Felles options

```js
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    tooltip: { enabled: true },
    title: { display: false },
  },
};
```

### Fargevelger

12 distinkte farger fra source-badge-paletten:
```js
const CHART_COLORS = [
  '#3730a3', '#92400e', '#065f46', '#9d174d', '#5b21b6',
  '#991b1b', '#1e40af', '#854d0e', '#166534', '#155e75',
  '#3f6212', '#334155',
];
```

### PNG-eksport

```js
function downloadPng() {
  const canvas = document.getElementById('analyse-chart-canvas');
  const link = document.createElement('a');
  link.download = `fhi-${ANALYSE_STATE.dim1}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

### Re-render triggers

- Endring i kontroll-dropdown → `renderChart()`
- Preset-valg → `applyPreset()` → `renderChart()`
- `projects-loaded` event → oppdater `ANALYSE_STATE.rows`, `renderChart()` hvis analyse-modus er aktiv
- Bytte til analyse-mode → `renderChart()` (hvis `rows.length > 0`)

## Filer og kodestruktur

| Fil | Endring |
|---|---|
| `frontend/index.html` | Chart.js CDN script, "Analyse"-knapp i toggle, "Ferdiglagde ▾"-knapp/panel, `<div id="analyse-view">`-container, `<script src="analyse.js">` |
| `frontend/tabell.js` | `applyViewMode` utvides til 3 modi (skjul/vis `#analyse-view`, `#preset-menu-wrap`) |
| `frontend/browse.js` | Ingen endringer |
| `frontend/analyse.js` | **Ny fil, ~350 linjer.** All analyse-spesifikk kode |
| `frontend/styles.css` | Analyse-panel-stiler |

### `analyse.js`-struktur

```
// Konstanter
DIMS, VALUE_COLS, METRIC_LABELS, CHART_TYPES, PRESETS, CHART_COLORS
LS_ANALYSE_STATE = 'fhi_analyse_state'

// State
ANALYSE_STATE

// Init
DOMContentLoaded → initAnalyse
initAnalyse: loadStateFromStorage, renderControls, wireControls,
             wirePresetMenu, register projects-loaded listener

// Persistens
loadStateFromStorage / saveState

// Kontroll-håndtering
wireControls / onControlChange

// Presets
wirePresetMenu / applyPreset

// Aggregering
aggregate / sumWithImpute / computeMean / sortGroupKeys / toArray

// Chart-rendering
renderChart / buildChartConfig / chartTypeMap

// UI
renderControls / renderAggInfo / renderEmptyState

// Eksport
downloadPng

// Mode-håndtering
onProjectsLoaded(e) / isAnalyseMode()
```

### Mode-koordinering

`tabell.js`'s `applyViewMode` utvides:

```js
function applyViewMode() {
  const mode = TABLE_STATE.viewMode;
  document.getElementById('cards').hidden = mode !== 'cards';
  document.getElementById('table-view').hidden = mode !== 'table';
  document.getElementById('analyse-view').hidden = mode !== 'analyse';
  document.getElementById('pagination').hidden = mode !== 'cards';
  document.getElementById('column-picker-wrap').hidden = mode !== 'table';
  document.getElementById('preset-menu-wrap').hidden = mode !== 'analyse';
  document.getElementById('sort').disabled = mode !== 'cards';
  for (const btn of document.querySelectorAll('#view-toggle button')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
}
```

Toggle-HTML utvides med tredje knapp:
```html
<div class="view-toggle" id="view-toggle">
  <button type="button" data-mode="cards" class="active">Kort</button>
  <button type="button" data-mode="table">Tabell</button>
  <button type="button" data-mode="analyse">Analyse</button>
</div>
```

### Script-loading-rekkefølge

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script src="app.js"></script>
<script src="browse.js"></script>
<script src="tabell.js"></script>
<script src="analyse.js"></script>
```

Chart.js laster først (synkront via CDN); `analyse.js` kan bruke `Chart` globalt.

## Backend-endringer

**Ingen.** Vi bruker eksisterende `/api/projects?page_size=0`-endepunkt (innført i Task 7 av Feature #1) som returnerer alle filtrerte rader.

## CSS

Nye seksjoner i `styles.css`:

- `.analyse-view` — container (padding, max-bredde)
- `.analyse-controls` — flex-rad med dropdowns
- `.analyse-controls label` — vertikal grupping av label + select
- `.analyse-chart-wrap` — fast høyde 400px, full bredde
- `.analyse-agg-info` — info-linjer, monospace, muted farge
- `.analyse-export` — eksport-knapp, høyrejustert
- `.preset-menu-wrap`, `.preset-menu-panel`, `.preset-menu-group`, `.preset-menu-item` — preset-dropdown
- Toggle-knappen for analyse arver eksisterende `.view-toggle button`-stiler

Mobil-cutoff utvides:

```css
@media (max-width: 640px) {
  .view-toggle button[data-mode="analyse"] { display: none !important; }
  .preset-menu-wrap { display: none !important; }
  #analyse-view { display: none !important; }
}
```

## Verifisering

1. Toggle utvidet (Cards/Tabell/Analyse) — bytte fungerer
2. Persistens — siste valg huskes over sidelast
3. Default-state: Område + Antall + Søyle, viser 7 områder
4. Preset-meny: klikk fyller kontroller, render skjer
5. Filter-integrasjon: sidepanel-filter oppdaterer grafen
6. 1D-aggregering korrekt for alle 7 DIMS
7. 2D stacked + grouped viser riktig
8. Tidsserie (linje) for `year_changed`-aksen
9. Tag-aggregering: topp 20 + info om overlapp
10. Sum-metric med `Antall månedsverk i 2025`
11. Imputering: gjennomsnitt vises, summer øker
12. PNG-eksport laster ned riktig fil
13. Tom-state: 0 prosjekter → melding
14. Mobil: alt analyse-relatert skjult
15. Mode-bytte: konfigurasjon huskes

**Ytelse:**
- Aggregering av 2353 prosjekter × 7 grupper: <10ms
- Chart.js render: <100ms

## Eksplisitt utenfor scope for v1

- Heatmap-diagram
- 3+ dimensjoner
- Andre aggregeringer (avg, min, max, percentile)
- Custom verdikolonner (brukerlagde formler)
- Lagring av brukerdefinerte presets
- URL-state for delbare graf-konfigurasjoner
- Eksport til SVG/PDF/CSV (bare PNG i v1)
- Drill-down (klikk på en søyle for å filtrere)
- Sammenligning side-om-side mot annet filterset
- Automatiserte tester (samme prinsipp som tabell-feature)
