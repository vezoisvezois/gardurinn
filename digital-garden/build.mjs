// Digital garden builder — turns content/ and data/ into a static site in dist/, in Icelandic and English.
// Run: npm run build   (or npm run dev for a local preview that rebuilds on save)

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { LANGS, DEFAULT_LANG, ROUTES, OLD_ROUTES, STRINGS, COUNTRY_NAMES, REGIONS, fmtDate as fmtDateL, fmtShort as fmtShortL, spanText as spanTextL } from './i18n.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');
const p = (...a) => path.join(ROOT, ...a);

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional: photos are copied as-is */ }

// ---------- current language ----------
// The site is built once per language. These are set at the start of each pass.
let lang = DEFAULT_LANG, T = STRINGS[lang], R = ROUTES[lang];
const other = (l = lang) => LANGS.find((x) => x !== l);
function setLang(l) { lang = l; T = STRINGS[l]; R = ROUTES[l]; }

// A value in data files can be plain text, or { "is": "…", "en": "…" } for both languages.
const isLocalized = (v) => v && typeof v === 'object' && !Array.isArray(v) && LANGS.some((l) => l in v);
const L = (v, l = lang) => (isLocalized(v) ? v[l] ?? v[other(l)] ?? '' : v);
// Which language a value is actually shown in (to mark text that hasn't been translated yet).
const langOf = (v, l = lang) => (isLocalized(v) && v[l] == null ? other(l) : l);

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJSON = async (f, fallback) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw new Error(`${f}: ${e.message}`); } };
// Icelandic letters are spelled out so slugs stay readable: "Þórsmörk ferð" → "thorsmork-ferd"
const slugify = (s) => String(s).trim().toLowerCase().replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const asDate = (s) => { const [y, m = 1, d = 1] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmtDate = (s) => fmtDateL(lang, s);
const fmtShort = (s) => fmtShortL(lang, s);
const spanText = (days) => spanTextL(lang, days);
const num = (n) => Number(n).toLocaleString(lang);
// <time class="ago"> gets a small "6ya" badge added in the browser, so it never goes stale.
const timeTag = (s) => (s ? `<time class="ago" datetime="${esc(s)}">${esc(fmtDate(s))}</time>` : '');
// A small label for text shown in the other language because it hasn't been translated.
const onlyIn = (l) => `<span class="only-in" lang="${lang}">${esc(T.onlyIn[l])}</span>`;

function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const unq = (s) => s.replace(/^["'](.*)["']$/, '$1');
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => unq(s.trim())).filter(Boolean);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else v = unq(v);
    data[mm[1]] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

// "welcome.en.md" → { base: "welcome", lang: "en" }. No suffix means the default language (or `lang:` in the front matter).
function fileLang(f, data) {
  const m = f.match(/^(.*?)(?:\.(is|en))?\.md$/);
  return { base: m[1], lang: m[2] || (LANGS.includes(data.lang) ? data.lang : DEFAULT_LANG) };
}

async function write(rel, content) {
  const f = path.join(OUT, rel.replace(/^\//, ''));
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, content);
}
const writePage = (url, html) => write(path.join(url, 'index.html'), html);

async function copyDir(src, dest) {
  if (!fss.existsSync(src)) return;
  await fs.cp(src, dest, { recursive: true });
}

// ---------- config ----------
const config = await readJSON(p('site.config.json'), {});
const C = (key, fallback = '') => L(config[key]) || fallback;
const NAV = ['garden', 'books', 'photos', 'travel', 'cv', 'about'];

// ---------- icons ----------
const STAGE_KEYS = ['seedling', 'budding', 'evergreen'];
const TYPE_KEYS = ['essay', 'note', 'pattern', 'project'];
const stageIcon = (stage) => {
  const paths = {
    seedling: '<path d="M12 21v-8"/><path d="M12 13c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    budding: '<path d="M12 21v-7"/><path d="M12 14c-3.5 0-5.5-2.5-5.5-6 2 0 4 .8 5.5 2.5C13.5 8.8 15.5 8 17.5 8c0 3.5-2 6-5.5 6z"/><path d="M12 10.5V5"/><circle cx="12" cy="4" r="1.4"/>',
    evergreen: '<path d="M12 3l5 7h-3l4 6h-4l3 4H7l3-4H6l4-6H7z"/><path d="M12 20v2"/>',
  };
  return `<svg class="stage-icon stage-${esc(stage)}" viewBox="0 0 24 24" aria-hidden="true">${paths[stage] || paths.seedling}</svg>`;
};
const stageBadge = (stage) => (T.stages[stage] ? `<span class="stage" title="${esc(T.stages[stage].blurb)}">${stageIcon(stage)}${T.stages[stage].label}</span>` : '');

// ---------- layout ----------
// `alt` is the address of the same page in the other language.
function layout({ title, description = C('description'), active = '', body, scripts = '', bodyClass = '', url, alt }) {
  const site = C('title');
  const fullTitle = title ? `${title} · ${site}` : site;
  const o = other();
  const base = String(config.url || '').replace(/\/$/, '');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${lang === 'is' ? 'is_IS' : 'en_GB'}">
${url ? `<link rel="alternate" hreflang="${lang}" href="${base}${url}">` : ''}
${alt ? `<link rel="alternate" hreflang="${o}" href="${base}${alt}">` : ''}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="${esc(bodyClass)}">
<a class="skip" href="#main">${T.skip}</a>
<header class="site-header">
  <a class="brand" href="${R.home}">${esc(site)}</a>
  <nav aria-label="Main">${NAV.map((k) => `<a href="${R[k]}"${active === k ? ' aria-current="page"' : ''}>${T.nav[k]}</a>`).join('')}</nav>
  <a class="lang-switch" href="${alt || ROUTES[o].home}" hreflang="${o}" lang="${o}">${T.switchTo}</a>
</header>
<main id="main" data-previews>
${body}
</main>
<footer class="site-footer">
  <p>${esc(C('footer'))}</p>
  <p class="muted">${esc(T.footerTended(config.author || ''))} · <a href="${R.garden}">${T.browseGarden}</a></p>
</footer>
<script src="/assets/garden.js" defer></script>
${scripts}
</body>
</html>`;
}

// ---------- markdown: sidenotes, wikilinks, relative dates ----------
// notesBySlug holds the notes as they appear in the current language.
function makeRenderer(notesBySlug, backlinks) {
  return function render(body, fromSlug = null, idPrefix = 'sn') {
    const tokens = [];
    const keep = (html) => `ZZTOK${tokens.push(html) - 1}ZZ`;

    const inline = (text) =>
      text
        // [[slug]] or [[slug|label]]
        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
          const slug = slugify(target);
          const note = notesBySlug.get(slug);
          const text = label || note?.title || target;
          if (note) {
            if (fromSlug && fromSlug !== slug) backlinks.get(slug)?.add(fromSlug);
            return keep(`<a href="${R.notes}${slug}/" class="wikilink">${esc(text)}</a>`);
          }
          return keep(`<span class="wikilink unplanted" title="${esc(T.notPlanted)}">${esc(text)}</span>`);
        })
        // {{2019}} {{2019-03}} {{2019-03-14}}
        .replace(/\{\{(\d{4}(?:-\d{2}(?:-\d{2})?)?)\}\}/g, (_, d) => keep(timeTag(d)));

    // Protect code so the special syntax inside it is shown literally
    const code = [];
    const restoreCode = (s) => s.replace(/ZZCODE(\d+)ZZ/g, (_, k) => code[+k]);
    body = body.replace(/^```[\s\S]*?^```|`[^`\n]+`/gm, (m) => `ZZCODE${code.push(m) - 1}ZZ`);

    // Footnote definitions: [^id]: text   (one line each)
    const defs = new Map();
    let src = body.replace(/^\[\^([^\]]+)\]:[ \t]+(.+)$/gm, (_, id, text) => { defs.set(id, text); return ''; });

    src = inline(src);

    let n = 0;
    src = src.replace(/\[\^([^\]]+)\]/g, (match, id) => {
      if (!defs.has(id)) return match;
      n += 1;
      const content = marked.parseInline(restoreCode(inline(defs.get(id))));
      const uid = `${idPrefix}-${n}`;
      return keep(
        `<span class="sn"><label for="${uid}" class="sn-ref" aria-label="${T.sidenote} ${n}">${n}</label><input type="checkbox" id="${uid}" class="sn-check"><span class="sidenote" role="note"><span class="sn-num">${n}</span>${content}</span></span>`
      );
    });

    // Plain markdown links to notes also count as backlinks
    if (fromSlug) {
      for (const m of src.matchAll(/\]\((?:\/en)?\/(?:notes|glosur)\/([^/)#\s]+)\/?[^)]*\)/g)) {
        if (m[1] !== fromSlug) backlinks.get(m[1])?.add(fromSlug);
      }
    }

    let html = marked.parse(restoreCode(src));
    for (let i = 0; i < 5 && /ZZTOK\d+ZZ/.test(html); i++) html = html.replace(/ZZTOK(\d+)ZZ/g, (_, k) => tokens[+k]);
    // Links written as /notes/x/ point at the note in the current language
    html = html.replace(/href="(?:\/en)?\/(?:notes|glosur)\/([^"#?]+)/g, (_, rest) => `href="${R.notes}${rest}`);
    // External links open in a new tab
    html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
    return html;
  };
}

const plainText = (md) => md.replace(/^\[\^[^\]]+\]:.*$/gm, '').replace(/\[\^[^\]]+\]/g, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a).replace(/\{\{([\d-]+)\}\}/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`~]/g, '').replace(/\s+/g, ' ').trim();
const excerpt = (md, len = 180) => { const t = plainText(md); return t.length > len ? t.slice(0, len).replace(/\s+\S*$/, '') + '…' : t; };

// ---------- load notes and pages ----------
// Each returns a Map of slug → { is: version, en: version }, with either language possibly missing.
async function loadVersions(dir, make) {
  const all = new Map();
  if (!fss.existsSync(dir)) return all;
  for (const f of (await fs.readdir(dir)).filter((x) => x.endsWith('.md'))) {
    const { data, body } = parseFrontmatter(await fs.readFile(path.join(dir, f), 'utf8'));
    if (data.draft === true) continue;
    const { base, lang: l } = fileLang(f, data);
    if (!all.has(base)) all.set(base, {});
    all.get(base)[l] = make(base, l, data, body);
  }
  return all;
}

const loadNotes = () => loadVersions(p('content', 'notes'), (slug, l, data, body) => ({
  slug,
  lang: l,
  title: data.title || slug,
  description: data.description || excerpt(body, 140),
  type: TYPE_KEYS.includes(data.type) ? data.type : 'note',
  stage: STAGE_KEYS.includes(data.stage) ? data.stage : 'seedling',
  planted: data.planted || '',
  tended: data.tended || data.planted || '',
  topics: Array.isArray(data.topics) ? data.topics : data.topics ? [data.topics] : [],
  body,
}));

const loadPages = () => loadVersions(p('content', 'pages'), (slug, l, data, body) => ({ slug, lang: l, data, body }));

// The notes as seen in one language: its own version where there is one, the other language's otherwise.
const pick = (versions, l) => versions[l] || versions[other(l)];

// A page's address: "about" uses the built-in /um/ and /en/about/; others use `path:` from the front matter, or the file name.
function pageUrl(versions, l) {
  if (versions[l]?.data.path) return `${l === DEFAULT_LANG ? '' : `/${l}`}/${versions[l].data.path}/`;
  const slug = (versions.is || versions.en).slug;
  if (ROUTES[l][slug]) return ROUTES[l][slug];
  return `${l === DEFAULT_LANG ? '' : `/${l}`}/${slug}/`;
}

function noteCard(n) {
  const fallback = n.lang !== lang;
  return `<li class="card note-card" data-type="${n.type}" data-stage="${n.stage}"${fallback ? ` lang="${n.lang}"` : ''}>
  <a href="${R.notes}${n.slug}/">
    <span class="eyebrow">${T.types[n.type]}${fallback ? ` <span class="lang-tag">${n.lang.toUpperCase()}</span>` : ''}</span>
    <h3>${esc(n.title)}</h3>
    <p>${esc(n.description)}</p>
    <span class="card-foot">${stageBadge(n.stage)}<span class="muted">${esc(fmtDate(n.tended))}</span></span>
  </a>
</li>`;
}

// ---------- pages ----------
async function buildNotes(notes, render, backlinks, previews) {
  const notesBySlug = new Map(notes.map((n) => [n.slug, n]));
  // First pass renders everything so backlinks are complete before pages are written.
  for (const n of notes) n.html = render(n.body, n.slug, `sn-${n.slug}`);

  for (const n of notes) {
    const back = [...(backlinks.get(n.slug) || [])].map((s) => notesBySlug.get(s)).filter(Boolean);
    const fallback = n.lang !== lang;
    const body = `<article class="note"${fallback ? ` lang="${n.lang}"` : ''}>
  <header class="note-head">
    ${fallback ? `<p>${onlyIn(n.lang)}</p>` : ''}
    <p class="eyebrow">${T.types[n.type]} ${stageBadge(n.stage)}</p>
    <h1>${esc(n.title)}</h1>
    ${n.description ? `<p class="dek">${esc(n.description)}</p>` : ''}
    <dl class="meta" lang="${lang}">
      ${n.planted ? `<div><dt>${T.planted}</dt><dd>${timeTag(n.planted)}</dd></div>` : ''}
      ${n.tended && n.tended !== n.planted ? `<div><dt>${T.tended}</dt><dd>${timeTag(n.tended)}</dd></div>` : ''}
      ${n.topics.length ? `<div><dt>${T.topics}</dt><dd>${n.topics.map((t) => `<a class="chip" href="${R.garden}#${slugify(t)}">${esc(t)}</a>`).join(' ')}</dd></div>` : ''}
    </dl>
  </header>
  <div class="prose">
${n.html}
  </div>
  ${back.length ? `<aside class="backlinks" lang="${lang}"><h2>${T.linkingHere}</h2><ul class="cards">${back.map(noteCard).join('')}</ul></aside>` : ''}
</article>`;
    const url = `${R.notes}${n.slug}/`;
    await writePage(url, layout({ title: n.title, description: n.description, active: 'garden', body, url, alt: `${ROUTES[other()].notes}${n.slug}/` }));
    previews[url] = { kind: T.types[n.type], title: n.title, text: n.description, stage: T.stages[n.stage].label, date: n.tended };
  }
}

async function buildGarden(notes, previews) {
  const topics = [...new Set(notes.flatMap((n) => n.topics))].sort((a, b) => a.localeCompare(b, lang));
  const body = `<section class="page-head">
  <h1>${T.gardenTitle}</h1>
  <p class="dek">${esc(C('gardenIntro', T.gardenIntro))}</p>
  <ul class="stage-key">${STAGE_KEYS.map((k) => `<li>${stageIcon(k)}<strong>${T.stages[k].label}</strong> <span class="muted">${T.stages[k].blurb}</span></li>`).join('')}</ul>
</section>
<div class="filters" role="toolbar" aria-label="${T.filterNotes}">
  <div class="filter-group"><button data-filter="type" data-value="all" aria-pressed="true">${T.all}</button>${TYPE_KEYS.filter((k) => notes.some((n) => n.type === k)).map((k) => `<button data-filter="type" data-value="${k}" aria-pressed="false">${T.typesPlural[k]}</button>`).join('')}</div>
  <div class="filter-group"><button data-filter="stage" data-value="all" aria-pressed="true">${T.anyStage}</button>${STAGE_KEYS.map((k) => `<button data-filter="stage" data-value="${k}" aria-pressed="false">${stageIcon(k)}${T.stages[k].label}</button>`).join('')}</div>
  ${topics.length ? `<div class="filter-group topics"><button data-filter="topic" data-value="all" aria-pressed="true">${T.allTopics}</button>${topics.map((t) => `<button data-filter="topic" data-value="${slugify(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>` : ''}
</div>
<ul class="cards garden-grid">${notes.map((n) => noteCard(n).replace('<li class="card note-card"', `<li class="card note-card" data-topics="${n.topics.map(slugify).join(' ')}"`)).join('')}</ul>
<p class="empty muted" hidden>${T.nothingHere}</p>`;
  await writePage(R.garden, layout({ title: T.nav.garden, active: 'garden', body, url: R.garden, alt: ROUTES[other()].garden }));
  previews[R.garden] = { kind: T.kind.section, title: T.gardenTitle, text: C('gardenIntro', T.gardenIntro) };
}

async function buildHome(notes, books, photos, travelSummary, previews) {
  const reading = books.filter((b) => b.status === 'reading').slice(0, 3);
  const recentPhotos = photos.slice(0, 4);
  const s = travelSummary;
  const body = `<section class="hero">
  <h1>${C('heroTitle') || esc(C('title'))}</h1>
  <p class="dek">${esc(C('heroIntro') || C('description'))}</p>
</section>
<section class="home-section">
  <div class="section-head"><h2>${T.recentlyTended}</h2><a href="${R.garden}">${T.wholeGarden}</a></div>
  <ul class="cards">${notes.slice(0, 6).map(noteCard).join('')}</ul>
</section>
<section class="home-grid">
  <a class="tile" href="${R.books}">
    <span class="eyebrow">${T.library}</span>
    <h2>${T.nav.books}</h2>
    <p>${T.booksRead(books.filter((b) => b.status === 'read').length)}${reading.length ? ` · ${T.currentlyReading} <em>${esc(L(reading[0].title))}</em>` : ''}</p>
  </a>
  <a class="tile" href="${R.photos}">
    <span class="eyebrow">${T.lifeInPictures}</span>
    <h2>${T.nav.photos}</h2>
    <div class="tile-photos">${recentPhotos.map((ph) => `<img src="${ph.thumb}" alt="" loading="lazy">`).join('')}</div>
  </a>
  <a class="tile" href="${R.travel}">
    <span class="eyebrow">${T.atlas}</span>
    <h2>${T.nav.travel}</h2>
    <p>${T.travelTile(s.countries, s.lived, s.nights && num(s.nights), s.airports)}</p>
  </a>
</section>`;
  await writePage(R.home, layout({ title: '', active: 'home', body, bodyClass: 'home', url: R.home, alt: ROUTES[other()].home }));
  previews[R.home] = { kind: T.kind.home, title: C('title'), text: C('description') };
}

async function buildPages(pages, render, previews) {
  for (const versions of pages.values()) {
    const pg = pick(versions, lang);
    const fallback = pg.lang !== lang;
    const html = render(pg.body, null, `sn-${pg.slug}`);
    const { title, description } = pg.data;
    const page = `<article class="note"${fallback ? ` lang="${pg.lang}"` : ''}>
  <header class="note-head">${fallback ? `<p>${onlyIn(pg.lang)}</p>` : ''}<h1>${esc(title || pg.slug)}</h1>${description ? `<p class="dek">${esc(description)}</p>` : ''}</header>
  <div class="prose">${html}</div>
</article>`;
    const url = pageUrl(versions, lang);
    await writePage(url, layout({ title, description, active: NAV.includes(pg.slug) ? pg.slug : '', body: page, url, alt: pageUrl(versions, other()) }));
    previews[url] = { kind: T.kind.page, title: title || pg.slug, text: description || excerpt(pg.body) };
  }
}

// ---------- books ----------
function bookCover(b) {
  const title = L(b.title);
  const hue = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const fallback = `<div class="cover-fallback" style="--hue:${hue}"><span>${esc(title)}</span><small>${esc(b.author)}</small></div>`;
  const src = b.cover || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${String(b.isbn).replace(/[^0-9X]/gi, '')}-M.jpg?default=false` : '');
  return `<div class="cover">${fallback}${src ? `<img src="${esc(src)}" alt="${esc(T.coverOf(title))}" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}
const stars = (r) => (r ? `<span class="rating" aria-label="${T.outOf5(r)}">${'★'.repeat(r)}<span class="muted">${'★'.repeat(5 - r)}</span></span>` : '');

function bookCard(b, render) {
  const thoughts = b.thoughts ? L(b.thoughts) : '';
  const inner = `${bookCover(b)}
    <div class="book-meta">
      <h3>${esc(L(b.title))}</h3>
      <p class="muted">${esc(b.author)}</p>
      ${stars(b.rating)}
      ${thoughts ? `<div class="book-thoughts"${langOf(b.thoughts) !== lang ? ` lang="${langOf(b.thoughts)}"` : ''}>${render(thoughts)}</div>` : ''}
      ${b.note ? `<a class="book-link" href="${R.notes}${esc(b.note)}/">${T.readMyNotes}</a>` : ''}
      ${b.finished ? `<p class="muted small">${T.finished} ${timeTag(b.finished)}</p>` : ''}
    </div>`;
  return `<li class="book">${inner}</li>`;
}

async function buildBooks(books, render, previews) {
  const reading = books.filter((b) => b.status === 'reading');
  const read = books.filter((b) => b.status === 'read').sort((a, b) => String(b.finished || '').localeCompare(String(a.finished || '')));
  const toRead = books.filter((b) => b.status === 'to-read');
  const byYear = new Map();
  for (const b of read) {
    const y = b.finished ? String(b.finished).slice(0, 4) : T.undated;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(b);
  }
  const shelf = (list) => `<ul class="shelf">${list.map((b) => bookCard(b, render)).join('')}</ul>`;
  const body = `<section class="page-head">
  <h1>${T.booksTitle}</h1>
  <p class="dek">${esc(C('booksIntro', T.booksIntro))}</p>
  <p class="stat-line">${T.booksStat(read.length, reading.length, toRead.length)}</p>
</section>
${reading.length ? `<section class="book-section"><h2>${T.readingNow}</h2>${shelf(reading)}</section>` : ''}
${[...byYear].map(([y, list]) => `<section class="book-section"><h2>${esc(y)} <span class="count">${list.length}</span></h2>${shelf(list)}</section>`).join('')}
${toRead.length ? `<section class="book-section"><h2>${T.antiLibrary} <span class="count">${toRead.length}</span></h2><p class="muted">${T.antiLibraryBlurb}</p>${shelf(toRead)}</section>` : ''}`;
  await writePage(R.books, layout({ title: T.booksTitle, active: 'books', body, url: R.books, alt: ROUTES[other()].books }));
  previews[R.books] = { kind: T.kind.section, title: T.booksTitle, text: T.booksPreview(read.length, reading.length) };
}

// ---------- CV ----------
const CV_SECTIONS = ['education', 'work', 'volunteer', 'projects'];

async function buildCV(cv, render, previews) {
  if (!cv) return;
  const inline = (s) => render(String(s)).replace(/^<p>|<\/p>\s*$/g, '');
  // Wraps text in lang="…" when it's shown in the other language
  const tx = (v, fn = esc) => { const s = L(v); const l = langOf(v); return l === lang ? fn(s) : `<span lang="${l}">${fn(s)}</span>`; };
  const when = (e) => (e.when ? esc(L(e.when)) : e.from || e.to ? `${esc(fmtShort(e.from))}${e.from && e.to === e.from ? '' : ` – ${e.to ? esc(fmtShort(e.to)) : T.presentCv}`}` : '');

  // Tags: "tags" at the top of cv.json gives each tag an id and a name per language, and sets the order of the buttons.
  const tagDefs = new Map();
  for (const t of cv.tags || []) {
    const def = typeof t === 'string' ? { id: slugify(t), name: t } : { id: t.id || slugify(L(t, 'en')), name: t.name || { is: t.is, en: t.en } };
    tagDefs.set(def.id, def);
  }
  const tagId = (t) => { const s = slugify(L(t, 'en')); return tagDefs.has(String(t)) ? String(t) : [...tagDefs.values()].find((d) => slugify(L(d.name, 'en')) === s || slugify(L(d.name, 'is')) === s)?.id || s; };
  const tagName = (id) => L(tagDefs.get(id)?.name) || id;
  const used = new Map();
  for (const key of CV_SECTIONS) for (const e of cv[key] || []) for (const t of e.tags || []) { const id = tagId(t); if (!tagDefs.has(id)) tagDefs.set(id, { id, name: t }); used.set(id, (used.get(id) || 0) + 1); }
  const tagList = [...tagDefs.keys()].filter((id) => used.has(id));

  const entry = (e) => `<li class="cv-entry"${e.tags?.length ? ` data-tags="${e.tags.map(tagId).join(' ')}"` : ''}>
  <div class="cv-when">${when(e)}</div>
  <div class="cv-what">
    <h3>${e.link ? `<a href="${esc(L(e.link))}">${tx(e.title)}</a>` : tx(e.title)}</h3>
    ${e.org || e.place ? `<p class="cv-org">${[e.org, e.place].filter(Boolean).map((v) => tx(v)).join(' · ')}</p>` : ''}
    ${e.summary ? `<div class="cv-summary">${tx(e.summary, render)}</div>` : ''}
    ${L(e.highlights)?.length ? `<ul class="cv-highlights"${langOf(e.highlights) !== lang ? ` lang="${langOf(e.highlights)}"` : ''}>${L(e.highlights).map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}
    ${e.tags?.length ? `<p class="cv-tags">${e.tags.map(tagId).map((id) => `<button type="button" class="cv-tag" data-tag="${id}">${esc(tagName(id))}</button>`).join('')}</p>` : ''}
  </div>
</li>`;
  // Newest first; anything still ongoing goes to the top.
  const sorted = (list) => [...list].sort((a, b) => (!a.to - !b.to) * -1 || String(b.to || '').localeCompare(String(a.to || '')) || String(b.from || '').localeCompare(String(a.from || '')));
  const sections = CV_SECTIONS.filter((key) => cv[key]?.length);
  const total = sections.reduce((n, key) => n + cv[key].length, 0);

  const intro = cv.intro ? `<div class="dek">${tx(cv.intro, render)}</div>` : '';
  const filter = tagList.length ? `<div class="cv-filter" role="group" aria-label="${T.filterBy}">
    <span class="cv-filter-label">${T.filter}</span>
    <button type="button" class="cv-chip" data-tag="" aria-pressed="true">${T.allEntries} <span class="n">${total}</span></button>
    ${tagList.map((id) => `<button type="button" class="cv-chip" data-tag="${id}" aria-pressed="false">${esc(tagName(id))} <span class="n">${used.get(id)}</span></button>`).join('')}
  </div>
  <p class="cv-status muted" aria-live="polite" data-one="${esc(T.showingOne)}" data-many="${esc(T.showingMany)}" data-of="${esc(T.ofTotal('{n}', '{t}'))}"></p>` : '';
  const pdf = L(cv.pdf);
  const body = `<section class="page-head">
  <h1>${T.cvTitle}</h1>
  ${intro}
  ${sections.length > 1 || pdf ? `<nav class="cv-jump" aria-label="${T.cvSectionsNav}">${sections.map((key) => `<a href="#${key}" data-section="${key}">${T.cvSections[key]}</a>`).join('')}${pdf ? `<a class="cv-pdf" href="${esc(pdf)}">${T.downloadPdf}</a>` : ''}</nav>` : ''}
  ${filter}
</section>
${sections.map((key) => `<section class="cv-section" id="${key}">
  <h2>${T.cvSections[key]} <span class="count" data-total="${cv[key].length}">${cv[key].length}</span></h2>
  <ol class="cv-list">${sorted(cv[key]).map(entry).join('')}</ol>
</section>`).join('\n')}`;
  await writePage(R.cv, layout({ title: T.cvTitle, active: 'cv', body, url: R.cv, alt: ROUTES[other()].cv, scripts: tagList.length ? '<script src="/assets/cv.js" defer></script>' : '' }));
  previews[R.cv] = { kind: T.kind.section, title: T.cvTitle, text: sections.map((key) => `${T.cvSections[key]}: ${cv[key].length}`).join(' · ') };
}

// ---------- photos ----------
async function processPhotos() {
  const list = await readJSON(p('data', 'photos.json'), []);
  const srcDir = p('content', 'photos');
  const outDir = path.join(OUT, 'photos', 'img');
  await fs.mkdir(outDir, { recursive: true });
  const photos = [];
  for (const ph of list) {
    const src = path.join(srcDir, ph.file);
    if (!fss.existsSync(src)) { console.warn(`  ! photo missing: content/photos/${ph.file}`); continue; }
    const base = ph.file.replace(/\.[^.]+$/, '');
    let thumb, full, width, height;
    if (sharp) {
      const img = sharp(src).rotate();
      const meta = await img.metadata();
      const portrait = (meta.orientation || 1) >= 5;
      width = portrait ? meta.height : meta.width; height = portrait ? meta.width : meta.height;
      await sharp(src).rotate().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(outDir, `${base}-900.webp`));
      await sharp(src).rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(outDir, `${base}-2200.webp`));
      thumb = `/photos/img/${base}-900.webp`; full = `/photos/img/${base}-2200.webp`;
    } else {
      await fs.copyFile(src, path.join(outDir, ph.file));
      thumb = full = `/photos/img/${ph.file}`;
    }
    photos.push({ ...ph, thumb, full, width, height });
  }
  photos.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return photos;
}

async function buildPhotos(photos, previews) {
  const byYear = new Map();
  for (const ph of photos) {
    const y = ph.date ? String(ph.date).slice(0, 4) : T.undated;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(ph);
  }
  let i = 0;
  const fig = (ph) => {
    const caption = L(ph.caption), place = L(ph.place), alt = L(ph.alt) || caption || '';
    return `<figure class="photo" data-index="${i++}">
  <button class="photo-open" aria-label="${T.openPhoto}${caption ? `: ${esc(caption)}` : ''}"><img src="${ph.thumb}" data-full="${ph.full}" alt="${esc(alt)}" loading="lazy"${ph.width ? ` width="${ph.width}" height="${ph.height}"` : ''}></button>
  ${caption || place ? `<figcaption>${esc(caption || '')}${place ? ` <span class="muted">· ${esc(place)}</span>` : ''}</figcaption>` : ''}
</figure>`;
  };
  const body = `<section class="page-head">
  <h1>${T.photosTitle}</h1>
  <p class="dek">${esc(C('photosIntro', T.photosIntro))}</p>
</section>
${[...byYear].map(([y, list]) => `<section class="photo-year"><h2>${esc(y)}</h2><div class="photo-grid">${list.map(fig).join('')}</div></section>`).join('')}
${photos.length ? '' : `<p class="muted">${T.noPhotos}</p>`}
<dialog class="lightbox" aria-label="${T.photoViewer}">
  <button class="lb-close" aria-label="${T.close}">×</button>
  <button class="lb-prev" aria-label="${T.prevPhoto}">‹</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="lb-next" aria-label="${T.nextPhoto}">›</button>
</dialog>`;
  await writePage(R.photos, layout({ title: T.photosTitle, active: 'photos', body, url: R.photos, alt: ROUTES[other()].photos }));
  previews[R.photos] = { kind: T.kind.section, title: T.photosTitle, text: T.photosPreview(photos.length), image: photos[0]?.thumb };
}

// ---------- travel ----------
const DAY = 86400000;
function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Two-letter codes give a country flag; "GB-ENG", "GB-SCT" and "GB-WLS" give the subdivision flags.
const flag = (code) => {
  if (code && /^[A-Za-z]{2}$/.test(code)) return [...code.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
  if (code && /^[A-Za-z]{2}-[A-Za-z]{3}$/.test(code)) return `🏴${[...code.replace('-', '').toLowerCase()].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('')}\u{e007f}`;
  return '🏳️';
};
const ymd = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.max(0, Math.round((asDate(b) - asDate(a)) / DAY));

// Country names: "country" in travel.json is the English name (it's also how the map finds the shape).
// Other languages use a "name" given in the data, then the short-name list in i18n.mjs, then the name built into Node.
const regionNames = Object.fromEntries(LANGS.map((l) => [l, (() => { try { return new Intl.DisplayNames([l], { type: 'region' }); } catch { return null; } })()]));
function countryName(c) {
  if (c.name) return L(c.name);
  if (lang === 'en' || !c.code) return c.country;
  const code = String(c.code).toUpperCase();
  return COUNTRY_NAMES[lang]?.[code] || (/^[A-Z]{2}$/.test(code) && regionNames[lang]?.of(code)) || c.country;
}
const regionName = (r) => REGIONS[lang]?.[r] || r;

function barChartYears(rows) {
  if (!rows.length) return '';
  const W = 720, H = 240, m = { t: 24, r: 8, b: 28, l: 8 };
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bw = (W - m.l - m.r) / rows.length;
  const bars = rows.map((r, i) => {
    const h = ((H - m.t - m.b) * r.value) / max;
    const x = m.l + i * bw + bw * 0.15, y = H - m.b - h;
    return `<g><title>${r.label}: ${r.value} ${T.nights(r.value)}</title>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(h, r.value ? 2 : 0).toFixed(1)}" rx="3" class="bar"/>
${r.value ? `<text x="${(x + bw * 0.35).toFixed(1)}" y="${(y - 6).toFixed(1)}" class="bar-value">${r.value}</text>` : ''}
<text x="${(x + bw * 0.35).toFixed(1)}" y="${H - 8}" class="axis-label">${rows.length > 14 ? `’${String(r.label).slice(2)}` : r.label}</text></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T.nightsByYear)}">
<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" class="baseline"/>${bars.join('')}</svg>`;
}

