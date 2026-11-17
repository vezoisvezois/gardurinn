// Digital garden builder — turns content/ and data/ into a static site in dist/.
// Run: npm run build   (or npm run dev for a local preview that rebuilds on save)

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');
const p = (...a) => path.join(ROOT, ...a);

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional: photos are copied as-is */ }

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJSON = async (f, fallback) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw new Error(`${f}: ${e.message}`); } };
const slugify = (s) => String(s).trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const asDate = (s) => { const [y, m = 1, d = 1] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  if (!m) return String(y);
  if (!d) return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
// <time class="ago"> gets a small "6ya" badge added in the browser, so it never goes stale.
const timeTag = (s) => (s ? `<time class="ago" datetime="${esc(s)}">${esc(fmtDate(s))}</time>` : '');

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

async function write(rel, content) {
  const f = path.join(OUT, rel);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, content);
}

async function copyDir(src, dest) {
  if (!fss.existsSync(src)) return;
  await fs.cp(src, dest, { recursive: true });
}

// ---------- config ----------
const config = await readJSON(p('site.config.json'), {});
const NAV = [
  ['Garden', '/garden/'],
  ['Books', '/books/'],
  ['Photos', '/photos/'],
  ['Travel', '/travel/'],
  ['About', '/about/'],
];

// ---------- icons ----------
const STAGES = {
  seedling: { label: 'Seedling', blurb: 'Rough and early. An idea I’ve only just planted.' },
  budding: { label: 'Budding', blurb: 'Taking shape. Cleaned up, but still growing.' },
  evergreen: { label: 'Evergreen', blurb: 'Fairly complete. I’ll still tend it now and then.' },
};
const stageIcon = (stage) => {
  const paths = {
    seedling: '<path d="M12 21v-8"/><path d="M12 13c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    budding: '<path d="M12 21v-7"/><path d="M12 14c-3.5 0-5.5-2.5-5.5-6 2 0 4 .8 5.5 2.5C13.5 8.8 15.5 8 17.5 8c0 3.5-2 6-5.5 6z"/><path d="M12 10.5V5"/><circle cx="12" cy="4" r="1.4"/>',
    evergreen: '<path d="M12 3l5 7h-3l4 6h-4l3 4H7l3-4H6l4-6H7z"/><path d="M12 20v2"/>',
  };
  return `<svg class="stage-icon stage-${esc(stage)}" viewBox="0 0 24 24" aria-hidden="true">${paths[stage] || paths.seedling}</svg>`;
};
const stageBadge = (stage) => (STAGES[stage] ? `<span class="stage" title="${esc(STAGES[stage].blurb)}">${stageIcon(stage)}${STAGES[stage].label}</span>` : '');
const TYPES = { essay: 'Essay', note: 'Note', pattern: 'Pattern', project: 'Project' };

// ---------- layout ----------
function layout({ title, description = config.description, active = '', body, scripts = '', bodyClass = '' }) {
  const fullTitle = title ? `${title} · ${config.title}` : config.title;
  return `<!doctype html>
<html lang="${esc(config.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="${esc(bodyClass)}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/">${esc(config.title)}</a>
  <nav aria-label="Main">${NAV.map(([label, href]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
</header>
<main id="main" data-previews>
${body}
</main>
<footer class="site-footer">
  <p>${esc(config.footer || '')}</p>
  <p class="muted">Tended by ${esc(config.author)} · <a href="/garden/">Browse the garden</a></p>
</footer>
<script src="/assets/garden.js" defer></script>
${scripts}
</body>
</html>`;
}

// ---------- markdown: sidenotes, wikilinks, relative dates ----------
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
            return keep(`<a href="/notes/${slug}/" class="wikilink">${esc(text)}</a>`);
          }
          return keep(`<span class="wikilink unplanted" title="Not planted yet">${esc(text)}</span>`);
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
        `<span class="sn"><label for="${uid}" class="sn-ref" aria-label="Sidenote ${n}">${n}</label><input type="checkbox" id="${uid}" class="sn-check"><span class="sidenote" role="note"><span class="sn-num">${n}</span>${content}</span></span>`
      );
    });

    // Plain markdown links to /notes/x/ also count as backlinks
    if (fromSlug) {
      for (const m of src.matchAll(/\]\(\/notes\/([^/)#\s]+)\/?[^)]*\)/g)) {
        if (m[1] !== fromSlug) backlinks.get(m[1])?.add(fromSlug);
      }
    }

    let html = marked.parse(restoreCode(src));
    for (let i = 0; i < 5 && /ZZTOK\d+ZZ/.test(html); i++) html = html.replace(/ZZTOK(\d+)ZZ/g, (_, k) => tokens[+k]);
    // External links open in a new tab
    html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
    return html;
  };
}

