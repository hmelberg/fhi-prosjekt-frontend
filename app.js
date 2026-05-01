// Delt API-klient for FHI-prosjekt-utforskeren.
// Sett API-URL til din egen Anvil-app etter at den er publisert.

// === Konfigurasjon ============================================================
// Default Anvil-API. Bruk ?api=<annen-url> i URL-en for å overstyre.

const DEFAULT_API = 'https://fhi-prosjekt.anvil.app/_';

function getApiBase() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('api');
  if (fromQuery) {
    localStorage.setItem('fhi_api_base', fromQuery.replace(/\/$/, ''));
    // fjern query-param fra URL-en så den ikke vises hver gang
    history.replaceState({}, '', location.pathname + location.hash);
  }
  return localStorage.getItem('fhi_api_base') || DEFAULT_API;
}

const API = getApiBase();

// === Generell API-wrapper =====================================================

async function api(path, opts = {}) {
  // Viktig: ...opts MÅ komme før headers, ellers overskriver opts.headers
  // det merget objektet og Content-Type forsvinner.
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).error || ''; } catch {}
    throw new Error(`${r.status} ${r.statusText}${detail ? ': ' + detail : ''}`);
  }
  return r.json();
}

// Lokal lagring av passord/admin-key
function adminKey()   { return localStorage.getItem('fhi_admin_key') || ''; }
function setAdminKey(v) { localStorage.setItem('fhi_admin_key', v); }
function clearAdminKey() { localStorage.removeItem('fhi_admin_key'); }

function askPassword()  { return localStorage.getItem('fhi_ask_pwd') || ''; }
function setAskPassword(v) { localStorage.setItem('fhi_ask_pwd', v); }
function clearAskPassword() { localStorage.removeItem('fhi_ask_pwd'); }

// === Felles helpers ===========================================================

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

const AREA_NAMES = {
  HT: 'Helsetjenester',
  FF: 'Folkehelse og forebygging',
  SM: 'Smittevern',
  MH: 'Miljø og helse',
  HD: 'Helsedata og digitalisering',
  KRG: 'Kreftregisteret',
  ANDRE: 'Andre',
};

const STATUS_NAMES = {
  active: 'Aktivt',
  concluded: 'Avsluttet',
  notstarted: 'Ikke påbegynt',
};

function statusBadge(status) {
  return el('span', { class: `status-badge status-${status || ''}` }, STATUS_NAMES[status] || status || '—');
}

function areaBadge(area) {
  return el('span', { class: `area-badge area-${area || 'ANDRE'}`, title: AREA_NAMES[area] }, area || 'ANDRE');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