function hBarChart(rows) {
  if (!rows.length) return '';
  const rowH = 30, labelW = 190, W = 720, H = rows.length * rowH + 8;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bars = rows.map((r, i) => {
    const w = ((W - labelW - 60) * r.value) / max, y = i * rowH + 4;
    return `<g><title>${esc(r.label)}: ${r.value} ${T.nights(r.value)}</title>
<text x="${labelW - 10}" y="${y + 18}" class="row-label">${esc(r.label)}</text>
<rect x="${labelW}" y="${y + 4}" width="${Math.max(w, 2).toFixed(1)}" height="${rowH - 10}" rx="3" class="bar"/>
<text x="${(labelW + w + 6).toFixed(1)}" y="${y + 18}" class="bar-value start">${r.value}</text></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T.mostNights)}">${bars.join('')}</svg>`;
}

// Everything here is language-neutral; names are translated when the page is built.
async function loadTravel() {
  const travel = await readJSON(p('data', 'travel.json'), { stays: [], flights: [] });
  const airports = await readJSON(p('data', 'airports.json'), {});
  const home = travel.home || config.home || '';
  const stays = (travel.stays || []).filter((s) => s.country && s.country !== home).map((s) => ({ ...s, nights: s.arrive && s.depart ? Math.max(0, Math.round((asDate(s.depart) - asDate(s.arrive)) / DAY)) : 0 }));
  stays.sort((a, b) => String(a.arrive).localeCompare(String(b.arrive)));

  // Countries with first visit, total nights, visits
  const countries = new Map();
  for (const s of stays) {
    const c = countries.get(s.country) || { country: s.country, code: s.code, first: s.arrive, nights: 0, visits: 0, places: [] };
    c.nights += s.nights; c.visits += 1; if (s.place) c.places.push(s.place);
    if (!c.code && s.code) c.code = s.code;
    countries.set(s.country, c);
  }

  // Nights per year (each night counted in the year it falls in)
  const perYear = new Map();
  for (const s of stays) {
    if (!s.arrive || !s.depart) continue;
    for (let t = +asDate(s.arrive); t < +asDate(s.depart); t += DAY) {
      const y = new Date(t).getUTCFullYear();
      perYear.set(y, (perYear.get(y) || 0) + 1);
    }
  }
  const years = [...perYear.keys()];
  const yearRows = [];
  if (years.length) for (let y = Math.min(...years); y <= Math.max(new Date().getUTCFullYear(), ...years); y++) yearRows.push({ label: y, value: perYear.get(y) || 0 });

  // Flights & airports
  const flights = (travel.flights || []).map((f) => (typeof f === 'string' ? { from: f.split('-')[0], to: f.split('-')[1] } : f));
  const usedCodes = new Set([...(travel.extraAirports || []), ...flights.flatMap((f) => [f.from, f.to])].map((c) => String(c).toUpperCase()));
  const missing = [...usedCodes].filter((c) => !airports[c]);
  if (missing.length) console.warn(`  ! airports missing from data/airports.json (won't show on map): ${missing.join(', ')}`);
  let km = 0;
  const routes = new Map();
  for (const f of flights) {
    const a = airports[String(f.from).toUpperCase()], b = airports[String(f.to).toUpperCase()];
    if (!a || !b) continue;
    km += haversineKm(a, b);
    const key = [f.from, f.to].map((x) => x.toUpperCase()).sort().join('-');
    routes.set(key, (routes.get(key) || 0) + 1);
  }
  const airportList = [...usedCodes].filter((c) => airports[c]).map((c) => ({ code: c, ...airports[c], uses: flights.filter((f) => [f.from, f.to].map((x) => x.toUpperCase()).includes(c)).length }));

  // ---- Home, lived, visited ----
  const today = ymd(new Date());
  const lived = (travel.lived || []).filter((l) => l.country && l.from && l.to).sort((a, b) => a.from.localeCompare(b.from));
  // Home periods are the gaps between the places lived, from birth onwards.
  const homePeriods = [];
  if (home && travel.born) {
    let cursor = travel.born;
    for (const l of lived) {
      if (l.from > cursor) homePeriods.push({ from: cursor, to: l.from });
      if (l.to > cursor) cursor = l.to;
    }
    homePeriods.push({ from: cursor, to: null });
  }
  const homeDays = homePeriods.reduce((s, h) => s + (h.from < today ? daysBetween(h.from, h.to && h.to < today ? h.to : today) : 0), 0);

  const livedMap = new Map();
  for (const l of lived) {
    const c = livedMap.get(l.country) || { country: l.country, code: l.code, name: l.name, periods: [], days: 0 };
    if (!c.code && l.code) c.code = l.code;
    c.periods.push(l);
    c.days += daysBetween(l.from, l.to);
    livedMap.set(l.country, c);
  }

  // Visited: the "visited" list plus any country with a stay. Countries lived in or home are shown in their own group.
  const visitedMap = new Map();
  for (const v of travel.visited || []) {
    const e = typeof v === 'string' ? { country: v } : v;
    if (!e.country || visitedMap.has(e.country)) continue;
    visitedMap.set(e.country, { country: e.country, code: e.code, name: e.name, region: e.region || 'Elsewhere' });
  }
  for (const c of countries.values()) if (!visitedMap.has(c.country)) visitedMap.set(c.country, { country: c.country, code: c.code, region: 'Elsewhere' });
  for (const v of visitedMap.values()) {
    const c = countries.get(v.country);
    if (c) Object.assign(v, { nights: c.nights, visits: c.visits, first: c.first, places: c.places });
    if (!v.code && c?.code) v.code = c.code;
  }
  const visitedOnly = [...visitedMap.values()].filter((v) => v.country !== home && !livedMap.has(v.country));
  const allPlaces = new Set([...(home ? [home] : []), ...livedMap.keys(), ...visitedMap.keys()]);

  return {
    travel, home, homeCode: travel.homeCode || '', stays, countries, yearRows, flights, airportList, routes, km: Math.round(km),
    today, homePeriods, homeDays, lived: livedMap, visited: visitedOnly, allPlaces,
  };
}

async function buildTravel(t, render, previews) {
  const totalNights = t.stays.reduce((s, x) => s + x.nights, 0);
  const longest = [...t.stays].sort((a, b) => b.nights - a.nights)[0];
  const cname = (c) => countryName({ country: c.country, code: c.code, name: c.name });
  const topCountries = [...t.countries.values()].sort((a, b) => b.nights - a.nights).slice(0, 12).map((c) => ({ label: `${flag(c.code)} ${cname(c)}`, value: c.nights }));
  const places = (list) => [...new Set((list || []).flatMap((x) => String(L(x)).split(',')).map((x) => x.trim()).filter(Boolean))];

  const trips = new Map();
  for (const s of t.stays) {
    const k = L(s.trip) || `${cname(s)} ${String(s.arrive).slice(0, 4)}`;
    if (!trips.has(k)) trips.set(k, []);
    trips.get(k).push(s);
  }
  const tripList = [...trips].map(([name, stays]) => ({ name, stays, start: stays[0].arrive, end: stays.at(-1).depart, nights: stays.reduce((a, s) => a + s.nights, 0) })).sort((a, b) => String(b.start).localeCompare(String(a.start)));

  const homeName = t.home ? countryName({ country: t.home, code: t.homeCode, name: t.travel.homeName }) : '';
  const livedList = [...t.lived.values()].sort((a, b) => a.periods[0].from.localeCompare(b.periods[0].from));
  const yearSpan = (periods) => [...new Set(periods.map((p) => `${p.from.slice(0, 4)}${p.to && p.to.slice(0, 4) !== p.from.slice(0, 4) ? `–${p.to.slice(2, 4)}` : ''}`))].join(', ');
  const range = (p) => `${fmtDate(p.from)} – ${p.to ? fmtDate(p.to) : T.present}`;

  // Visited, grouped by region in the order they first appear
  const regions = new Map();
  for (const v of t.visited) { if (!regions.has(v.region)) regions.set(v.region, []); regions.get(v.region).push(v); }

  const mapData = {
    lang,
    t: T.map,
    home: t.home ? { name: t.home, label: homeName, flag: flag(t.homeCode) } : null,
    lived: livedList.map((c) => ({ name: c.country, label: cname(c), flag: flag(c.code), years: yearSpan(c.periods) })),
    visited: t.visited.map((c) => ({ name: c.country, label: cname(c), nights: c.nights || 0, flag: flag(c.code) })),
    airports: t.airportList.map(({ code, name, city, lat, lon, uses }) => ({ code, name, city, lat, lon, uses })),
    routes: [...t.routes].map(([k, count]) => { const [a, b] = k.split('-'); return { a, b, count }; }),
    aliases: t.travel.mapNames || {},
  };

  const homeYears = Math.floor(t.homeDays / 365.25);
  const homeBlock = t.home ? `<section class="travel-section">
  <h2>${T.home}</h2>
  <div class="place-card home">
    <div class="place-head"><span class="flag">${flag(t.homeCode)}</span><div><strong>${esc(homeName)}</strong><small class="muted">${t.travel.born ? `${esc(T.born(fmtDate(t.travel.born)))} · ` : ''}${homeYears ? esc(T.yearsHere(homeYears)) : ''}</small></div></div>
    ${t.homePeriods.length ? `<ol class="periods">${t.homePeriods.map((p) => `<li><span>${range(p)}</span><span class="muted">${p.to ? spanText(daysBetween(p.from, p.to)) : p.from > t.today ? T.fromThenOn : T.soFar(spanText(daysBetween(p.from, t.today)))}</span></li>`).join('')}</ol>` : ''}
  </div>
</section>` : '';

  const livedBlock = livedList.length ? `<section class="travel-section">
  <h2>${T.lived} <span class="count">${livedList.length}</span></h2>
  <div class="place-grid">${livedList.map((c) => `<div class="place-card lived">
    <div class="place-head"><span class="flag">${flag(c.code)}</span><div><strong>${esc(cname(c))}</strong><small class="muted">${esc(T.inAll(spanText(c.days)))}</small></div></div>
    <ol class="periods">${c.periods.map((p) => `<li><span>${range(p)}</span><span class="muted">${spanText(daysBetween(p.from, p.to))}</span></li>`).join('')}</ol>
  </div>`).join('')}</div>
</section>` : '';

  const visitedBlock = t.visited.length ? `<section class="travel-section">
  <h2>${T.visited} <span class="count">${t.visited.length}</span></h2>
  ${[...regions].map(([region, list]) => `<h3 class="region">${esc(regionName(region))} <span class="count">${list.length}</span></h3>
  <ul class="country-list">${[...list].sort((a, b) => cname(a).localeCompare(cname(b), lang)).map((c) => { const pl = places(c.places); return `<li><span class="flag">${flag(c.code)}</span><span class="c-name">${esc(cname(c))}${pl.length ? `<small class="muted">${esc(pl.join(', '))}</small>` : ''}</span><span class="c-meta">${c.nights ? T.firstVisit(c.nights, timeTag(String(c.first).slice(0, 7))) : ''}</span></li>`; }).join('')}</ul>`).join('')}
</section>` : '';

  const introSrc = L(t.travel.intro) || C('travelIntro') || T.travelIntro;
  const stat = (n, label) => `<div><strong>${n}</strong><span>${label}</span></div>`;
  const body = `<section class="page-head">
  <h1>${T.travelTitle}</h1>
  <div class="dek">${render(introSrc)}</div>
</section>
<section class="stats">
  ${stat(t.allPlaces.size, T.countries)}
  ${stat(t.visited.length, T.visitedStat)}
  ${stat(livedList.length, T.livedStat)}
  ${totalNights ? stat(num(totalNights), T.nightsAbroad) : ''}
  ${t.airportList.length ? stat(t.airportList.length, T.airportsStat) : ''}
  ${t.flights.length ? stat(t.flights.length, T.flightsStat) : ''}
  ${t.km ? stat(num(t.km), `${T.kmFlown}${t.km > 40075 ? ` · ${T.roundEarth((t.km / 40075).toLocaleString(lang, { maximumFractionDigits: 1 }))}` : ''}`) : ''}
</section>
<section class="map-wrap">
  <div id="travel-map" class="travel-map" aria-label="${esc(T.mapLabel)}"><p class="muted map-loading">${T.loadingMap}</p></div>
  <div class="map-legend">${t.home ? `<span><i class="swatch home"></i>${T.home}</span>` : ''}${livedList.length ? `<span><i class="swatch lived"></i>${T.lived}</span>` : ''}<span><i class="swatch visited"></i>${T.visited}</span>${t.airportList.length ? `<span><i class="swatch airport"></i>${T.airport}</span><span><i class="swatch route"></i>${T.route}</span>` : ''}</div>
  <div class="map-tip" hidden></div>
</section>
${homeBlock}
${livedBlock}
${visitedBlock}
${totalNights ? `<section class="travel-section">
  <h2>${T.nightsByYear}</h2>
  ${barChartYears(t.yearRows)}
</section>
<section class="travel-section">
  <h2>${T.mostNights}</h2>
  ${hBarChart(topCountries)}
  ${longest ? `<p class="muted">${T.longestStay(longest.nights, esc(L(longest.place) ? `${L(longest.place)}, ${cname(longest)}` : cname(longest)), timeTag(longest.arrive))}</p>` : ''}
</section>` : ''}
${tripList.length ? `<section class="travel-section">
  <h2>${T.trips}</h2>
  <ol class="trip-list">${tripList.map((tr) => `<li><div class="trip-head"><strong>${esc(tr.name)}</strong><span class="muted">${timeTag(tr.start)} · ${tr.nights} ${T.nights(tr.nights)}</span></div><p>${tr.stays.map((s) => `${flag(s.code)} ${esc(L(s.place) ? `${L(s.place)}, ${cname(s)}` : cname(s))} <span class="muted">(${s.nights})</span>`).join(' → ')}</p></li>`).join('')}</ol>
</section>` : ''}
${t.airportList.length ? `<section class="travel-section">
  <h2>${T.airports} <span class="count">${t.airportList.length}</span></h2>
  <ul class="airport-list">${[...t.airportList].sort((a, b) => b.uses - a.uses).map((a) => `<li><span class="iata">${esc(a.code)}</span><span>${esc(a.name)}<small class="muted">${esc(a.city || '')}</small></span><span class="muted">${a.uses}×</span></li>`).join('')}</ul>
</section>` : ''}
<script type="application/json" id="travel-data">${JSON.stringify(mapData).replace(/</g, '\\u003c')}</script>`;
  await writePage(R.travel, layout({ title: T.travelTitle, active: 'travel', body, url: R.travel, alt: ROUTES[other()].travel, scripts: '<script src="/assets/travel-map.js" defer></script>' }));
  previews[R.travel] = { kind: T.kind.section, title: T.travelTitle, text: T.travelPreview(t.allPlaces.size, t.visited.length, livedList.length) };
  return { countries: t.allPlaces.size, visited: t.visited.length, lived: livedList.length, nights: totalNights, airports: t.airportList.length };
}

// ---------- redirects from the old, English-only addresses ----------
const redirectPage = (to) => `<!doctype html>
<html lang="${DEFAULT_LANG}"><head><meta charset="utf-8"><title>…</title>
<link rel="canonical" href="${to}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash)</script>
</head><body><a href="${to}">${to}</a></body></html>`;

async function buildRedirects(noteSlugs) {
  const R0 = ROUTES[DEFAULT_LANG];
  for (const [key, from] of Object.entries(OLD_ROUTES)) {
    if (key === 'notes') continue;
    if (from !== R0[key]) await writePage(from, redirectPage(R0[key]));
  }
  if (OLD_ROUTES.notes !== R0.notes) for (const slug of noteSlugs) await writePage(`${OLD_ROUTES.notes}${slug}/`, redirectPage(`${R0.notes}${slug}/`));
}

// ---------- main ----------
async function main() {
  const started = Date.now();
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await copyDir(p('static'), OUT);

  // World map outline (installed from npm on GitHub; the map falls back to a CDN otherwise)
  const atlas = p('node_modules', 'world-atlas', 'countries-110m.json');
  if (fss.existsSync(atlas)) { await fs.mkdir(path.join(OUT, 'data'), { recursive: true }); await fs.copyFile(atlas, path.join(OUT, 'data', 'countries-110m.json')); }

  const noteVersions = await loadNotes();
  const pageVersions = await loadPages();
  const books = await readJSON(p('data', 'books.json'), []);
  const cv = await readJSON(p('data', 'cv.json'), null);
  const photos = await processPhotos();
  const travel = await loadTravel();
  const previews = {};

  for (const l of LANGS) {
    setLang(l);
    const notes = [...noteVersions.values()].map((v) => pick(v, l)).sort((a, b) => String(b.tended).localeCompare(String(a.tended)));
    const notesBySlug = new Map(notes.map((n) => [n.slug, n]));
    const backlinks = new Map(notes.map((n) => [n.slug, new Set()]));
    const render = makeRenderer(notesBySlug, backlinks);

    await buildNotes(notes, render, backlinks, previews);
    await buildGarden(notes, previews);
    await buildBooks(books, render, previews);
    await buildPhotos(photos, previews);
    const travelSummary = await buildTravel(travel, render, previews);
    await buildCV(cv, render, previews);
    await buildPages(pageVersions, render, previews);
    await buildHome(notes, books, photos, travelSummary, previews);
  }

  setLang(DEFAULT_LANG);
  await buildRedirects([...noteVersions.keys()]);
  await write('previews.json', JSON.stringify(previews));
  const nf = LANGS.map((l) => { setLang(l); return `<section class="page-head" lang="${l}"><h1>${T.notFoundTitle}</h1><p class="dek">${T.notFoundBody(R.garden)}</p></section>`; }).join('');
  setLang(DEFAULT_LANG);
  await write('404.html', layout({ title: T.notFoundTitle, body: nf }));
  const count = (m, l) => [...m.values()].filter((v) => v[l]).length;
  console.log(`Built ${noteVersions.size} notes (${LANGS.map((l) => `${count(noteVersions, l)} ${l}`).join(', ')}), ${books.length} books, ${photos.length} photos, ${travel.allPlaces.size} countries, in ${LANGS.join(' + ')}, in ${Date.now() - started}ms${sharp ? '' : ' (sharp not installed: photos copied without resizing)'}`);
}

await main();