const plainText = (md) => md.replace(/^\[\^[^\]]+\]:.*$/gm, '').replace(/\[\^[^\]]+\]/g, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a).replace(/\{\{([\d-]+)\}\}/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`~]/g, '').replace(/\s+/g, ' ').trim();
const excerpt = (md, len = 180) => { const t = plainText(md); return t.length > len ? t.slice(0, len).replace(/\s+\S*$/, '') + '…' : t; };

// ---------- load notes ----------
async function loadNotes() {
  const dir = p('content', 'notes');
  const files = fss.existsSync(dir) ? (await fs.readdir(dir)).filter((f) => f.endsWith('.md')) : [];
  const notes = [];
  for (const f of files) {
    const { data, body } = parseFrontmatter(await fs.readFile(path.join(dir, f), 'utf8'));
    if (data.draft === true) continue;
    const slug = f.replace(/\.md$/, '');
    notes.push({
      slug,
      title: data.title || slug,
      description: data.description || excerpt(body, 140),
      type: TYPES[data.type] ? data.type : 'note',
      stage: STAGES[data.stage] ? data.stage : 'seedling',
      planted: data.planted || '',
      tended: data.tended || data.planted || '',
      topics: Array.isArray(data.topics) ? data.topics : data.topics ? [data.topics] : [],
      body,
    });
  }
  notes.sort((a, b) => String(b.tended).localeCompare(String(a.tended)));
  return notes;
}

function noteCard(n) {
  return `<li class="card note-card" data-type="${n.type}" data-stage="${n.stage}">
  <a href="/notes/${n.slug}/">
    <span class="eyebrow">${TYPES[n.type]}</span>
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
    const body = `<article class="note">
  <header class="note-head">
    <p class="eyebrow">${TYPES[n.type]} ${stageBadge(n.stage)}</p>
    <h1>${esc(n.title)}</h1>
    ${n.description ? `<p class="dek">${esc(n.description)}</p>` : ''}
    <dl class="meta">
      ${n.planted ? `<div><dt>Planted</dt><dd>${timeTag(n.planted)}</dd></div>` : ''}
      ${n.tended && n.tended !== n.planted ? `<div><dt>Last tended</dt><dd>${timeTag(n.tended)}</dd></div>` : ''}
      ${n.topics.length ? `<div><dt>Topics</dt><dd>${n.topics.map((t) => `<a class="chip" href="/garden/#${slugify(t)}">${esc(t)}</a>`).join(' ')}</dd></div>` : ''}
    </dl>
  </header>
  <div class="prose">
${n.html}
  </div>
  ${back.length ? `<aside class="backlinks"><h2>Linking here</h2><ul class="cards">${back.map(noteCard).join('')}</ul></aside>` : ''}
</article>`;
    await write(`notes/${n.slug}/index.html`, layout({ title: n.title, description: n.description, active: '/garden/', body }));
    previews[`/notes/${n.slug}/`] = { kind: TYPES[n.type], title: n.title, text: n.description, stage: STAGES[n.stage].label, date: n.tended };
  }
}

