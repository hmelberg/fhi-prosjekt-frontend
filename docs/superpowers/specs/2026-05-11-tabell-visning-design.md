# Tabell-visning for FHI Prosjekt-utforsker

**Dato:** 2026-05-11
**Feature:** #1 i den reviderte planen (tabell-visning + kolonnevalg + sortering)
**Status:** Designet, ikke implementert

## Bakgrunn og mål

Frontend viser i dag prosjektene som kort i et grid. Med en database som vokser fra 763 til 2300+ prosjekter med store variasjoner i datakvalitet og felter per kilde, blir kort-formatet upraktisk for rask oversikt og sammenligning.

Dette designet legger til en alternativ tabell-visning som lever side om side med kort-visningen — samme filter, samme dataset, men tett ett-prosjekt-per-linje-presentasjon. Brukere kan velge hvilke kolonner som vises (inkludert per-kilde-felter fra `extra_fields`), sortere ved klikk på header, og se fullt innhold av avkortede celler i en modal.

## Tverrgående beslutninger

- **Default-visning:** Cards (uendret). Tabellen er en opt-in-visning bak en toggle.
- **Default-status:** Aktive prosjekter (cross-cutting beslutning fra planen — implementeres som del av filter-feature #2, ikke her).
- **Mobil (<640px):** Tvunget cards. Tabellen er en desktop-funksjon.
- **Filter-state:** Røres ikke i denne featuren — kommer i feature #2.

## Kolonnemodell

Hver kolonne defineres som et JS-objekt:

```js
{
  id: 'title',              // unik nøkkel
  label: 'Tittel',          // header-tekst
  group: 'standard',        // 'standard' | 'eProtokoll' | 'NVA' | 'fhi.no' | 'avledede'
  width: 240,               // px default-bredde
  align: 'left',            // 'left' | 'right'
  get: (row) => row.title,  // funksjon for å hente verdi fra prosjektet
  format: (val, row) => …,  // valgfri formatter (badges, lenker, datoer)
  sortKey: (row) => …,      // valgfri sorteringsnøkkel (overstyrer `get`)
  searchable: true,         // tas med i fritekst-søk
}
```

### Tre kategorier kolonner

**Standard-felt** (alltid tilgjengelige):
`title`, `description`, `area`, `main_group`, `status`, `source`, `sources`, `tags`, `project_start`, `project_end`, `period` (kombinert), `date_changed`, `responsible`, `partners`, `funding`, `url`.

**Extra_fields** (oppdages dynamisk fra synlige rader):
Når tabellen rendres, skannes `extra_fields`-nøkler i radene. For eProtokoll: `Antall månedsverk i 2025`, `Kategori`, `Type prosjekt`, `Prosjektleder (FHI)`, `Nøkkelord - Tema`, `Sentertilknytting` osv. Disse grupperes etter kilde i kolonneplukkeren. Verdihåndtering: `extra_fields[key].value` (utpakker `{value, source_file}`-struct).

**Avledede felt:**
`n_tags` (antall stikkord), `n_sources` (antall kilder), `year_changed` (år fra `date_changed`), `has_sections` (boolean).

### Default-kolonner (synlige ved første åpning)

`title`, `area`, `status`, `source`, `tags`, `period`, `responsible` (7 kolonner). Periode rendres som "2023 – 2026" / "Pågående" / tom.

### Kolonneplukker-meny

Gruppert visning:
- Standard
- eProtokoll (vises hvis ≥1 eProtokoll-rad synlig)
- NVA (vises hvis ≥1 NVA-rad synlig)
- fhi.no (vises hvis ≥1 fhi.no-rad synlig)
- Avledede

Slått av/på via checkbokser. Fast rekkefølge (per gruppe, alfabetisk innen gruppe). Ingen drag-to-reorder i v1.

## UI-layout

Tabellen lever på samme side som cards (index.html). Toolbar utvides:

```
┌─ topbar (uendret) ───────────────────────────────┐
└──────────────────────────────────────────────────┘
┌─ filters (uendret i v1) ─┐ ┌─ results ──────────────────────────────┐
│                          │ │ ┌─ toolbar ──────────────────────────┐ │
│                          │ │ │ [Fritekst-søk]  [Sortering ▾]     │ │
│                          │ │ │ [Kort / Tabell]  [Kolonner ▾]    │ │
│                          │ │ │                  N prosjekter      │ │
│                          │ │ └────────────────────────────────────┘ │
│                          │ │ ┌─ visningsområde ──────────────────┐ │
│                          │ │ │  cards-grid  ELLER  tabell        │ │
│                          │ │ └────────────────────────────────────┘ │
└──────────────────────────┘ └────────────────────────────────────────┘
```

Endringer i toolbar:
- Eksisterende fritekst-søk + sortering-dropdown beholdes (sortering-dropdownen brukes når Cards-modus er aktiv)
- Ny: `Kort / Tabell`-toggle (to-knapps switch)
- Ny: `Kolonner ▾`-knapp — vises bare når Tabell er aktiv; åpner kolonneplukker-dropdown
- Resultat-tallet ("N prosjekter") flyttes inn i toolbar

Tabellen:
- `<table class="data-table">` med `<thead>` og `<tbody>`
- `<thead>` har `position: sticky; top: 0`
- Hver header-celle: navn + sort-pil (↑/↓/—), klikkbar, hover-bakgrunn
- Celler: `max-width` per kolonne, `text-overflow: ellipsis`, single-line
- Tittel-cellen rendres som lenke (svakt blå, hover-understrekning)
- Område/status: dagens `areaBadge()` / `statusBadge()`
- Stikkord: chips, maks 3 + "..."
- Kilde: én `sourceBadge()` per oppføring i `sources`-liste

Tom resultatliste: "Ingen prosjekter matcher filtrene." sentrert i tabellområdet.

## Klikk-flyt

To `<dialog>`-elementer:
- `detail-dialog` (eksisterende) — full prosjekt-info
- `cell-dialog` (ny) — celleinnhold i én kolonne

| Brukerhandling | Resultat |
|---|---|
| Klikk på tittel-celle | Åpner `detail-dialog` via eksisterende `openDetail(slug)` |
| Klikk på avkortet celle (ikke tittel) | Åpner `cell-dialog` med kolonnenavn som tittel og full verdi |
| Klikk på celle som passer (ikke avkortet) | Ingenting (cursor: default) |
| Klikk på stikkord-chip, områdebadge, kildebadge i celle | Samme som klikk på cellen — åpner `cell-dialog`. Chips/badges er visuelle, ikke interaktive filter-snarveier i v1 |
| Esc / klikk utenfor | Lukker dialog |

Filter-snarveier fra celleinnhold (klikk-stikkord → toggle filter, klikk-områdebadge → sett område-filter) er bevisst utenfor scope for v1. De krever inngrep i dagens filter-state og hører hjemme i feature #2.

`cell-dialog`-innhold:
- Header: kolonnens label ("Stikkord", "Antall månedsverk i 2025", "Sammendrag", ...)
- Innhold avhengig av type:
  - Tekst: `<p>` med wrap og line-breaks
  - Liste: `<ul>` ett element per linje
  - Dato/tall: ren tekst
  - JSON-streng (Cristin-data i `extra_fields[*].value`): `JSON.parse` og pretty-print som `<pre>`. Fallback til råverdi ved feil
  - URL: klikkbar lenke, target="_blank"
- "↗ Gå til prosjekt-detalj"-lenke nederst — lukker celle-dialog, åpner detail-dialog

Avkortet-deteksjon:
- Etter render: `cell.scrollWidth > cell.clientWidth` → marker celle med `data-truncated="true"` + CSS-klasse
- Re-sjekkes ved vindusresize (debounce 200 ms)

## State og persistens

LocalStorage-nøkler:

| Nøkkel | Type | Innhold |
|---|---|---|
| `fhi_view_mode` | string | `'cards'` eller `'table'` |
| `fhi_table_columns` | JSON array | Aktive kolonne-ID-er i rekkefølge |
| `fhi_table_sort` | JSON object | `{col, dir}` |

Lifecycle ved sidelast:
1. Last `fhi_view_mode`. Default `'cards'`. Hvis mobil → tvunget `'cards'`, toggle skjult
2. Hvis `'table'`: last `fhi_table_columns` (default-sett hvis ikke satt) og `fhi_table_sort` (default `{col: 'date_changed', dir: 'desc'}`)
3. Render

Toggle Cards↔Tabell endrer state umiddelbart, lagrer, og bytter visning. Hard bytte (ingen animasjon). Filter-state og data uendret — ingen ny API-request.

Sortering klient-side på allerede hentede rader. Lagres ved hvert klikk.

Kolonneplukker: hver checkbox-endring oppdaterer state og re-rendrer umiddelbart. "Nullstill"-knapp fjerner state og bruker default-settet.

URL-parametre støttes ikke i v1.

## Backend-endringer

Bare i `anvil_app/server_code/search.py`:

1. **`page_size=0` betyr "alle":**

```python
ps = int(page_size)
if ps <= 0:
    page_size = total
else:
    page_size = max(1, min(ps, 500))   # cap økt fra 200 til 500
```

2. **`_serialize_card` utvides med felter tabellen trenger:**

```python
def _serialize_card(r: dict) -> dict:
    return {
        # eksisterende felter ...
        "source": r.get("source"),
        "sources": r.get("sources") or [],
        "responsible": r.get("responsible"),
        "funding": r.get("funding"),
        "date_changed": r.get("date_changed"),
        "extra_fields": r.get("extra_fields") or {},
    }
```

Ingen endringer i `http_api.py`. `http_projects` videresender `page_size` uendret.

**Responsstørrelse:** ~3-5 MB rå JSON for 2353 rader inkl. `extra_fields`. Gzip-et: 500-800 kB. Lasting: 1-2 sek på god forbindelse. Akseptabelt for v1.

**Caching:** Ingen i v1. Hvis nødvendig senere: 60s in-memory TTL.

## CSS

Ny seksjon i `styles.css`. Hovedklasser:

- `.view-toggle`, `.view-toggle button.active`
- `.column-picker-btn`, `.column-picker-panel`
- `.data-table`, `.data-table thead th`, `.data-table tbody td`
- `.data-table td.cell-title`, `.data-table td.truncated`
- `.source-badge` med kilde-spesifikke fargevarianter (NVA, eProtokoll, TILDELINGSBREV, VIRKSOMHETSPLAN; FF/SM/KRG/HT/HD/MH gjenbruker area-fargene)
- `#cell-dialog .dialog-inner`, `#cell-dialog pre`

Densitet: én fast (kompakt), ingen toggle. Padding 0.4rem vertikalt, font 0.875rem. Mål: ~25 rader synlig uten scroll på 1080p.

Mobil-cutoff (`@media (max-width: 640px)`): `.view-toggle`, `.column-picker-btn`, `.data-table { display: none }`. Cards vises alltid.

## Filer og kodestruktur

| Fil | Endring |
|---|---|
| `frontend/index.html` | Toolbar-knapper, `<div id="table-view">`, `<dialog id="cell-dialog">`, `<script src="tabell.js">` |
| `frontend/app.js` | Ny `sourceBadge(src)` og `SOURCE_NAMES`-konstant. Gjør `openDetail` callable fra tabell.js |
| `frontend/browse.js` | Etter datalasting, emit `CustomEvent('projects-loaded', {detail: items})`. Cards-rendering forblir uendret |
| `frontend/tabell.js` | **Ny fil, ~250 linjer.** All tabell-spesifikk kode |
| `frontend/styles.css` | Tabell- og toolbar-stiler |
| `anvil_app/server_code/search.py` | `page_size=0` → alle; utvid `_serialize_card` |

`tabell.js`-struktur:

```
COLUMNS-array (definisjoner)
DEFAULT_COLUMNS-konstant
TABLE_STATE (enabledCols, sort, rows)
init() — kjør ved DOMContentLoaded
projects-loaded event listener
renderTable() / renderHeader() / renderRow()
markTruncated() — etter render
onHeaderClick(colId)
onCellClick(e)
openCellDialog(col, row)
renderColumnPicker() / discoverExtraFieldColumns()
localStorage-helpers
setViewMode(mode)
```

Ingen build-step. Bare flere `<script>`-tags i `index.html`, i rekkefølge: `app.js` → `browse.js` → `tabell.js`.

## Verifisering

1. Toggle bytter mellom cards og tabell; valget husker over sidelast
2. Default 7 kolonner i forventet rekkefølge ved første åpning
3. Sortering: klikk header sorterer; ny klikk reverserer; sortpil bare i aktiv kolonne; husker over sidelast
4. Tittel-klikk åpner detail-dialog
5. Klikk på avkortet celle åpner cell-dialog med full verdi
6. Klikk på celle som passer gjør ingenting
7. JSON-felt (Cristin `contributors`) pretty-printes som `<pre>`
8. Kolonneplukker viser grupper; toggle av kolonne re-rendrer; husker over sidelast
9. Extra_fields-oppdagelse: filtrer til kun eProtokoll → eProtokoll-gruppen rik; filtrer til NVA → NVA-gruppen aktiv
10. Mobil (<640px): toggle skjult, tabell skjult, cards vises
11. Sticky header forblir synlig ved scroll
12. Filter-integrasjon: filter-endring oppdaterer tabellen som cards
13. Ytelse: full last (1975-2353 rader) under 2 sek nettverk + 500 ms render

Edge cases:
- Tom resultatliste viser "Ingen prosjekter matcher filtrene."
- Mangler `sources`-liste → fallback til `source`-streng
- Manglende felter → tomme celler, ingen crash
- Ukjent kolonne-ID i localStorage → ignoreres
- Backend `page_size=0` mot tom DB → tom liste, ingen crash

Rollback: feil i tabell-rendring fanges med try/catch og faller tilbake til cards. Brukeren kan også rydde localStorage manuelt.

## Eksplisitt utenfor scope for v1

- Drag-to-reorder kolonner
- Kolonnebredde-resize
- Multi-kolonne-sortering
- Frosset første kolonne (sticky left) ved horisontal scroll
- Compact/comfortable density-toggle
- URL-state (`?view=table`)
- Caching av "alle filtrerte"-respons
- Automatiserte tester
- Filter-snarveier fra celleinnhold (chip-/badge-klikk endrer filter) — kommer i feature #2
- Eksport (kommer i feature #3)
- Analyse/charts (kommer i feature #4)
