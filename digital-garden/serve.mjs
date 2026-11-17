// Local preview: builds the site, serves dist/ at http://localhost:4321 and rebuilds when you save.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = process.env.PORT || 4321;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

let building = null, again = false;
function build() {
  if (building) { again = true; return; }
  building = spawn(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit' });
  building.on('exit', () => { building = null; if (again) { again = false; build(); } });
}
build();

for (const dir of ['content', 'data', 'static', 'site.config.json', 'build.mjs', 'i18n.mjs']) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) fs.watch(full, { recursive: true }, () => build());
}

http.createServer((req, res) => {
  let file = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': TYPES['.html'] }); fs.createReadStream(path.join(DIST, '404.html')).pipe(res); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`\n  🌱 Garden running at http://localhost:${PORT}\n`));