async function buildGarden(notes, previews) {
  const topics = [...new Set(notes.flatMap((n) => n.topics))].sort();
  const body = `<section class="page-head">
  <h1>The Garden</h1>
  <p class="dek">${esc(config.gardenIntro || 'Notes, essays and half-finished thoughts, growing at different speeds.')}</p>
  <ul class="stage-key">${Object.entries(STAGES).map(([k, s]) => `<li>${stageIcon(k)}<strong>${s.label}</strong> <span class="muted">${s.blurb}</span></li>`).join('')}</ul>
</section>
<div class="filters" role="toolbar" aria-label="Filter notes">
  <div class="filter-group"><button data-filter="type" data-value="all" aria-pressed="true">All</button>${Object.entries(TYPES).filter(([k]) => notes.some((n) => n.type === k)).map(([k, v]) => `<button data-filter="type" data-value="${k}" aria-pressed="false">${v}s</button>`).join('')}</div>
  <div class="filter-group"><button data-filter="stage" data-value="all" aria-pressed="true">Any stage</button>${Object.entries(STAGES).map(([k, v]) => `<button data-filter="stage" data-value="${k}" aria-pressed="false">${stageIcon(k)}${v.label}</button>`).join('')}</div>
  ${topics.length ? `<div class="filter-group topics"><button data-filter="topic" data-value="all" aria-pressed="true">All topics</button>${topics.map((t) => `<button data-filter="topic" data-value="${slugify(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>` : ''}
</div>
<ul class="cards garden-grid">${notes.map((n) => noteCard(n).replace('<li class="card note-card"', `<li class="card note-card" data-topics="${n.topics.map(slugify).join(' ')}"`)).join('')}</ul>
<p class="empty muted" hidden>Nothing growing here yet.</p>`;
  await write('garden/index.html', layout({ title: 'Garden', active: '/garden/', body }));
  previews['/garden/'] = { kind: 'Section', title: 'The Garden', text: `${notes.length} notes and essays at different stages of growth.` };
}

async function buildHome(notes, books, photos, travelSummary, previews) {
  const reading = books.filter((b) => b.status === 'reading').slice(0, 3);
  const recentPhotos = photos.slice(0, 4);
  const body = `<section class="hero">
  <h1>${config.heroTitle || esc(config.title)}</h1>
  <p class="dek">${esc(config.heroIntro || config.description)}</p>
</section>
<section class="home-section">
  <div class="section-head"><h2>Recently tended</h2><a href="/garden/">The whole garden →</a></div>
  <ul class="cards">${notes.slice(0, 6).map(noteCard).join('')}</ul>
</section>
<section class="home-grid">
  <a class="tile" href="/books/">
    <span class="eyebrow">Library</span>
    <h2>Books</h2>
    <p>${books.filter((b) => b.status === 'read').length} read${reading.length ? ` · currently reading <em>${esc(reading[0].title)}</em>` : ''}</p>
  </a>
  <a class="tile" href="/photos/">
    <span class="eyebrow">Life in pictures</span>
    <h2>Photos</h2>
    <div class="tile-photos">${recentPhotos.map((ph) => `<img src="${ph.thumb}" alt="" loading="lazy">`).join('')}</div>
  </a>
  <a class="tile" href="/travel/">
    <span class="eyebrow">Atlas</span>
    <h2>Travel</h2>
    <p>${travelSummary.countries} countries · ${travelSummary.nights} nights abroad · ${travelSummary.airports} airports</p>
  </a>
</section>`;
  await write('index.html', layout({ title: '', active: '/', body, bodyClass: 'home' }));
  previews['/'] = { kind: 'Home', title: config.title, text: config.description };
}

async function buildPages(render, previews) {
  const dir = p('content', 'pages');
  if (!fss.existsSync(dir)) return;
  for (const f of (await fs.readdir(dir)).filter((x) => x.endsWith('.md'))) {
    const { data, body } = parseFrontmatter(await fs.readFile(path.join(dir, f), 'utf8'));
    const slug = f.replace(/\.md$/, '');
    const html = render(body, null, `sn-${slug}`);
    const page = `<article class="note">
  <header class="note-head"><h1>${esc(data.title || slug)}</h1>${data.description ? `<p class="dek">${esc(data.description)}</p>` : ''}</header>
  <div class="prose">${html}</div>
</article>`;
    await write(`${slug}/index.html`, layout({ title: data.title, description: data.description, active: `/${slug}/`, body: page }));
    previews[`/${slug}/`] = { kind: 'Page', title: data.title || slug, text: data.description || excerpt(body) };
  }
}

// ---------- books ----------
function bookCover(b) {
  const hue = [...b.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const fallback = `<div class="cover-fallback" style="--hue:${hue}"><span>${esc(b.title)}</span><small>${esc(b.author)}</small></div>`;
  const src = b.cover || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${String(b.isbn).replace(/[^0-9X]/gi, '')}-M.jpg?default=false` : '');
  return `<div class="cover">${fallback}${src ? `<img src="${esc(src)}" alt="Cover of ${esc(b.title)}" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}
const stars = (r) => (r ? `<span class="rating" aria-label="${r} out of 5">${'★'.repeat(r)}<span class="muted">${'★'.repeat(5 - r)}</span></span>` : '');

function bookCard(b, render) {
  const inner = `${bookCover(b)}
    <div class="book-meta">
      <h3>${esc(b.title)}</h3>
      <p class="muted">${esc(b.author)}</p>
      ${stars(b.rating)}
      ${b.thoughts ? `<div class="book-thoughts">${render(b.thoughts)}</div>` : ''}
      ${b.note ? `<a class="book-link" href="/notes/${esc(b.note)}/">Read my notes →</a>` : ''}
      ${b.finished ? `<p class="muted small">Finished ${timeTag(b.finished)}</p>` : ''}
    </div>`;
  return `<li class="book">${inner}</li>`;
}

