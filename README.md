# FHI Prosjekt-utforsker — Frontend

Statisk HTML/JS-frontend for [hmelberg/fhi-prosjekt](https://github.com/hmelberg/fhi-prosjekt) Anvil-backend.

## Lokal kjøring

```bash
cd frontend
python3 -m http.server 8000
# Åpne http://localhost:8000
```

## Deploy på Netlify

1. Push dette repoet til GitHub (eller hold det som undermappe i hovedrepoet)
2. På Netlify: **Add new site → Import from Git**
3. Velg repoet, branch `main`
4. **Build command:** (tom — ren HTML/JS)
5. **Publish directory:** `.` (eller `frontend` om undermappe)
6. Deploy

## Konfigurasjon

API-URL er hardkodet i `app.js`:
```js
const DEFAULT_API = 'https://fhi-prosjekt.anvil.app/_';
```

For å overstyre uten å endre koden, åpne en side med `?api=<ny-url>` første gang — verdien lagres i localStorage.

## Brukstilgang

- **Browse** (`index.html`) — åpent for alle
- **Ask** (`ask.html`) — krever passord (settes som Anvil App Secret `ask_anvil`)
- **Admin** (`admin.html`) — krever admin-nøkkel (`admin_api_key`)

## Filer

| Fil | Formål |
|---|---|
| `index.html` | Browse — filtrerbar prosjektliste |
| `ask.html` | Spør Claude om FHI-prosjektene (RAG) |
| `admin.html` | Legg til/redigere prosjekter, reklassifisering |
| `app.js` | Delt API-klient og hjelpere |
| `browse.js`, `ask.js`, `admin.js` | Side-spesifikk logikk |
| `styles.css` | All styling |
| `netlify.toml` | Netlify build/headers-config |
