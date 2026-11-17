// CV page: filter entries by tag. Works from the chips at the top and the tags on each entry.
// The chosen tag is kept in the address (?tag=scouting) so a filtered view can be shared.
(() => {
  const chips = [...document.querySelectorAll('.cv-chip')];
  if (!chips.length) return;
  const entries = [...document.querySelectorAll('.cv-entry')];
  const sections = [...document.querySelectorAll('.cv-section')];
  const status = document.querySelector('.cv-status');

  function apply(tag, push) {
    if (tag && !chips.some((c) => c.dataset.tag === tag)) tag = '';
    let shown = 0;
    for (const e of entries) {
      const hit = !tag || (e.dataset.tags || '').split(' ').includes(tag);
      e.hidden = !hit;
      if (hit) shown++;
    }
    for (const s of sections) {
      const n = s.querySelectorAll('.cv-entry:not([hidden])').length;
      s.hidden = n === 0;
      const count = s.querySelector('.count');
      if (count) count.textContent = tag ? (status?.dataset.of || '{n} of {t}').replace('{n}', n).replace('{t}', count.dataset.total) : count.dataset.total;
      const jump = document.querySelector(`.cv-jump [data-section="${s.id}"]`);
      if (jump) jump.hidden = n === 0;
    }
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.tag === tag));
    for (const b of document.querySelectorAll('.cv-tag')) b.classList.toggle('active', !!tag && b.dataset.tag === tag);
    const name = chips.find((c) => c.dataset.tag === tag)?.firstChild.textContent.trim();
    if (status) {
      const isl = document.documentElement.lang === 'is';
      const single = isl ? shown % 10 === 1 && shown % 100 !== 11 : shown === 1;
      status.textContent = tag ? (single ? status.dataset.one : status.dataset.many).replace('{n}', shown).replace('{tag}', name) : '';
    }
    if (push) {
      const url = new URL(location.href);
      if (tag) url.searchParams.set('tag', tag); else url.searchParams.delete('tag');
      history.replaceState(null, '', url);
    }
  }

  let current = new URL(location.href).searchParams.get('tag') || '';
  const choose = (tag) => { current = tag === current ? '' : tag; apply(current, true); };
  for (const c of chips) c.addEventListener('click', () => choose(c.dataset.tag));
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.cv-tag');
    if (!b) return;
    choose(b.dataset.tag);
    document.querySelector('.cv-filter')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  apply(current, false);
})();
