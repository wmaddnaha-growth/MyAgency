// قلب الداشبورد: بيقرا البروجكت من الملفات مباشرة (مفيش database).
// كل حاجة هنا generic — مفيش أي اسم كتاب متكتب في الكود.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline.config.json'), 'utf8'));
}

// ---------- أسماء ----------
// تطبيع الاسم للمقارنة بين فولدر Books/ وفولدر campaigns/ (أرقام البداية، الهمزات، المسافات...)
export function normalizeName(s) {
  return String(s)
    .normalize('NFC')
    .replace(/^\s*\d+\s*[-–_.)]\s*/, '')
    .replace(/[ً-ٰٟ]/g, '') // تشكيل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

export function slugify(name) {
  return String(name)
    .normalize('NFC')
    .replace(/^\s*\d+\s*[-–_.)]\s*/, '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------- ملفات ----------
const IGNORE = new Set(['.git', 'node_modules', '.DS_Store']);

export function walk(absDir, base = absDir) {
  const out = [];
  if (!fs.existsSync(absDir)) return out;
  for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (IGNORE.has(ent.name) || /\.(tmp|part)-\d+$/.test(ent.name)) continue;
    const abs = path.join(absDir, ent.name);
    if (ent.isDirectory()) out.push(...walk(abs, base));
    else if (ent.isFile()) {
      const st = fs.statSync(abs);
      out.push({
        path: rel(abs),
        name: ent.name,
        inner: path.relative(base, abs),
        ext: path.extname(ent.name).slice(1).toLowerCase(),
        kind: fileKind(ent.name),
        size: st.size,
        mtime: st.mtimeMs,
      });
    }
  }
  return out;
}

export function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

export function fileKind(name) {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (['md', 'markdown', 'txt'].includes(ext)) return 'text';
  if (ext === 'csv') return 'table';
  if (ext === 'json') return 'json';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['html', 'htm'].includes(ext)) return 'html';
  return 'other';
}

function readIf(abs) {
  try { return fs.readFileSync(abs, 'utf8'); } catch { return null; }
}

function listDirs(abs) {
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).filter(d => d.isDirectory() && !IGNORE.has(d.name)).map(d => d.name);
}

