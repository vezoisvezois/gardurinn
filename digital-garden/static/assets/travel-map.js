// World map: home, countries lived in, countries visited, airports and great-circle flight routes.
// No libraries — uses the Equal Earth projection and decodes the world-atlas TopoJSON directly.
(async () => {
  const el = document.getElementById('travel-map');
  const dataEl = document.getElementById('travel-data');
  if (!el || !dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const tip = document.querySelector('.map-tip');

  // Country names in the map file sometimes differ from everyday names.
  const ALIASES = {
    'United States': 'United States of America', USA: 'United States of America', 'United Kingdom': 'United Kingdom', UK: 'United Kingdom',
    'Czech Republic': 'Czechia', 'Bosnia and Herzegovina': 'Bosnia and Herz.', 'Dominican Republic': 'Dominican Rep.',
    'Central African Republic': 'Central African Rep.', 'Democratic Republic of the Congo': 'Dem. Rep. Congo', 'DR Congo': 'Dem. Rep. Congo',
    'Republic of the Congo': 'Congo', 'South Sudan': 'S. Sudan', 'Equatorial Guinea': 'Eq. Guinea', 'Ivory Coast': "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire", 'Solomon Islands': 'Solomon Is.', 'Falkland Islands': 'Falkland Is.', 'North Macedonia': 'Macedonia',
    'Eswatini': 'eSwatini', Swaziland: 'eSwatini', 'Western Sahara': 'W. Sahara', 'French Southern Territories': 'Fr. S. Antarctic Lands',
    'East Timor': 'Timor-Leste', 'Northern Cyprus': 'N. Cyprus', 'Turkey': 'Turkey', 'Türkiye': 'Turkey', 'Myanmar': 'Myanmar', Burma: 'Myanmar',
    ...(data.aliases || {}),
  };
  const mapName = (n) => ALIASES[n] || n;

  // ---- Load the world outline (local copy first, then CDN) ----
  let topo;
  for (const url of ['/data/countries-110m.json', 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json']) {
    try { const r = await fetch(url); if (r.ok) { topo = await r.json(); break; } } catch { /* try next */ }
  }
  if (!topo) { el.innerHTML = '<p class="muted map-loading">The map couldn’t load right now.</p>'; return; }

  // ---- TopoJSON decoding ----
  const tf = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([a, b]) => (tf ? (x += a, y += b, [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]) : [a, b]));
  });
  const ring = (idxs) => {
    const pts = [];
    idxs.forEach((i, k) => {
      const seg = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
      pts.push(...(k ? seg.slice(1) : seg));
    });
    return pts;
  };
  const polygons = (g) => (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []).map((poly) => poly.map(ring));

  // ---- Equal Earth projection ----
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2, RAD = Math.PI / 180;
  const ee = (lon, lat) => {
    const l = lon * RAD, th = Math.asin(M * Math.sin(lat * RAD)), t2 = th * th, t6 = t2 * t2 * t2;
    return [(l * Math.cos(th)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  };
  const W = 1000, S = W / (2 * ee(180, 0)[0]);
  const top = 83, bottom = -57; // crop out most of the Arctic and Antarctica
  const y0 = ee(0, top)[1] * S, H = y0 - ee(0, bottom)[1] * S;
  const proj = (lon, lat) => { const [x, y] = ee(lon, lat); return [W / 2 + x * S, y0 - y * S]; };
  const f = (n) => n.toFixed(1);

  // Path from a list of [lon,lat]; breaks the line where it jumps across the antimeridian.
  const linePath = (pts, close) => {
    let d = '', prev;
    for (const [lon, lat] of pts) {
      const [x, y] = proj(lon, Math.max(-89.9, Math.min(89.9, lat)));
      d += prev === undefined || Math.abs(lon - prev) > 180 ? `M${f(x)},${f(y)}` : `L${f(x)},${f(y)}`;
      prev = lon;
    }
    return close ? d + 'Z' : d;
  };

  // Great-circle interpolation between two airports
  const toV = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
  const greatCircle = (a, b, n = 72) => {
    const v1 = toV(a.lon, a.lat), v2 = toV(b.lon, b.lat);
    const dot = Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
    const om = Math.acos(dot);
    if (om < 1e-6) return [[a.lon, a.lat], [b.lon, b.lat]];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, k1 = Math.sin((1 - t) * om) / Math.sin(om), k2 = Math.sin(t * om) / Math.sin(om);
      const x = k1 * v1[0] + k2 * v2[0], y = k1 * v1[1] + k2 * v2[1], z = k1 * v1[2] + k2 * v2[2];
      pts.push([Math.atan2(y, x) / RAD, Math.asin(z) / RAD]);
    }
    return pts;
  };

  // ---- Draw ----
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // One entry per map shape; home beats lived beats visited. Several names can share a shape (England + Scotland).
  const places = new Map();
  const add = (kind, name, label) => {
    const key = mapName(name), cur = places.get(key);
    if (!cur) places.set(key, { kind, labels: [label] });
    else if (cur.kind === kind) cur.labels.push(label);
  };
  if (data.home) add('home', data.home.name, `${data.home.flag} ${data.home.name} · home`);
  for (const c of data.lived || []) add('lived', c.name, `${c.flag} ${c.name} · lived ${c.years}`);
  for (const c of data.visited || []) add('visited', c.name, `${c.flag} ${c.name}${c.nights ? ` · ${c.nights} nights` : ''}`);
  const geoms = (topo.objects.countries || Object.values(topo.objects)[0]).geometries;

  // Places too small for this map get a dot instead of a shape.
  const SMALL = {
    Liechtenstein: [9.55, 47.16], Luxembourg: [6.13, 49.61], Monaco: [7.42, 43.74], Andorra: [1.52, 42.51], 'San Marino': [12.46, 43.94],
    'Vatican City': [12.45, 41.9], Malta: [14.45, 35.9], 'Hong Kong': [114.17, 22.32], Macao: [113.55, 22.17], Macau: [113.55, 22.17],
    Singapore: [103.82, 1.35], Bahrain: [50.56, 26.07], Maldives: [73.5, 4.2], Mauritius: [57.55, -20.3], Seychelles: [55.45, -4.62],
    Barbados: [-59.55, 13.17], 'Cape Verde': [-23.6, 15.1], Samoa: [-172.1, -13.76], Tonga: [-175.2, -21.18], 'Faroe Islands': [-6.9, 62.0],
  };

  const grat = [];
  for (let lon = -180; lon <= 180; lon += 30) { const pts = []; for (let lat = bottom; lat <= top; lat += 2) pts.push([lon, lat]); grat.push(linePath(pts)); }
  for (let lat = -30; lat <= 60; lat += 30) { const pts = []; for (let lon = -180; lon <= 180; lon += 2) pts.push([lon, lat]); grat.push(linePath(pts)); }
  const outline = [];
  for (let lat = bottom; lat <= top; lat += 1) outline.push([-180, lat]);
  for (let lat = top; lat >= bottom; lat -= 1) outline.push([180, lat]);

  const found = new Set();
  const countries = geoms.filter((g) => g.properties?.name !== 'Antarctica').map((g) => {
    const name = g.properties?.name || '';
    const pl = places.get(name);
    if (pl) found.add(name);
    const d = polygons(g).map((poly) => poly.map((r) => linePath(r, true)).join('')).join('');
    return `<path class="country${pl ? ` ${pl.kind}` : ''}" d="${d}" data-tip="${esc(pl ? pl.labels.join(' / ') : name)}"/>`;
  });
  const smallDots = [];
  const missing = [];
  for (const [name, pl] of places) {
    if (found.has(name)) continue;
    const ll = SMALL[name];
    if (!ll) { missing.push(name); continue; }
    const [x, y] = proj(ll[0], ll[1]);
    smallDots.push(`<circle class="small-place ${pl.kind}" cx="${f(x)}" cy="${f(y)}" r="3.2" data-tip="${esc(pl.labels.join(' / '))}"/>`);
  }
  if (missing.length) console.warn('Travel map: no shape found for', missing, '— add "mapNames" in data/travel.json to match the map’s names.');

  const ap = new Map(data.airports.map((a) => [a.code, a]));
  const routes = data.routes.map(({ a, b, count }) => {
    const A = ap.get(a), B = ap.get(b);
    if (!A || !B) return '';
    return `<path class="route" d="${linePath(greatCircle(A, B))}" style="stroke-width:${Math.min(1 + count * 0.35, 3)}" data-tip="${esc(`${a} ⇄ ${b}${count > 1 ? ` · ${count} flights` : ''}`)}"/>`;
  });
  const dots = data.airports.map((a) => {
    const [x, y] = proj(a.lon, a.lat);
    return `<circle class="airport" cx="${f(x)}" cy="${f(y)}" r="${Math.min(2.6 + a.uses * 0.25, 5)}" data-tip="${esc(`${a.code} · ${a.name}`)}"/>`;
  });

  el.innerHTML = `<svg viewBox="0 0 ${W} ${f(H)}" role="img" aria-label="World map">
    <path class="sphere" d="${outline.map(([lo, la], i) => { const [x, y] = proj(lo, la); return `${i ? 'L' : 'M'}${f(x)},${f(y)}`; }).join('')}Z"/>
    <path class="graticule" d="${grat.join('')}"/>
    <g>${countries.join('')}</g>
    <g>${smallDots.join('')}</g>
    <g>${routes.join('')}</g>
    <g>${dots.join('')}</g>
  </svg>`;

  // ---- Tooltip ----
  const svg = el.querySelector('svg');
  svg.addEventListener('mousemove', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t || !tip) { if (tip) tip.hidden = true; return; }
    const box = el.parentElement.getBoundingClientRect();
    tip.textContent = t.dataset.tip;
    tip.style.left = `${e.clientX - box.left}px`;
    tip.style.top = `${e.clientY - box.top}px`;
    tip.hidden = false;
  });
  svg.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
})();
