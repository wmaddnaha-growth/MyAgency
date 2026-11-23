// Routes الكتابة (المرحلة 2). كل تعديل بيتسجل commit في git.
// الحماية: السيرفر على 127.0.0.1 بس، وأي POST لازم فيه هيدر X-Dashboard (المتصفح مش هيبعته من موقع تاني من غير CORS).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, parseCsv } from '../lib/core.mjs';
import { commitPaths, fileHistory, fileAt, gitStatus } from '../lib/git.mjs';
import {
  sha, resolveWritable, saveText, newTextFile, uploadStream, trash, setStageStatus, setReview, updateMeta, createProduct,
  syncCalendarMd, httpErr,
} from '../lib/write.mjs';

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(httpErr(413, 'الطلب كبير جدًا')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(httpErr(400, 'JSON غير صالح')); } });
    req.on('error', reject);
  });
}

function guard(req) {
  if (req.headers['x-dashboard'] !== '1') throw httpErr(403, 'طلب غير مسموح');
  const origin = req.headers.origin;
  if (origin) {
    const host = new URL(origin).host;
    if (host !== req.headers.host && !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw httpErr(403, 'origin غير مسموح');
  }
}

const short = p => p.split('/').slice(1).join('/');

// أي كتابة على calendar.csv بتتنقل لـ calendar.md (الخانات اللي اتغيرت بس)
function withCalendarSync(rel, write, newContent) {
  const abs = path.join(ROOT, rel);
  const isCalendar = /\/00-calendar\/calendar\.csv$/.test(rel);
  const oldCsv = isCalendar && fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  const result = write();
  const paths = [rel];
  let sync = null;
  if (oldCsv != null) {
    const mdAbs = path.join(path.dirname(abs), 'calendar.md');
    if (fs.existsSync(mdAbs)) {
      const s = syncCalendarMd(fs.readFileSync(mdAbs, 'utf8'), parseCsv(oldCsv).rows, parseCsv(newContent).rows);
      if (s.changed || s.removed || s.added.length) { fs.writeFileSync(mdAbs, s.md); paths.push(path.relative(ROOT, mdAbs).split(path.sep).join('/')); }
      sync = { changed: s.changed, removed: s.removed, added: s.added, unsynced: s.unsynced };
    }
  }
  return { result, paths, sync };
}

export async function handleWrite(req, res, url, p, json) {
  // ---------- قراءة لأغراض التعديل ----------
  if (req.method === 'GET') {
    if (p === '/api/text') {
      const { abs, rel } = resolveWritable(url.searchParams.get('path'));
      if (!fs.existsSync(abs)) throw httpErr(404, 'الملف مش موجود');
      const buf = fs.readFileSync(abs);
      json(res, 200, { path: rel, content: buf.toString('utf8'), hash: sha(buf), mtime: fs.statSync(abs).mtimeMs });
      return true;
    }
    if (p === '/api/history') {
      const { rel } = resolveWritable(url.searchParams.get('path'));
      json(res, 200, await fileHistory(rel));
      return true;
    }
    if (p === '/api/version') {
      const { rel } = resolveWritable(url.searchParams.get('path'));
      const buf = await fileAt(url.searchParams.get('hash') || '', rel);
      json(res, 200, { content: buf.toString('utf8') });
      return true;
    }
    if (p === '/api/git') { json(res, 200, await gitStatus()); return true; }
    return false;
  }

  if (req.method !== 'POST') return false;
  guard(req);

  // ---------- رفع (body = الملف نفسه) ----------
  if (p === '/api/upload') {
    const dir = url.searchParams.get('dir');
    const name = url.searchParams.get('name');
    const r = await uploadStream(req, dir, name, { overwrite: url.searchParams.get('overwrite') === '1' });
    const c = await commitPaths([r.path], `dashboard: upload ${short(r.path)}`);
    json(res, 200, { ...r, commit: c });
    return true;
  }

  const body = await readBody(req);

  if (p === '/api/save') {
    const { rel } = resolveWritable(body.path);
    const { result, paths, sync } = withCalendarSync(rel, () => saveText(rel, String(body.content ?? ''), body.baseHash, { force: !!body.force }), String(body.content ?? ''));
    const c = await commitPaths(paths, `dashboard: edit ${short(rel)}`);
    json(res, 200, { ...result, sync, commit: c });
    return true;
  }

  if (p === '/api/new-file') {
    const r = newTextFile(body.dir, body.name, body.content || '');
    const c = await commitPaths([r.path], `dashboard: new ${short(r.path)}`);
    json(res, 200, { ...r, commit: c });
    return true;
  }

  if (p === '/api/trash') {
    const r = trash(body.path);
    const c = await commitPaths([r.path], `dashboard: delete ${short(r.path)} (moved to .trash)`);
    json(res, 200, { ...r, commit: c });
    return true;
  }

  if (p === '/api/restore') {
    const { abs, rel } = resolveWritable(body.path);
    const buf = await fileAt(body.hash, rel);
    const { paths, sync } = withCalendarSync(rel, () => { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, buf); }, buf.toString('utf8'));
    const c = await commitPaths(paths, `dashboard: restore ${short(rel)} @ ${String(body.hash).slice(0, 7)}`);
    json(res, 200, { path: rel, sync, commit: c });
    return true;
  }

  if (p === '/api/products') {
    const r = createProduct(body);
    const c = await commitPaths([r.path], `dashboard: new product ${r.product.slug}`);
    json(res, 200, { ...r, commit: c });
    return true;
  }

  const m = p.match(/^\/api\/products\/([^/]+)\/(meta|stage|review)$/);
  if (m) {
    const slug = m[1];
    let file;
    if (m[2] === 'meta') file = updateMeta(slug, body);
    if (m[2] === 'stage') file = setStageStatus(slug, body.stage, body.status, body.note);
    if (m[2] === 'review') file = setReview(slug, body.path, body.status, body.note);
    const c = await commitPaths([file], `dashboard: ${m[2]} ${slug}${body.stage ? ' / ' + body.stage : ''}${body.status ? ' → ' + body.status : ''}`);
    json(res, 200, { ok: true, commit: c });
    return true;
  }
  return false;
}

export { loadConfig };