// ---------- CSV ----------
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.trim());
  return { headers, rows: rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

// ---------- brand.md ----------
export function parseBrand(text, config) {
  if (!text) return null;
  const tokens = readTokens();
  const m = text.match(/color\.product\.([a-z0-9-]+)/i);
  const hex = text.match(/#[0-9a-f]{6}\b/i);
  const token = m ? m[1] : null;
  return {
    token,
    hex: hex ? hex[0] : (token && tokens?.color?.product?.[token]) || null,
  };
}

let _tokens;
export function readTokens() {
  if (_tokens !== undefined) return _tokens;
  const t = readIf(path.join(ROOT, 'Brand Identity', '03-foundations', 'tokens.json'));
  _tokens = t ? JSON.parse(t) : null;
  return _tokens;
}

// ---------- اكتشاف المنتجات ----------
// مصدر الحقيقة: campaigns/<slug>/product.json. لو مش موجود بنستنتج من أسماء الفولدرات.
export function discover(config = loadConfig()) {
  const srcRoot = path.join(ROOT, config.paths.sources);
  const campRoot = path.join(ROOT, config.paths.campaigns);
  const sources = listDirs(srcRoot);
  const campaigns = listDirs(campRoot);
  const usedSources = new Set();
  const products = [];

  for (const slug of campaigns) {
    const pf = path.join(campRoot, slug, config.paths.productFile);
    let meta = null, registered = false;
    const raw = readIf(pf);
    if (raw) {
      try { meta = JSON.parse(raw); registered = true; } catch (e) { meta = { _error: 'product.json مش JSON سليم: ' + e.message }; }
    }
    meta = meta || {};
    let source = meta.source ?? null;
    if (!source) {
      const hit = sources.find(s => normalizeName(s) === normalizeName(slug));
      if (hit) source = `${config.paths.sources}/${hit}`;
    }
    if (source) usedSources.add(path.basename(source));
    products.push({
      slug,
      name: meta.name || slug.replace(/-/g, ' '),
      type: meta.type || Object.keys(config.productTypes)[0],
      status: meta.status || 'active',
      series: meta.series || null,
      source,
      mainFile: meta.mainFile ?? null,
      created: meta.created || null,
      notes: meta.notes || '',
      stagesState: meta.stages || {},
      reviews: meta.reviews || {},
      registered,
      metaError: meta._error || null,
    });
  }

  const unregisteredSources = sources
    .filter(s => !usedSources.has(s))
    .map(s => ({ folder: `${config.paths.sources}/${s}`, suggestedName: slugify(s).replace(/-/g, ' '), suggestedSlug: slugify(s) }));

  return { products, unregisteredSources };
}

// ---------- حساب حالة كل مرحلة ----------
function dayFromName(name) {
  const m = name.match(/day-(\d+)(?=\D|$)/i);
  return m ? Number(m[1]) : null;
}

function weekFromPath(p) {
  const m = p.match(/week-(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function buildProduct(p, config = loadConfig(), { full = false } = {}) {
  const campDir = path.join(ROOT, config.paths.campaigns, p.slug);
  const files = walk(campDir);
  const type = config.productTypes[p.type] || Object.values(config.productTypes)[0];
  const stageDefs = type.stages.map(id => config.stages.find(s => s.id === id)).filter(Boolean);
  const exists = r => fs.existsSync(path.join(campDir, r));
  const brand = parseBrand(readIf(path.join(campDir, 'brand.md')), config);

  // الكالندر
  let calendar = null;
  const csvText = readIf(path.join(campDir, '00-calendar', 'calendar.csv'));
  if (csvText) calendar = parseCsv(csvText);
  const dayRows = calendar ? calendar.rows.map(r => ({ ...r, _day: Number(r.day ?? r['يوم']), _week: Number(r.week ?? r['أسبوع']) })) : [];

  // ربط الأيام بالملفات
  const copyFiles = files.filter(f => f.inner.startsWith('01-copy/') && f.kind === 'text');
  const visualFiles = files.filter(f => f.inner.startsWith('02-visuals/'));
  const reelFiles = files.filter(f => f.inner.startsWith('03-reels/'));
  const visualFolders = {};
  for (const f of visualFiles) {
    const parts = f.inner.split('/');
    const folder = parts.slice(0, -1).find(x => dayFromName(x) !== null);
    const d = folder ? dayFromName(folder) : dayFromName(f.name);
    if (d === null) continue;
    (visualFolders[d] ||= []).push(f);
  }
  const reelsByDay = {};
  for (const f of reelFiles) {
    const d = f.inner.split('/').map(dayFromName).find(x => x !== null);
    if (d != null) (reelsByDay[d] ||= []).push(f);
  }
  const days = dayRows.map(r => ({
    week: r._week || null,
    day: r._day,
    row: r,
    copy: copyFiles.find(f => dayFromName(f.name) === r._day && (!r._week || !weekFromPath(f.inner) || weekFromPath(f.inner) === r._week))?.path || null,
    visuals: (visualFolders[r._day] || []).map(f => f.path),
    reels: (reelsByDay[r._day] || []).map(f => f.path),
  }));

  // المراحل
  const stages = [];
  for (const s of stageDefs) {
    const dirFiles = s.dir ? files.filter(f => f.inner.startsWith(s.dir + '/')) : files.filter(f => s.outputs?.includes(f.inner));
    let auto = 'missing', progress = null, detail = '';
    if (s.kind === 'single') {
      const have = (s.outputs || []).filter(exists);
      if (have.length === (s.outputs || []).length && have.length) auto = 'done';
      else if (have.length || dirFiles.length) { auto = 'partial'; detail = `الناتج القياسي ناقص: ${(s.outputs || []).filter(o => !exists(o)).join('، ')}`; }
    } else if (s.kind === 'perDay') {
      const total = days.length;
      const done = days.filter(d => (s.match === 'folder' ? d.visuals.length : d.copy)).length;
      progress = { done, total };
      if (total && done === total) auto = 'done';
      else if (done || dirFiles.length) auto = 'partial';
      detail = total ? `${done} من ${total} يوم` : (dirFiles.length ? 'في ملفات بس مفيش خطة محتوى تتربط بيها' : '');
    } else if (s.kind === 'collection') {
      const items = new Set(dirFiles.map(f => f.inner.split('/')[1]).filter(Boolean));
      const media = dirFiles.filter(f => ['video', 'image', 'audio'].includes(f.kind)).length;
      progress = { done: items.size, total: null };
      if (media) auto = 'done';
      else if (dirFiles.length) auto = 'partial';
      detail = items.size ? `${items.size} عنصر، ${media} ملف ميديا` : '';
    }
    stages.push({ ...s, auto, progress, detail, fileCount: dirFiles.length, files: full ? dirFiles : undefined, manual: p.stagesState?.[s.id] || null });
  }
  // blocked = لسه ومرحلة قبله مش جاهزة
  const ready = id => { const st = stages.find(x => x.id === id); return !st || st.auto === 'done' || ['approved', 'skipped'].includes(st.manual?.status); };
  for (const st of stages) {
    st.blockedBy = st.dependsOn.filter(d => !ready(d));
    if (st.auto === 'missing' && st.blockedBy.length) st.auto = 'blocked';
    st.status = st.manual?.status || st.auto;
  }
  const doneCount = stages.filter(s => ['done', 'approved', 'skipped'].includes(s.status)).length;
  const next = stages.find(s => !['done', 'approved', 'skipped'].includes(s.status) && !s.blockedBy.length && !s.gate)
    || stages.find(s => !['done', 'approved', 'skipped'].includes(s.status) && !s.blockedBy.length);

  // المصدر
  const sourceFiles = p.source ? walk(path.join(ROOT, p.source)) : [];
  const warnings = [];
  if (!p.registered) warnings.push('المنتج معندوش product.json — بيانات مستنتجة من اسم الفولدر.');
  if (p.metaError) warnings.push(p.metaError);
  if (!p.source) warnings.push('مفيش فولدر مصدر مربوط في Books/.');
  else if (!sourceFiles.length) warnings.push('فولدر المصدر فاضي.');
  if (p.registered && !p.mainFile) warnings.push('ملف الكتاب الأساسي مش محدد/مش موجود في المصدر.');
  else if (p.mainFile && !fs.existsSync(path.join(ROOT, p.mainFile))) warnings.push(`ملف الكتاب الأساسي مش موجود: ${p.mainFile}`);
  if (!brand) warnings.push('مفيش brand.md — لازم book-brand-assigner الأول.');

  const lastUpdate = Math.max(0, ...files.map(f => f.mtime));
  const counts = {};
  for (const f of files) counts[f.kind] = (counts[f.kind] || 0) + 1;

  const base = {
    ...p, typeLabel: type.label, brand, stages, doneCount, totalStages: stages.length,
    next: next ? { id: next.id, label: next.label, skill: next.skill } : null,
    warnings, lastUpdate, counts, fileCount: files.length, sourceCount: sourceFiles.length,
    calendarDays: days.length,
  };
  if (!full) { base.stages = stages.map(({ files, ...s }) => s); return base; }
  const known = new Set(stages.flatMap(s => (s.files || []).map(f => f.path)));
  return {
    ...base,
    files,
    otherFiles: files.filter(f => !known.has(f.path)),
    sourceFiles,
    calendar: calendar ? { headers: calendar.headers, days } : null,
  };
}

export function allProducts(config = loadConfig()) {
  const { products, unregisteredSources } = discover(config);
  return { products: products.map(p => buildProduct(p, config)), unregisteredSources };
}

export function getProduct(slug, config = loadConfig()) {
  const { products } = discover(config);
  const p = products.find(x => x.slug === slug);
  return p ? buildProduct(p, config, { full: true }) : null;
}

// ---------- بحث ----------
export function search(q, config = loadConfig(), limit = 60) {
  q = String(q || '').trim();
  if (q.length < 2) return [];
  const nq = q.toLowerCase();
  const out = [];
  const roots = [config.paths.campaigns, config.paths.sources];
  for (const r of roots) {
    for (const f of walk(path.join(ROOT, r))) {
      const nameHit = f.path.toLowerCase().includes(nq);
      let snippet = null;
      if (['text', 'table', 'json'].includes(f.kind) && f.size < 2_000_000) {
        const t = readIf(path.join(ROOT, f.path)) || '';
        const i = t.toLowerCase().indexOf(nq);
        if (i >= 0) snippet = t.slice(Math.max(0, i - 60), i + q.length + 80).replace(/\s+/g, ' ');
      }
      if (nameHit || snippet) {
        const slug = f.path.split('/')[1];
        out.push({ path: f.path, kind: f.kind, root: r, slug, snippet });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

// الأيام اللي لسه ناقصها شغل في مرحلة بتشتغل بالأيام (نفس منطق الواجهة)
export const REEL_FORMAT = /ريل|reel|فيديو/i;
export function missingDays(full, stageId) {
  const days = full.calendar?.days || [];
  if (stageId === 'copy') return days.filter(d => !d.copy).map(d => d.day);
  if (stageId === 'visuals') return days.filter(d => d.copy && !d.visuals.length).map(d => d.day);
  if (stageId === 'reels') return days.filter(d => REEL_FORMAT.test(d.row.format || '') && d.copy && !d.reels.length).map(d => d.day);
  return [];
}
