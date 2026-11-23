// سيرفر الداشبورد — Node بدون مكتبات خارجية.
// بيقرا الملفات مباشرة، بيخدم الميديا (مع Range للفيديو)، وبيبعت تحديث لايف (SSE) لما أي ملف يتغير.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, allProducts, getProduct, search } from '../lib/core.mjs';

const PORT = Number(process.env.PORT || 5178);
const DIST = path.join(ROOT, 'dashboard', 'web', 'dist');
// الفولدرات المسموح بعرض ملفاتها فقط
const ALLOWED = ['campaigns', 'Books', 'Brand Identity', 'whiteboard-video/out', 'whiteboard-video/public'];

const MIME = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm',
  mov: 'video/quicktime', m4v: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
  woff2: 'font/woff2', ico: 'image/x-icon',
};

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': MIME.json, 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function safeProjectPath(relPath) {
  if (!relPath) return null;
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(ROOT + path.sep)) return null;
  const r = path.relative(ROOT, abs).split(path.sep).join('/');
  return ALLOWED.some(a => r === a || r.startsWith(a + '/')) ? abs : null;
}

function sendFile(req, res, abs, { download = false } = {}) {
  let st;
  try { st = fs.statSync(abs); } catch { return json(res, 404, { error: 'not found' }); }
  if (!st.isFile()) return json(res, 404, { error: 'not a file' });
  const ext = path.extname(abs).slice(1).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Last-Modified': st.mtime.toUTCString(),
  };
  if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`;
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
    if (!range[1]) end = st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(abs, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(abs).pipe(res);
}

// ---------- لايف ريفريش ----------
const clients = new Set();
let pending = new Set(), timer = null;
function broadcast(changed) {
  const msg = `event: change\ndata: ${JSON.stringify({ paths: [...changed].slice(0, 50) })}\n\n`;
  for (const c of clients) c.write(msg);
}
function watch(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  try {
    fs.watch(abs, { recursive: true }, (_e, f) => {
      pending.add(`${dir}/${String(f || '').split(path.sep).join('/')}`);
      clearTimeout(timer);
      timer = setTimeout(() => { const p = pending; pending = new Set(); broadcast(p); }, 400);
    });
  } catch (e) { console.warn('watch failed for', dir, e.message); }
}
const cfg0 = loadConfig();
[cfg0.paths.campaigns, cfg0.paths.sources].forEach(watch);
fs.watch(path.join(ROOT, 'pipeline.config.json'), () => broadcast(new Set(['pipeline.config.json'])));
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25000);

// ---------- Routes ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/config') return json(res, 200, loadConfig());
    if (p === '/api/products') {
      const config = loadConfig();
      const data = allProducts(config);
      return json(res, 200, { ...data, generatedAt: Date.now() });
    }
    if (p.startsWith('/api/products/')) {
      const slug = p.slice('/api/products/'.length);
      const prod = getProduct(slug);
      return prod ? json(res, 200, prod) : json(res, 404, { error: 'منتج غير موجود' });
    }
    if (p === '/api/search') {
      const config = loadConfig();
      const { products } = allProducts(config);
      const bySource = Object.fromEntries(products.filter(x => x.source).map(x => [x.source, x.slug]));
      const hits = search(url.searchParams.get('q'), config).map(h => {
        if (h.root === config.paths.sources) {
          const src = h.path.split('/').slice(0, 2).join('/');
          return { ...h, slug: bySource[src] || null };
        }
        return h;
      });
      return json(res, 200, hits);
    }
    if (p === '/api/file') {
      const abs = safeProjectPath(url.searchParams.get('path'));
      if (!abs) return json(res, 403, { error: 'مسار غير مسموح' });
      return sendFile(req, res, abs, { download: url.searchParams.has('download') });
    }
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'unknown api' });

    // الواجهة (build)
    if (!fs.existsSync(DIST)) {
      res.writeHead(200, { 'Content-Type': MIME.html });
      return res.end('<meta charset="utf-8"><p dir="rtl">الواجهة لسه مش معمول لها build — شغّل <code>npm run build</code> جوه dashboard/ أو استخدم <code>npm run dev</code>.</p>');
    }
    let file = path.join(DIST, p);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    return sendFile(req, res, file);
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Dashboard → http://localhost:${PORT}`));
