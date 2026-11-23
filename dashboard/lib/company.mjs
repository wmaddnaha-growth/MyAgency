// المرحلة 5: إدارة الشركة — كالندر النشر الموحد، النتايج والمبيعات، مهام الفريق.
// كل البيانات ملفات عادية جوه البروجكت (ومتسجلة في git):
//   company.json                                  الفريق + العملة
//   campaigns/<slug>/product.json → launchDate, publishing{day: {status,date,url,note}}
//   campaigns/<slug>/09-results/results.csv        date,channel,spend,impressions,clicks,leads,orders,revenue,note
//   campaigns/<slug>/tasks.json                    {tasks: [...], owners: {stageId: member}}
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, loadConfig, discover, buildProduct, parseCsv, rel } from './core.mjs';
import { readProductJson, toCsv, httpErr } from './write.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const campDir = slug => {
  if (!slug || slug.includes('/') || slug.includes('..')) throw httpErr(400, 'slug غير صالح');
  const d = path.join(ROOT, loadConfig().paths.campaigns, slug);
  if (!fs.existsSync(d)) throw httpErr(404, 'منتج غير موجود');
  return d;
};
const writeJson = (abs, data) => { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n'); return rel(abs); };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- الشركة ----------
const COMPANY = path.join(ROOT, 'company.json');
export function readCompany() {
  try { return JSON.parse(fs.readFileSync(COMPANY, 'utf8')); } catch { return { currency: 'EGP', weekStart: 6, team: [] }; }
}
export function updateCompany(patch) {
  const c = readCompany();
  if (patch.team) {
    if (!Array.isArray(patch.team)) throw httpErr(400, 'team لازم تبقى قايمة');
    c.team = patch.team.map(m => ({ id: String(m.id || crypto.randomBytes(3).toString('hex')), name: String(m.name || '').trim(), role: String(m.role || '').trim() })).filter(m => m.name);
  }
  if (patch.currency) c.currency = String(patch.currency).slice(0, 8);
  return writeJson(COMPANY, c);
}

// ---------- كالندر النشر ----------
const PUB = ['planned', 'ready', 'scheduled', 'published', 'skipped'];
export function calendar() {
  const cfg = loadConfig();
  const out = [], noDate = [];
  for (const base of discover(cfg).products) {
    if (base.status === 'archived') continue;
    const p = buildProduct(base, cfg, { full: true });
    if (!p.calendar?.days.length) continue;
    if (!p.launchDate) { noDate.push({ slug: p.slug, name: p.name, days: p.calendar.days.length, color: p.brand?.hex || null }); continue; }
    for (const d of p.calendar.days) {
      const pub = p.publishing?.[d.day] || {};
      const ready = !!d.copy && (d.visuals.length > 0 || !/كاروسيل|صورة|carousel/i.test(d.row.format || ''));
      out.push({
        slug: p.slug, name: p.name, color: p.brand?.hex || null, day: d.day, week: d.week,
        date: isDate(pub.date) ? pub.date : addDays(p.launchDate, d.day - 1),
        type: d.row.type || '', hook: d.row.hook || '', format: d.row.format || '', cta: d.row.cta || '',
        status: pub.status || (ready ? 'ready' : 'planned'), manual: !!pub.status,
        url: pub.url || '', note: pub.note || '', hasCopy: !!d.copy, visuals: d.visuals.length, reels: d.reels.length,
      });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ar'));
  return { items: out, noDate, today: today() };
}

export function setPublishing(slug, { day, status, url, date, note }) {
  const dir = campDir(slug);
  const p = readProductJson(slug);
  const d = String(parseInt(day, 10));
  if (d === 'NaN') throw httpErr(400, 'رقم اليوم غلط');
  if (status && !PUB.includes(status)) throw httpErr(400, 'حالة نشر غير معروفة');
  if (date && !isDate(date)) throw httpErr(400, 'التاريخ لازم يكون YYYY-MM-DD');
  if (url && !/^https?:\/\//i.test(url)) throw httpErr(400, 'اللينك لازم يبدأ بـ http');
  p.publishing ||= {};
  const cur = { ...(p.publishing[d] || {}) };
  if (status !== undefined) { if (status) cur.status = status; else delete cur.status; }
  if (url !== undefined) { if (url) cur.url = url; else delete cur.url; }
  if (date !== undefined) { if (date) cur.date = date; else delete cur.date; }
  if (note !== undefined) { if (note) cur.note = note; else delete cur.note; }
  if (Object.keys(cur).length) { cur.updatedAt = today(); p.publishing[d] = cur; } else delete p.publishing[d];
  return writeJson(path.join(dir, loadConfig().paths.productFile), p);
}

// ---------- النتايج ----------
export const RESULT_COLS = ['date', 'channel', 'spend', 'impressions', 'clicks', 'leads', 'orders', 'revenue', 'note'];
const NUM = ['spend', 'impressions', 'clicks', 'leads', 'orders', 'revenue'];
const resultsPath = slug => path.join(campDir(slug), '09-results', 'results.csv');

export function readResults(slug) {
  const f = resultsPath(slug);
  if (!fs.existsSync(f)) return [];
  return parseCsv(fs.readFileSync(f, 'utf8')).rows.map(r => {
    const o = { ...r };
    for (const k of NUM) o[k] = Number(String(r[k] ?? '').replace(/[,\s]/g, '')) || 0;
    return o;
  }).filter(r => isDate(r.date));
}

function cleanRow(r) {
  if (!isDate(r.date)) throw httpErr(400, `تاريخ غلط: ${r.date}`);
  const o = { date: r.date, channel: String(r.channel || 'other').trim().slice(0, 40), note: String(r.note || '').slice(0, 300) };
  for (const k of NUM) { const n = Number(String(r[k] ?? 0).replace(/[,\s]/g, '')); if (!Number.isFinite(n) || n < 0) throw httpErr(400, `قيمة غلط في ${k}`); o[k] = n; }
  return o;
}

export function addResults(slug, rows, { replaceSameDayChannel = true } = {}) {
  const clean = rows.map(cleanRow);
  const existing = readResults(slug);
  const key = r => `${r.date}|${r.channel}`;
  const incoming = new Set(clean.map(key));
  const merged = [...(replaceSameDayChannel ? existing.filter(r => !incoming.has(key(r))) : existing), ...clean]
    .sort((a, b) => a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel));
  const f = resultsPath(slug);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, toCsv(RESULT_COLS, merged));
  return { path: rel(f), added: clean.length, replaced: existing.length + clean.length - merged.length };
}

// استيراد تقرير Meta Ads (CSV متصدّر من Ads Manager) — أسماء الأعمدة بتتعرف بالإنجليزي أو العربي
const META_MAP = [
  ['date', /^(day|date|reporting starts|التاريخ|اليوم|بدء التقارير)/i],
  ['spend', /(amount spent|spend|المبلغ الذي تم إنفاقه|المبلغ المنفق|الإنفاق)/i],
  ['impressions', /^(impressions|مرات الظهور)/i],
  ['clicks', /(link clicks|clicks \(all\)|^clicks|نقرات على الرابط|النقرات)/i],
  ['leads', /(^leads|leads \(form\)|عملاء محتملون|العملاء المحتملون)/i],
  ['orders', /(^purchases$|website purchases|^results$|عمليات الشراء|النتائج)/i],
  ['revenue', /(purchase conversion value|purchases conversion value|website purchase conversion value|قيمة تحويل عمليات الشراء)/i],
];
export function parseMetaCsv(text, channel = 'meta') {
  const { headers, rows } = parseCsv(text);
  const map = {};
  for (const [k, re] of META_MAP) { const h = headers.find(x => re.test(x.trim()) && !Object.values(map).includes(x)); if (h) map[k] = h; }
  if (!map.date) throw httpErr(422, 'مش لاقي عمود التاريخ في الملف — صدّر التقرير مقسم باليوم (Breakdown: Day).');
  if (!map.spend) throw httpErr(422, 'مش لاقي عمود الصرف (Amount spent).');
  const byDate = new Map();
  for (const r of rows) {
    let d = String(r[map.date] || '').trim();
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/) || d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) continue;
    d = m[0].includes('-') ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const acc = byDate.get(d) || { date: d, channel, spend: 0, impressions: 0, clicks: 0, leads: 0, orders: 0, revenue: 0, note: 'Meta import' };
    for (const k of NUM) if (map[k]) acc[k] += Number(String(r[map[k]] || '0').replace(/[,\s]/g, '')) || 0;
    byDate.set(d, acc);
  }
  const out = [...byDate.values()].map(r => { for (const k of NUM) r[k] = Math.round(r[k] * 100) / 100; return r; });
  if (!out.length) throw httpErr(422, 'مفيش صفوف بتاريخ صحيح في الملف');
  return { mapped: map, rows: out };
}

