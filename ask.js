// Ask-side: spør Claude om FHI-prosjektene via /api/ask.

const EXAMPLES = [
  'Hvilke prosjekter handler om vaksinasjon hos eldre?',
  'Hva forskes det på innen antimikrobiell resistens?',
  'Finnes det studier på psykisk helse hos ungdom?',
  'Hvilke prosjekter ser på sammenhengen mellom kosthold og kronisk sykdom?',
  'Hva har FHI gjort innen kreftscreening de siste fem årene?',
  'Hvilke prosjekter handler om drikkevannskvalitet og helse?',
  'Sammenlign aktive og avsluttede prosjekter om koronavaksiner',
  'Hva er pågående forskning på fysisk aktivitet hos barn?',
  'Hvilke prosjekter undersøker effekter av luftforurensning?',
  'Hva sier FHI-forskningen om søvn og helse?',
  'Hvilke prosjekter samarbeider med universitetssykehus?',
  'Vis prosjekter om alkohol og rusmidler i et folkehelseperspektiv',
  'Hva er status på registerbasert helseforskning ved FHI?',
  'Hvilke smittevern-prosjekter pågår nå?',
  'Hva er resultatene av studier på antibiotikabruk i primærhelsetjenesten?',
  'Hvilke prosjekter ser på helseforskjeller mellom grupper i Norge?',
  'Hva forskes det på innen graviditet og morsmelk?',
  'Hvilke studier handler om diabetes type 2?',
  'Hva har FHI gjort innen tannhelse?',
  'Hvilke prosjekter bruker Den norske mor, far og barn-undersøkelsen (MoBa)?',
];

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

function init() {
  if (!askPassword()) {
    $('password-prompt').classList.remove('hidden');
    $('ask-area').classList.add('hidden');
  }
  $('save-password').addEventListener('click', () => {
    const v = $('ask-password-input').value.trim();
    if (!v) return;
    setAskPassword(v);
    $('password-prompt').classList.add('hidden');
    $('ask-area').classList.remove('hidden');
  });
  $('forget-password').addEventListener('click', () => {
    clearAskPassword();
    location.reload();
  });

  $('ask-button').addEventListener('click', submitQuestion);
  $('question').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitQuestion();
  });

  showRandomExamples();
  $('more-examples').addEventListener('click', showRandomExamples);
}

function showRandomExamples() {
  const root = $('example-chips');
  root.innerHTML = '';
  const picks = [...EXAMPLES].sort(() => Math.random() - 0.5).slice(0, 4);
  for (const text of picks) {
    const chip = el('button', { class: 'example-chip' }, text);
    chip.addEventListener('click', () => {
      $('question').value = text;
      $('question').focus();
    });
    root.appendChild(chip);
  }
}

async function submitQuestion() {
  const question = $('question').value.trim();
  if (!question) return;
  const area = $('ask-area-filter').value || null;

  $('answer-area').classList.remove('hidden');
  $('answer-loading').classList.remove('hidden');
  $('answer-text').innerHTML = '';
  $('sources-heading').classList.add('hidden');
  $('sources').innerHTML = '';
  $('ask-button').disabled = true;

  try {
    const result = await api('/api/ask', {
      method: 'POST',
      headers: { 'X-Ask-Password': askPassword() },
      body: JSON.stringify({ question, area, top_k: 8 }),
    });
    $('answer-loading').classList.add('hidden');

    // Markdown via marked-cdn (lazy-loaded)
    const md = window.marked ? window.marked.parse(result.answer) : escapeHtml(result.answer);
    $('answer-text').innerHTML = md;

    if (result.sources && result.sources.length) {
      $('sources-heading').classList.remove('hidden');
      const root = $('sources');
      for (const s of result.sources) {
        const card = el('div', { class: 'source-card' },
          el('h4', {}, s.title),
          el('div', { class: 'source-meta' },
            areaBadge(s.area),
            ` Seksjon: ${s.section || '—'} • Score: ${s.score}`,
          ),
          el('p', { class: 'source-snippet' }, s.snippet),
          el('p', { class: 'source-link' },
            el('a', { href: 'index.html?slug=' + encodeURIComponent(s.slug) }, 'Se prosjekt'),
            ' • ',
            s.url
              ? el('a', { href: s.url.startsWith('http') ? s.url : 'https://www.fhi.no' + s.url,
                          target: '_blank', rel: 'noopener' }, 'Åpne på fhi.no')
              : null,
          ),
        );
        root.appendChild(card);
      }
    }
  } catch (e) {
    $('answer-loading').classList.add('hidden');
    if (e.message.startsWith('401')) {
      clearAskPassword();
      $('answer-text').innerHTML = '<p>Feil passord. <a href="javascript:location.reload()">Prøv igjen</a>.</p>';
    } else {
      $('answer-text').innerHTML = `<p>Feil: ${escapeHtml(e.message)}</p>`;
    }
  } finally {
    $('ask-button').disabled = false;
  }
}
