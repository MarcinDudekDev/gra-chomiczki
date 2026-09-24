/* Chomiczki — i18n. Every user-facing string lives in these catalogs. */
const catalogs = {
  pl: {
    doc_title: 'Chomiczki — gra',
    title: 'CHOMICZKI',
    subtitle: 'biegnij • omijaj • zbieraj ziarna',
    start: 'START',
    finish: '🏁 META! 🏁',
    bravo: 'BRAWO!',
    again: 'JESZCZE RAZ',
    oj: 'oj!',
    plus: '+',
    star_pop: '★',
    seed_count: '× {n}',
    aria_start: 'Rozpocznij wyścig',
    aria_again: 'Zagraj jeszcze raz',
    aria_score: 'Zebrane ziarna',
    aria_mute: 'Wycisz dźwięk',
    aria_unmute: 'Włącz dźwięk',
    gate_word: 'META',
    err_title: 'UPS! 🐹',
    err_webgl: 'Twoja przeglądarka nie potrafi narysować tej gry — brakuje WebGL.',
  },
};

function resolveLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && catalogs[q]) return q;
  const nav = String(navigator.language || '').slice(0, 2).toLowerCase();
  return catalogs[nav] ? nav : 'pl';
}

export const lang = resolveLang();
document.documentElement.lang = lang;

export function t(key, vars) {
  const cat = catalogs[lang] || catalogs.pl;
  let s = cat[key] ?? catalogs.pl[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll('{' + k + '}', String(vars[k]));
  return s;
}