function sum(rows) {
  const t = { spend: 0, impressions: 0, clicks: 0, leads: 0, orders: 0, revenue: 0 };
  for (const r of rows) for (const k of NUM) t[k] += r[k];
  return { ...t, roas: t.spend ? t.revenue / t.spend : null, cpa: t.orders ? t.spend / t.orders : null, cpl: t.leads ? t.spend / t.leads : null, ctr: t.impressions ? t.clicks / t.impressions : null };
}

export function resultsSummary({ from, to } = {}) {
  const cfg = loadConfig();
  const inRange = r => (!from || r.date >= from) && (!to || r.date <= to);
  const products = [], series = new Map();
  for (const base of discover(cfg).products) {
    const rows = readResults(base.slug).filter(inRange);
    const p = buildProduct(base, cfg);
    products.push({ slug: p.slug, name: p.name, color: p.brand?.hex || null, status: p.status, rows: rows.length, totals: sum(rows), channels: [...new Set(rows.map(r => r.channel))] });
    for (const r of rows) {
      const s = series.get(r.date) || { date: r.date, spend: 0, revenue: 0, orders: 0, leads: 0 };
      s.spend += r.spend; s.revenue += r.revenue; s.orders += r.orders; s.leads += r.leads;
      series.set(r.date, s);
    }
  }
  const all = products.flatMap(p => readResults(p.slug).filter(inRange));
  return { currency: readCompany().currency, totals: sum(all), products, series: [...series.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function productResults(slug) {
  const rows = readResults(slug);
  return { currency: readCompany().currency, rows, totals: sum(rows), path: rel(resultsPath(slug)) };
}

// ---------- المهام ----------
const TASK_STATUS = ['todo', 'doing', 'done'];
const tasksPath = slug => path.join(campDir(slug), 'tasks.json');
export function readTasks(slug) {
  try { const t = JSON.parse(fs.readFileSync(tasksPath(slug), 'utf8')); return { tasks: t.tasks || [], owners: t.owners || {} }; } catch { return { tasks: [], owners: {} }; }
}
function writeTasks(slug, t) { return writeJson(tasksPath(slug), t); }

export function upsertTask(slug, task) {
  const t = readTasks(slug);
  const title = String(task.title || '').trim();
  if (!task.id && !title) throw httpErr(400, 'عنوان المهمة مطلوب');
  if (task.status && !TASK_STATUS.includes(task.status)) throw httpErr(400, 'حالة غير معروفة');
  if (task.due && !isDate(task.due)) throw httpErr(400, 'الميعاد لازم يكون YYYY-MM-DD');
  const fields = ['title', 'assignee', 'due', 'status', 'stage', 'file', 'note'];
  if (task.id) {
    const cur = t.tasks.find(x => x.id === task.id);
    if (!cur) throw httpErr(404, 'مهمة غير موجودة');
    for (const k of fields) if (k in task) cur[k] = task[k] ?? '';
    cur.updatedAt = today();
    if (task.status === 'done' && !cur.doneAt) cur.doneAt = today();
    if (task.status && task.status !== 'done') delete cur.doneAt;
  } else {
    const n = { id: crypto.randomBytes(4).toString('hex'), title, assignee: task.assignee || '', due: task.due || '', status: task.status || 'todo', stage: task.stage || '', file: task.file || '', note: task.note || '', createdAt: today() };
    t.tasks.push(n);
  }
  return writeTasks(slug, t);
}
export function deleteTask(slug, id) {
  const t = readTasks(slug);
  const before = t.tasks.length;
  t.tasks = t.tasks.filter(x => x.id !== id);
  if (t.tasks.length === before) throw httpErr(404, 'مهمة غير موجودة');
  return writeTasks(slug, t);
}
export function setOwner(slug, stage, member) {
  const t = readTasks(slug);
  if (member) t.owners[stage] = member; else delete t.owners[stage];
  return writeTasks(slug, t);
}
export function allTasks() {
  const cfg = loadConfig();
  const out = [];
  for (const base of discover(cfg).products) {
    const { tasks, owners } = readTasks(base.slug);
    const p = buildProduct(base, cfg);
    for (const t of tasks) out.push({ ...t, slug: p.slug, productName: p.name, color: p.brand?.hex || null, stageLabel: cfg.stages.find(s => s.id === t.stage)?.label || '' });
    for (const [stage, member] of Object.entries(owners)) {
      const st = p.stages.find(s => s.id === stage);
      if (st && !['done', 'approved', 'skipped'].includes(st.status)) out.push({ id: `owner:${p.slug}:${stage}`, kind: 'stage', title: `مسؤول عن «${st.label}»`, assignee: member, status: st.status === 'in-progress' ? 'doing' : 'todo', stage, slug: p.slug, productName: p.name, color: p.brand?.hex || null, stageLabel: st.label, stageStatus: st.status });
    }
  }
  return { team: readCompany().team, tasks: out, today: today() };
}