async function buildBooks(books, render, previews) {
  const reading = books.filter((b) => b.status === 'reading');
  const read = books.filter((b) => b.status === 'read').sort((a, b) => String(b.finished || '').localeCompare(String(a.finished || '')));
  const toRead = books.filter((b) => b.status === 'to-read');
  const byYear = new Map();
  for (const b of read) {
    const y = b.finished ? String(b.finished).slice(0, 4) : 'Undated';
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(b);
  }
  const shelf = (list) => `<ul class="shelf">${list.map((b) => bookCard(b, render)).join('')}</ul>`;
  const body = `<section class="page-head">
  <h1>Books</h1>
  <p class="dek">${esc(config.booksIntro || 'What I’m reading, what I’ve read, and the pile waiting for me.')}</p>
  <p class="stat-line"><strong>${read.length}</strong> read · <strong>${reading.length}</strong> on the nightstand · <strong>${toRead.length}</strong> in the anti-library</p>
</section>
${reading.length ? `<section class="book-section"><h2>Currently reading</h2>${shelf(reading)}</section>` : ''}
${[...byYear].map(([y, list]) => `<section class="book-section"><h2>${esc(y)} <span class="count">${list.length}</span></h2>${shelf(list)}</section>`).join('')}
${toRead.length ? `<section class="book-section"><h2>Anti-library <span class="count">${toRead.length}</span></h2><p class="muted">Books I want to read, someday.</p>${shelf(toRead)}</section>` : ''}`;
  await write('books/index.html', layout({ title: 'Books', active: '/books/', body }));
  previews['/books/'] = { kind: 'Section', title: 'Books', text: `${read.length} books read, ${reading.length} in progress.` };
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
    const y = ph.date ? String(ph.date).slice(0, 4) : 'Undated';
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(ph);
  }
  let i = 0;
  const fig = (ph) => `<figure class="photo" data-index="${i++}">
  <button class="photo-open" aria-label="Open photo${ph.caption ? `: ${esc(ph.caption)}` : ''}"><img src="${ph.thumb}" data-full="${ph.full}" alt="${esc(ph.alt || ph.caption || '')}" loading="lazy"${ph.width ? ` width="${ph.width}" height="${ph.height}"` : ''}></button>
  ${ph.caption || ph.place ? `<figcaption>${esc(ph.caption || '')}${ph.place ? ` <span class="muted">· ${esc(ph.place)}</span>` : ''}</figcaption>` : ''}
</figure>`;
  const body = `<section class="page-head">
  <h1>Photos</h1>
  <p class="dek">${esc(config.photosIntro || 'Moments from my life, roughly in order.')}</p>
</section>
${[...byYear].map(([y, list]) => `<section class="photo-year"><h2>${esc(y)}</h2><div class="photo-grid">${list.map(fig).join('')}</div></section>`).join('')}
${photos.length ? '' : '<p class="muted">No photos yet — add some to content/photos/ and list them in data/photos.json.</p>'}
<dialog class="lightbox" aria-label="Photo viewer">
  <button class="lb-close" aria-label="Close">×</button>
  <button class="lb-prev" aria-label="Previous photo">‹</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="lb-next" aria-label="Next photo">›</button>
</dialog>`;
  await write('photos/index.html', layout({ title: 'Photos', active: '/photos/', body }));
  previews['/photos/'] = { kind: 'Section', title: 'Photos', text: `${photos.length} photographs from my life.`, image: photos[0]?.thumb };
}

