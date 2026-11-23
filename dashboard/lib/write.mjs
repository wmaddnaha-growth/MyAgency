// كل عمليات الكتابة على الديسك (حفظ، رفع، حذف لسلة المحذوفات، حالة المراحل، المراجعات، بيانات المنتج).
// الكتابة مسموحة بس جوه campaigns/ و Books/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, loadConfig, slugify, walk, rel } from './core.mjs';

const today = () => new Date().toISOString().slice(0, 10);
export const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

export function writableRoots(config = loadConfig()) {
  return [config.paths.campaigns, config.paths.sources];
}

export function resolveWritable(relPath, config = loadConfig()) {
  if (!relPath || typeof relPath !== 'string' || /[\0\r\n]/.test(relPath)) throw httpErr(400, 'مسار غير صالح');
  const abs = path.resolve(ROOT, relPath);
  const r = path.relative(ROOT, abs).split(path.sep).join('/');
  if (r.startsWith('..') || path.isAbsolute(r)) throw httpErr(403, 'مسار برا البروجكت');
  if (r.split('/').some(s => s === '.git' || s === 'node_modules')) throw httpErr(403, 'مسار غير مسموح');
  if (!writableRoots(config).some(root => r.startsWith(root + '/'))) throw httpErr(403, 'الكتابة مسموحة بس جوه campaigns/ و Books/');
  return { abs, rel: r };
}

export function httpErr(status, message, extra) { const e = new Error(message); e.status = status; Object.assign(e, extra); return e; }

