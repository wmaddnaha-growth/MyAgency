// Routes المرحلة 5: الكالندر، النتايج، المهام، إعدادات الشركة.
import { commitPaths } from '../lib/git.mjs';
import { httpErr } from '../lib/write.mjs';
import {
  readCompany, updateCompany, calendar, setPublishing, resultsSummary, productResults, addResults, parseMetaCsv,
  allTasks, readTasks, upsertTask, deleteTask, setOwner,
} from '../lib/company.mjs';

async function body(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 20 * 1024 * 1024) throw httpErr(413, 'الطلب كبير جدًا'); chunks.push(c); }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { throw httpErr(400, 'JSON غير صالح'); }
}

export async function handleCompany(req, res, url, p, json) {
  if (req.method === 'GET') {
    if (p === '/api/company') return json(res, 200, readCompany()), true;
    if (p === '/api/calendar') return json(res, 200, calendar()), true;
    if (p === '/api/results') return json(res, 200, resultsSummary({ from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined })), true;
    if (p === '/api/tasks') return json(res, 200, allTasks()), true;
    let m;
    if ((m = p.match(/^\/api\/products\/([^/]+)\/results$/))) return json(res, 200, productResults(m[1])), true;
    if ((m = p.match(/^\/api\/products\/([^/]+)\/tasks$/))) return json(res, 200, readTasks(m[1])), true;
    return false;
  }
  if (req.method !== 'POST') return false;
  if (req.headers['x-dashboard'] !== '1') throw httpErr(403, 'طلب غير مسموح');

  if (p === '/api/company') {
    const f = updateCompany(await body(req));
    return json(res, 200, { ok: true, commit: await commitPaths([f], 'dashboard: company settings') }), true;
  }
  const m = p.match(/^\/api\/products\/([^/]+)\/(publishing|results|results-import|tasks|tasks-delete|owner)$/);
  if (!m) return false;
  const [, slug, what] = m;
  const b = await body(req);
  let file, msg, extra = {};
  if (what === 'publishing') { file = setPublishing(slug, b); msg = `publishing ${slug} day ${b.day}${b.status ? ' → ' + b.status : ''}`; }
  if (what === 'results') { const r = addResults(slug, Array.isArray(b.rows) ? b.rows : [b]); file = r.path; extra = r; msg = `results ${slug} +${r.added}`; }
  if (what === 'results-import') {
    const parsed = parseMetaCsv(String(b.csv || ''), b.channel || 'meta');
    if (b.dry) return json(res, 200, parsed), true;
    const r = addResults(slug, parsed.rows); file = r.path; extra = { ...r, mapped: parsed.mapped }; msg = `results import ${slug} (${parsed.rows.length} days)`;
  }
  if (what === 'tasks') { file = upsertTask(slug, b); msg = `task ${slug}: ${b.title || b.id}`; }
  if (what === 'tasks-delete') { file = deleteTask(slug, b.id); msg = `task delete ${slug}`; }
  if (what === 'owner') { file = setOwner(slug, b.stage, b.member); msg = `owner ${slug}/${b.stage} → ${b.member || '-'}`; }
  return json(res, 200, { ok: true, ...extra, commit: await commitPaths([file], `dashboard: ${msg}`) }), true;
}