// ---------- travel ----------
const DAY = 86400000;
function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const flag = (code) => (code && /^[A-Za-z]{2}$/.test(code) ? [...code.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') : '🏳️');

function barChartYears(rows) {
  if (!rows.length) return '';
  const W = 720, H = 240, m = { t: 24, r: 8, b: 28, l: 8 };
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bw = (W - m.l - m.r) / rows.length;
  const bars = rows.map((r, i) => {
    const h = ((H - m.t - m.b) * r.value) / max;
    const x = m.l + i * bw + bw * 0.15, y = H - m.b - h;
    return `<g><title>${r.label}: ${r.value} nights abroad</title>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(h, r.value ? 2 : 0).toFixed(1)}" rx="3" class="bar"/>
${r.value ? `<text x="${(x + bw * 0.35).toFixed(1)}" y="${(y - 6).toFixed(1)}" class="bar-value">${r.value}</text>` : ''}
<text x="${(x + bw * 0.35).toFixed(1)}" y="${H - 8}" class="axis-label">${rows.length > 14 ? `’${String(r.label).slice(2)}` : r.label}</text></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nights abroad per year">
<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" class="baseline"/>${bars.join('')}</svg>`;
}

function hBarChart(rows, unit = 'nights') {
  if (!rows.length) return '';
  const rowH = 30, labelW = 190, W = 720, H = rows.length * rowH + 8;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bars = rows.map((r, i) => {
    const w = ((W - labelW - 60) * r.value) / max, y = i * rowH + 4;
    return `<g><title>${esc(r.label)}: ${r.value} ${unit}</title>
<text x="${labelW - 10}" y="${y + 18}" class="row-label">${esc(r.label)}</text>
<rect x="${labelW}" y="${y + 4}" width="${Math.max(w, 2).toFixed(1)}" height="${rowH - 10}" rx="3" class="bar"/>
<text x="${(labelW + w + 6).toFixed(1)}" y="${y + 18}" class="bar-value start">${r.value}</text></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nights by country">${bars.join('')}</svg>`;
}

async function loadTravel() {
  const travel = await readJSON(p('data', 'travel.json'), { stays: [], flights: [] });
  const airports = await readJSON(p('data', 'airports.json'), {});
  const home = travel.home || config.home || '';
  const stays = (travel.stays || []).filter((s) => s.country && s.country !== home).map((s) => ({ ...s, nights: s.arrive && s.depart ? Math.max(0, Math.round((asDate(s.depart) - asDate(s.arrive)) / DAY)) : 0 }));
  stays.sort((a, b) => String(a.arrive).localeCompare(String(b.arrive)));

  // Countries with first visit, total nights, visits
  const countries = new Map();
  for (const s of stays) {
    const c = countries.get(s.country) || { name: s.country, code: s.code, first: s.arrive, nights: 0, visits: 0, places: new Set() };
    c.nights += s.nights; c.visits += 1; if (s.place) String(s.place).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => c.places.add(x));
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

  return { travel, home, stays, countries, yearRows, flights, airportList, routes, km: Math.round(km) };
}

async function buildTravel(t, render, previews) {
  const countryList = [...t.countries.values()].sort((a, b) => String(a.first).localeCompare(String(b.first)));
  const totalNights = t.stays.reduce((s, x) => s + x.nights, 0);
  const longest = [...t.stays].sort((a, b) => b.nights - a.nights)[0];
  const topCountries = [...t.countries.values()].sort((a, b) => b.nights - a.nights).slice(0, 12).map((c) => ({ label: `${flag(c.code)} ${c.name}`, value: c.nights }));

  const trips = new Map();
  for (const s of t.stays) {
    const k = s.trip || `${s.country} ${String(s.arrive).slice(0, 4)}`;
    if (!trips.has(k)) trips.set(k, []);
    trips.get(k).push(s);
  }
  const tripList = [...trips].map(([name, stays]) => ({ name, stays, start: stays[0].arrive, end: stays.at(-1).depart, nights: stays.reduce((a, s) => a + s.nights, 0) })).sort((a, b) => String(b.start).localeCompare(String(a.start)));

  const mapData = {
    home: t.home,
    visited: countryList.map((c) => ({ name: c.name, nights: c.nights, flag: flag(c.code) })),
    airports: t.airportList.map(({ code, name, city, lat, lon, uses }) => ({ code, name, city, lat, lon, uses })),
    routes: [...t.routes].map(([k, count]) => { const [a, b] = k.split('-'); return { a, b, count }; }),
    aliases: t.travel.mapNames || {},
  };

  const intro = t.travel.intro ? render(t.travel.intro) : `<p class="dek">${esc(config.travelIntro || 'Where I’ve been, and how long I stayed.')}</p>`;
  const body = `<section class="page-head">
  <h1>Travel</h1>
  ${intro}
</section>
<section class="stats">
  <div><strong>${t.countries.size}</strong><span>countries</span></div>
  <div><strong>${totalNights.toLocaleString('en')}</strong><span>nights abroad</span></div>
  <div><strong>${t.airportList.length}</strong><span>airports</span></div>
  <div><strong>${t.flights.length}</strong><span>flights</span></div>
  <div><strong>${t.km.toLocaleString('en')}</strong><span>km flown${t.km > 40075 ? ` · ${(t.km / 40075).toFixed(1)}× round the Earth` : ''}</span></div>
</section>
<section class="map-wrap">
  <div id="travel-map" class="travel-map" aria-label="World map of countries visited and airports"><p class="muted map-loading">Loading map…</p></div>
  <div class="map-legend"><span><i class="swatch visited"></i>Visited</span>${t.home ? `<span><i class="swatch home"></i>Home</span>` : ''}<span><i class="swatch airport"></i>Airport</span><span><i class="swatch route"></i>Flight route</span></div>
  <div class="map-tip" hidden></div>
</section>
<section class="travel-section">
  <h2>Nights abroad, by year</h2>
  ${barChartYears(t.yearRows)}
</section>
<section class="travel-section">
  <h2>Where I’ve spent the most nights</h2>
  ${hBarChart(topCountries)}
  ${longest ? `<p class="muted">Longest single stay: ${longest.nights} nights in ${esc(longest.place ? `${longest.place}, ` : '')}${esc(longest.country)}, from ${timeTag(longest.arrive)}.</p>` : ''}
</section>
<section class="travel-section">
  <h2>Countries <span class="count">${t.countries.size}</span></h2>
  <ul class="country-list">${countryList.map((c) => `<li><span class="flag">${flag(c.code)}</span><span class="c-name">${esc(c.name)}${c.places.size ? `<small class="muted">${esc([...c.places].join(', '))}</small>` : ''}</span><span class="c-meta">${c.nights} nights · first ${timeTag(String(c.first).slice(0, 7))}</span></li>`).join('')}</ul>
</section>
<section class="travel-section">
  <h2>Trips</h2>
  <ol class="trip-list">${tripList.map((tr) => `<li><div class="trip-head"><strong>${esc(tr.name)}</strong><span class="muted">${timeTag(tr.start)} · ${tr.nights} nights</span></div><p>${tr.stays.map((s) => `${flag(s.code)} ${esc(s.place ? `${s.place}, ${s.country}` : s.country)} <span class="muted">(${s.nights})</span>`).join(' → ')}</p></li>`).join('')}</ol>
</section>
<section class="travel-section">
  <h2>Airports <span class="count">${t.airportList.length}</span></h2>
  <ul class="airport-list">${[...t.airportList].sort((a, b) => b.uses - a.uses).map((a) => `<li><span class="iata">${esc(a.code)}</span><span>${esc(a.name)}<small class="muted">${esc(a.city || '')}</small></span><span class="muted">${a.uses}×</span></li>`).join('')}</ul>
</section>
<script type="application/json" id="travel-data">${JSON.stringify(mapData).replace(/</g, '\\u003c')}</script>`;
  await write('travel/index.html', layout({ title: 'Travel', active: '/travel/', body, scripts: '<script src="/assets/travel-map.js" defer></script>' }));
  previews['/travel/'] = { kind: 'Section', title: 'Travel', text: `${t.countries.size} countries, ${totalNights} nights abroad, ${t.airportList.length} airports.` };
  return { countries: t.countries.size, nights: totalNights, airports: t.airportList.length };
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

  const notes = await loadNotes();
  const notesBySlug = new Map(notes.map((n) => [n.slug, n]));
  const backlinks = new Map(notes.map((n) => [n.slug, new Set()]));
  const render = makeRenderer(notesBySlug, backlinks);
  const previews = {};

  const books = await readJSON(p('data', 'books.json'), []);
  const photos = await processPhotos();
  const travel = await loadTravel();

  await buildNotes(notes, render, backlinks, previews);
  await buildGarden(notes, previews);
  await buildBooks(books, render, previews);
  await buildPhotos(photos, previews);
  const travelSummary = await buildTravel(travel, render, previews);
  await buildPages(render, previews);
  await buildHome(notes, books, photos, travelSummary, previews);

  await write('previews.json', JSON.stringify(previews));
  await write('404.html', layout({ title: 'Not found', body: '<section class="page-head"><h1>Nothing growing here</h1><p class="dek">This page hasn’t been planted. Try <a href="/garden/">the garden</a>.</p></section>' }));
  console.log(`Built ${notes.length} notes, ${books.length} books, ${photos.length} photos, ${travel.countries.size} countries in ${Date.now() - started}ms${sharp ? '' : ' (sharp not installed: photos copied without resizing)'}`);
}

await main();