export function safeName(name) {
  const n = path.basename(String(name || '')).replace(/[\\/:*?"<>|\0]/g, '').replace(/^\.+/, '').trim();
  if (!n) throw httpErr(400, 'اسم ملف غير صالح');
  return n;
}

function uniquePath(abs) {
  if (!fs.existsSync(abs)) return abs;
  const { dir, name, ext } = path.parse(abs);
  for (let i = 1; ; i++) { const c = path.join(dir, `${name}-${i}${ext}`); if (!fs.existsSync(c)) return c; }
}

// ---------- حفظ ملف نصي (مع كشف التعارض) ----------
export function saveText(relPath, content, baseHash, { force = false } = {}) {
  const { abs, rel: r } = resolveWritable(relPath);
  if (r.endsWith('.json')) { try { JSON.parse(content); } catch (e) { throw httpErr(422, 'JSON مش سليم: ' + e.message); } }
  if (fs.existsSync(abs) && !force) {
    const cur = sha(fs.readFileSync(abs));
    if (baseHash && cur !== baseHash) throw httpErr(409, 'الملف اتغير على الديسك بعد ما فتحته', { current: fs.readFileSync(abs, 'utf8') });
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = abs + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, abs);
  return { path: r, hash: sha(Buffer.from(content)) };
}

export function newTextFile(dirRel, name, content = '') {
  let n = safeName(name);
  if (!path.extname(n)) n += '.md';
  const { abs: dirAbs } = resolveWritable(dirRel + '/x');
  const target = path.join(path.dirname(dirAbs), n);
  resolveWritable(rel(target));
  if (fs.existsSync(target)) throw httpErr(409, 'فيه ملف بنفس الاسم');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return { path: rel(target) };
}

// ---------- رفع ملف (stream) ----------
const MAX_UPLOAD = 2 * 1024 ** 3;
export function uploadStream(req, dirRel, name, { overwrite = false } = {}) {
  const n = safeName(name);
  const probe = resolveWritable(`${dirRel}/${n}`);
  let target = overwrite ? probe.abs : uniquePath(probe.abs);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.part-' + Date.now();
  return new Promise((resolve, reject) => {
    let size = 0;
    const out = fs.createWriteStream(tmp);
    req.on('data', c => { size += c.length; if (size > MAX_UPLOAD) { req.destroy(); out.destroy(); fs.rmSync(tmp, { force: true }); reject(httpErr(413, 'الملف أكبر من 2GB')); } });
    req.pipe(out);
    out.on('finish', () => { fs.renameSync(tmp, target); resolve({ path: rel(target), size }); });
    out.on('error', e => { fs.rmSync(tmp, { force: true }); reject(e); });
    req.on('aborted', () => { fs.rmSync(tmp, { force: true }); reject(httpErr(400, 'الرفع اتقطع')); });
  });
}

// ---------- حذف = نقل لـ .trash/ (مش حذف نهائي) ----------
export function trash(relPath) {
  const { abs, rel: r } = resolveWritable(relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw httpErr(404, 'الملف مش موجود');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(ROOT, '.trash', stamp, r);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(abs, dest);
  return { path: r, trashedTo: rel(dest) };
}

// ---------- product.json ----------
function productPath(slug, config = loadConfig()) {
  if (!slug || slug.includes('/') || slug.includes('..')) throw httpErr(400, 'slug غير صالح');
  return path.join(ROOT, config.paths.campaigns, slug, config.paths.productFile);
}

export function readProductJson(slug) {
  const pf = productPath(slug);
  if (fs.existsSync(pf)) return JSON.parse(fs.readFileSync(pf, 'utf8'));
  if (!fs.existsSync(path.dirname(pf))) throw httpErr(404, 'منتج غير موجود');
  return { slug, name: slug.replace(/-/g, ' '), type: 'ebook', status: 'active', series: null, source: null, mainFile: null, created: today(), notes: '', stages: {} };
}

function writeProductJson(slug, data) {
  const pf = productPath(slug);
  fs.writeFileSync(pf, JSON.stringify(data, null, 2) + '\n');
  return rel(pf);
}

const MANUAL = ['in-progress', 'review', 'approved', 'needs-fix', 'rejected', 'skipped'];
export function setStageStatus(slug, stageId, status, note) {
  const config = loadConfig();
  if (!config.stages.some(s => s.id === stageId)) throw httpErr(400, 'مرحلة غير معروفة');
  const p = readProductJson(slug);
  p.stages ||= {};
  if (!status || status === 'auto') delete p.stages[stageId];
  else {
    if (!MANUAL.includes(status)) throw httpErr(400, 'حالة غير معروفة');
    p.stages[stageId] = { status, note: note || '', updatedAt: today(), by: 'dashboard' };
  }
  return writeProductJson(slug, p);
}

const REVIEW = ['approved', 'needs-fix', 'rejected'];
export function setReview(slug, filePath, status, note) {
  const p = readProductJson(slug);
  p.reviews ||= {};
  if (!status) delete p.reviews[filePath];
  else {
    if (!REVIEW.includes(status)) throw httpErr(400, 'حالة مراجعة غير معروفة');
    p.reviews[filePath] = { status, note: note || '', updatedAt: today() };
  }
  if (!Object.keys(p.reviews).length) delete p.reviews;
  return writeProductJson(slug, p);
}

const META = ['name', 'status', 'series', 'mainFile', 'notes', 'type', 'source'];
export function updateMeta(slug, patch) {
  const config = loadConfig();
  const p = readProductJson(slug);
  for (const k of META) if (k in patch) p[k] = patch[k] === '' ? null : patch[k];
  if (!p.name) throw httpErr(400, 'الاسم مطلوب');
  if (p.notes == null) p.notes = '';
  if (p.type && !config.productTypes[p.type]) throw httpErr(400, 'نوع غير معروف');
  if (p.status && !config.productStatuses[p.status]) throw httpErr(400, 'حالة منتج غير معروفة');
  if (p.source) resolveWritable(p.source + '/x');
  if (p.mainFile && !fs.existsSync(path.join(ROOT, p.mainFile))) throw httpErr(400, 'الملف الأساسي مش موجود');
  return writeProductJson(slug, p);
}

// ---------- منتج جديد (نفس اللي بيستخدمه السكريبت) ----------
export function guessMainFile(sourceRel) {
  const files = walk(path.join(ROOT, sourceRel)).filter(f => ['pdf', 'md', 'docx', 'epub'].includes(f.ext));
  const score = f => {
    let s = 0;
    if (/الكتاب الكامل|كتاب|الدليل|book/i.test(f.name)) s += 10;
    if (/هدية|بونص|bonus|B\d+\s*–/i.test(f.inner)) s -= 20;
    if (f.inner.includes('/')) s -= 3;
    if (f.ext === 'pdf') s += 2;
    return s;
  };
  const best = files.map(f => [score(f), f]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0] || b[1].size - a[1].size)[0];
  return best ? best[1].path : null;
}

export function createProduct({ name, slug, source, type = 'ebook', series = null, status = 'active' }, { dry = false } = {}) {
  const config = loadConfig();
  name = String(name || '').trim();
  if (!name) throw httpErr(400, 'الاسم مطلوب');
  slug = slug || slugify(name);
  if (!config.productTypes[type]) throw httpErr(400, `نوع غير معروف "${type}"`);
  if (!config.productStatuses[status]) throw httpErr(400, `حالة غير معروفة "${status}"`);
  source = source || `${config.paths.sources}/${name}`;
  resolveWritable(source + '/x');
  const campDir = path.join(ROOT, config.paths.campaigns, slug);
  const pf = path.join(campDir, config.paths.productFile);
  if (fs.existsSync(pf)) throw httpErr(409, `المنتج موجود بالفعل: ${rel(pf)}`);
  const product = { slug, name, type, status, series: series || null, source, mainFile: fs.existsSync(path.join(ROOT, source)) ? guessMainFile(source) : null, created: today(), notes: '', stages: {} };
  if (!dry) {
    fs.mkdirSync(campDir, { recursive: true });
    fs.mkdirSync(path.join(ROOT, source), { recursive: true });
    fs.writeFileSync(pf, JSON.stringify(product, null, 2) + '\n');
  }
  return { product, path: rel(pf) };
}

// ---------- CSV + مزامنة calendar.md ----------
export function toCsv(headers, rows) {
  const esc = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return [headers.map(esc).join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n') + '\n';
}

const MD_COLS = [
  [/^يوم$|^اليوم$/, 'day'], [/النوع/, 'type'], [/الهدف/, 'goal'], [/hook|هوك/i, 'hook'], [/الصيغة|الشكل/, 'format'], [/cta/i, 'cta'],
];
const splitRow = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
const unq = s => s.replace(/^["«“]+|["»”]+$/g, '').trim();
const norm = s => unq(s).replace(/[.\s،]+/g, ' ').trim();

// بيحدّث calendar.md بالتعديلات اللي المستخدم عملها بس (الفرق بين الـCSV القديم والجديد)،
// عشان النص الأصلي في الـMD (علامات الترقيم والتنصيص) ميتغيرش في الخانات اللي ملمستهاش.
export function syncCalendarMd(md, oldRows, newRows) {
  const key = r => String(r.day ?? '').trim();
  const oldBy = new Map(oldRows.map(r => [key(r), r]));
  const newBy = new Map(newRows.map(r => [key(r), r]));
  const edits = new Map(); // day -> {field: value}
  for (const [d, r] of newBy) {
    const o = oldBy.get(d); if (!o) continue;
    const ch = {}; for (const k of Object.keys(r)) if ((o[k] ?? '') !== (r[k] ?? '')) ch[k] = r[k];
    if (Object.keys(ch).length) edits.set(d, ch);
  }
  const deleted = new Set([...oldBy.keys()].filter(d => !newBy.has(d)));
  const added = newRows.filter(r => !oldBy.has(key(r)));

  const lines = md.split('\n');
  const out = [];
  const seen = new Set();
  let cols = null, week = null, changed = 0, removed = 0;
  const tableEnd = {}; // week -> {idx, cols}
  const isSep = l => /^\s*\|?\s*:?-{2,}/.test(l || '');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const wk = l.match(/^#{1,6}.*الأسبوع\s*(\d+)/);
    if (wk) { week = wk[1]; cols = null; }
    if (/^\s*\|/.test(l)) {
      const cells = splitRow(l);
      if (!cols && isSep(lines[i + 1])) {
        const map = cells.map(c => MD_COLS.find(([re]) => re.test(c))?.[1] || null);
        cols = map.includes('day') ? map : null;
        out.push(l); continue;
      }
      if (cols && isSep(l)) { out.push(l); tableEnd[week] = { idx: out.length - 1, cols }; continue; }
      if (cols) {
        const day = cells[cols.indexOf('day')];
        seen.add(day);
        if (deleted.has(day)) { removed++; continue; }
        const ch = edits.get(day);
        if (ch) {
          const next = cells.map((c, j) => {
            const k = cols[j];
            if (!k || !(k in ch)) return c;
            changed++;
            return /^["«“]/.test(c) ? `"${ch[k]}"` : ch[k];
          });
          out.push('| ' + next.join(' | ') + ' |');
        } else out.push(l);
        tableEnd[week] = { idx: out.length - 1, cols };
        continue;
      }
    } else if (cols && l.trim() === '') cols = null;
    out.push(l);
  }
  const unsynced = [...edits.keys()].filter(d => !seen.has(d));
  const addedOk = [];
  for (const r of added) {
    const t = tableEnd[String(r.week ?? '').trim()];
    if (!t) { unsynced.push(key(r)); continue; }
    const row = '| ' + t.cols.map(k => !k ? '' : k === 'hook' || k === 'cta' ? `"${r[k] ?? ''}"` : (r[k] ?? '')).join(' | ') + ' |';
    out.splice(t.idx + 1, 0, row);
    for (const w of Object.keys(tableEnd)) if (tableEnd[w].idx > t.idx) tableEnd[w].idx++;
    t.idx++;
    addedOk.push(key(r));
  }
  return { md: out.join('\n'), changed, removed, added: addedOk, unsynced };
}
