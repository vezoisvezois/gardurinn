// Small progressive enhancements. The site works without JavaScript; this adds polish.
(() => {
  // ---------- "6ya" badges after dates ----------
  function ago(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    if (!m) {
      const years = now.getFullYear() - y;
      return years > 0 ? [`${years}ya`, `${years} year${years > 1 ? 's' : ''} ago`] : null;
    }
    const then = new Date(y, m - 1, d || 1);
    const days = Math.floor((now - then) / 86400000);
    if (days < 1) return null;
    if (days < 31) return [`${days}d`, `${days} day${days > 1 ? 's' : ''} ago`];
    const months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1)) - (d && now.getDate() < d ? 1 : 0);
    if (months < 12) return [`${Math.max(months, 1)}mo`, `${Math.max(months, 1)} month${months > 1 ? 's' : ''} ago`];
    const years = Math.floor(months / 12);
    return [`${years}ya`, `${years} year${years > 1 ? 's' : ''} ago`];
  }
  document.querySelectorAll('time.ago[datetime]').forEach((t) => {
    const r = ago(t.getAttribute('datetime'));
    if (!r) return;
    const b = document.createElement('span');
    b.className = 'ago-badge';
    b.textContent = r[0];
    b.title = r[1];
    t.append(b);
  });

  // ---------- Sidenotes: highlight the pair on hover ----------
  document.querySelectorAll('.sn').forEach((sn) => {
    const ref = sn.querySelector('.sn-ref'), note = sn.querySelector('.sidenote');
    const on = () => { ref.classList.add('lit'); note.classList.add('lit'); };
    const off = () => { ref.classList.remove('lit'); note.classList.remove('lit'); };
    [ref, note].forEach((el) => { el.addEventListener('mouseenter', on); el.addEventListener('mouseleave', off); });
  });

  // ---------- Hover previews ----------
  if (window.matchMedia('(hover: hover)').matches) {
    let previews;
    const load = () => (previews ??= fetch('/previews.json').then((r) => r.json()).catch(() => ({})));
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.setAttribute('role', 'tooltip');
    card.hidden = true;
    document.body.append(card);
    let showT, hideT, current;
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    async function show(a) {
      const url = new URL(a.href, location.href);
      let html;
      if (url.origin === location.origin) {
        const key = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
        if (key === location.pathname) return;
        const p = (await load())[key];
        if (!p) return;
        html = `${p.image ? `<img class="pv-img" src="${esc(p.image)}" alt="">` : ''}
          <span class="eyebrow">${esc(p.kind)}${p.stage ? ` · ${esc(p.stage)}` : ''}</span>
          <h4>${esc(p.title)}</h4><p>${esc(p.text)}</p>
          ${p.date ? `<div class="pv-foot"><span>Last tended ${esc(p.date)}</span></div>` : ''}`;
      } else if (/^https?:$/.test(url.protocol)) {
        const label = a.dataset.preview || a.title || '';
        html = `<span class="eyebrow">External link ↗</span><h4>${esc(url.hostname.replace(/^www\./, ''))}</h4>
          ${label ? `<p>${esc(label)}</p>` : ''}<div class="pv-url">${esc(url.href.replace(/^https?:\/\//, '').slice(0, 90))}</div>`;
      } else return;
      if (current !== a) return;
      card.innerHTML = html;
      card.hidden = false;
      const r = a.getBoundingClientRect();
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let left = Math.min(Math.max(8, r.left + r.width / 2 - cw / 2), window.innerWidth - cw - 8);
      let top = r.bottom + 10;
      if (top + ch > window.innerHeight - 8) top = r.top - ch - 10;
      card.style.left = `${left + scrollX}px`;
      card.style.top = `${top + scrollY}px`;
      requestAnimationFrame(() => card.classList.add('show'));
    }
    function hide() { card.classList.remove('show'); card.hidden = true; current = null; }

    document.addEventListener('mouseover', (e) => {
      const a = e.target.closest('main a[href]');
      if (!a || a.contains(e.relatedTarget)) return;
      if (a.closest('.card, .tile, .site-header, .filters, .photo')) return;
      clearTimeout(hideT); clearTimeout(showT);
      current = a;
      showT = setTimeout(() => show(a), 280);
    });
    document.addEventListener('mouseout', (e) => {
      const a = e.target.closest('main a[href]');
      if (!a || a.contains(e.relatedTarget)) return;
      clearTimeout(showT);
      hideT = setTimeout(hide, 180);
    });
    card.addEventListener('mouseenter', () => clearTimeout(hideT));
    card.addEventListener('mouseleave', () => { hideT = setTimeout(hide, 180); });
    window.addEventListener('scroll', () => { if (!card.hidden) hide(); }, { passive: true });
  }

  // ---------- Garden filters ----------
  const grid = document.querySelector('.garden-grid');
  if (grid) {
    const state = { type: 'all', stage: 'all', topic: 'all' };
    const apply = () => {
      let shown = 0;
      grid.querySelectorAll('.note-card').forEach((c) => {
        const ok = (state.type === 'all' || c.dataset.type === state.type) &&
          (state.stage === 'all' || c.dataset.stage === state.stage) &&
          (state.topic === 'all' || (c.dataset.topics || '').split(' ').includes(state.topic));
        c.hidden = !ok; if (ok) shown++;
      });
      document.querySelector('.empty').hidden = shown > 0;
    };
    const set = (kind, value) => {
      state[kind] = value;
      document.querySelectorAll(`[data-filter="${kind}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
      apply();
    };
    document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      set(b.dataset.filter, b.dataset.value);
      if (b.dataset.filter === 'topic') history.replaceState(null, '', b.dataset.value === 'all' ? location.pathname : `#${b.dataset.value}`);
    }));
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && document.querySelector(`[data-filter="topic"][data-value="${CSS.escape(hash)}"]`)) set('topic', hash);
  }

  // ---------- Photo lightbox ----------
  const dlg = document.querySelector('.lightbox');
  if (dlg) {
    const imgs = [...document.querySelectorAll('.photo img')];
    const big = dlg.querySelector('img'), cap = dlg.querySelector('figcaption');
    let i = 0;
    const open = (k) => {
      i = (k + imgs.length) % imgs.length;
      const im = imgs[i];
      big.src = im.dataset.full; big.alt = im.alt;
      cap.innerHTML = im.closest('figure').querySelector('figcaption')?.innerHTML || '';
      if (!dlg.open) dlg.showModal();
    };
    imgs.forEach((im, k) => im.closest('.photo-open').addEventListener('click', () => open(k)));
    dlg.querySelector('.lb-close').addEventListener('click', () => dlg.close());
    dlg.querySelector('.lb-prev').addEventListener('click', () => open(i - 1));
    dlg.querySelector('.lb-next').addEventListener('click', () => open(i + 1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.tagName === 'FIGURE') dlg.close(); });
    dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') open(i + 1); if (e.key === 'ArrowLeft') open(i - 1); });
  }
})();
