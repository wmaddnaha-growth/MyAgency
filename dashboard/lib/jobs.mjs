// تشغيل الـ Skills من الداشبورد: طابور مهام بيشغّل `claude -p` (headless) في روت البروجكت.
// كل مهمة ليها: .jobs/<id>.json (البيانات) + .jobs/<id>.jsonl (السجل الحي).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { ROOT, loadConfig, discover, buildProduct, walk, missingDays } from './core.mjs';
import { commitPaths } from './git.mjs';
import { setStageStatus, readProductJson, httpErr } from './write.mjs';

const DIR = path.join(ROOT, '.jobs');
fs.mkdirSync(DIR, { recursive: true });
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

const jobs = new Map(); // id -> job
const procs = new Map(); // id -> child
let onEvent = () => {};
const finishListeners = new Set();
export function onJobFinished(fn) { finishListeners.add(fn); }
export function setJobListener(fn) { onEvent = fn; }

// ---------- تخزين ----------
const metaPath = id => path.join(DIR, `${id}.json`);
const logPath = id => path.join(DIR, `${id}.jsonl`);
function save(job) { fs.writeFileSync(metaPath(job.id), JSON.stringify(job, null, 2)); onEvent({ type: 'job', job: publicJob(job) }); }
function publicJob(j) { const { prompt, systemPrompt, ...rest } = j; return rest; }

// نتأكد إن الـ pid لسه بتاع مهمتنا (مش process تاني خد نفس الرقم) قبل ما نوقفه
function isOurProcess(pid, id) {
  try { return fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`CLAUDE_DASHBOARD_JOB=${id}`); } catch { return false; }
}

// تحميل المهام القديمة (واللي كانت شغالة وقت ما السيرفر وقف تبقى "اتقطعت")
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (['running', 'queued'].includes(j.status)) {
      if (j.pid && isOurProcess(j.pid, j.id)) { try { process.kill(-j.pid, 'SIGTERM'); } catch { /* خلصت بالفعل */ } }
      j.status = 'interrupted'; j.error = j.error || 'السيرفر اتقفل والمهمة شغالة — اتوقفت'; j.endedAt = j.endedAt || Date.now(); fs.writeFileSync(path.join(DIR, f), JSON.stringify(j, null, 2)); }
    jobs.set(j.id, j);
  } catch { /* ملف بايظ */ }
}

function appendLog(id, ev) {
  const line = JSON.stringify({ t: Date.now(), ...ev });
  fs.appendFileSync(logPath(id), line + '\n');
  onEvent({ type: 'log', id, ev: JSON.parse(line) });
}

export function listJobs({ slug, limit = 100 } = {}) {
  return [...jobs.values()].filter(j => !slug || j.slug === slug).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(publicJob);
}
export function getJob(id) {
  const j = jobs.get(id);
  if (!j) return null;
  const log = fs.existsSync(logPath(id)) ? fs.readFileSync(logPath(id), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  return { ...j, log };
}

// ---------- حالة الـ CLI ----------
let authCache = null;
export function cliStatus(force = false) {
  if (authCache && !force && Date.now() - authCache.at < (authCache.data.loggedIn ? 60_000 : 5_000)) return Promise.resolve(authCache.data);
  return new Promise(resolve => {
    execFile(CLAUDE_BIN, ['auth', 'status'], { timeout: 15000 }, (err, stdout) => {
      let data;
      if (err && !stdout) data = { installed: false, loggedIn: false, error: err.code === 'ENOENT' ? 'الـ claude CLI مش متسطب' : err.message };
      else { try { const j = JSON.parse(stdout); data = { installed: true, loggedIn: !!j.loggedIn, authMethod: j.authMethod }; } catch { data = { installed: true, loggedIn: false, error: 'مش قادر أقرا حالة الـ login' }; } }
      authCache = { at: Date.now(), data };
      resolve(data);
    });
  });
}

// ---------- بناء البرومبت ----------
const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

export function parseDays(spec) {
  const out = new Set();
  for (const part of String(spec || '').split(/[,،\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw httpErr(400, `صيغة الأيام غلط: "${part}" (مثال: 1-5, 8, 10)`);
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (b < a || b - a > 60) throw httpErr(400, `نطاق غلط: ${part}`);
    for (let d = a; d <= b; d++) out.add(d);
  }
  return [...out].sort((x, y) => x - y);
}

const SYSTEM_RUN = `إنت شغال من داشبورد إدارة المنتجات في وضع headless — مفيش حد هيرد على أسئلتك.
- متسألش أسئلة. لو فيه معلومة ناقصة، خد أنسب قرار من ملفات المشروع وكمّل، واذكره في الآخر تحت عنوان "افتراضات".
- التزم بـ CLAUDE.md و ROLES.md وتعليمات الـ Skill بالحرف، واحفظ الناتج في المكان اللي الـ Skill بتحدده جوه campaigns/<المنتج>/ بس.
- متعدّلش product.json ولا pipeline.config.json (الداشبورد بيحدّثهم)، ومتعملش git commit (الداشبورد بيعمله).
- في آخر رد: ملخص قصير بالعربي + قايمة بمسارات الملفات اللي اتعملت أو اتعدلت.`;

const SYSTEM_QA = `إنت شغال كمراجع QA من داشبورد إدارة المنتجات في وضع headless — مفيش حد هيرد على أسئلتك.
- ممنوع تعدّل أو تنشئ أي ملف. اقرا وراجع بس.
- أول سطر في ردك النهائي لازم يكون بالظبط واحد من دول: "الحكم: ✅" أو "الحكم: ⚠️" أو "الحكم: ❌"، وبعده التقرير بالصيغة اللي في الـ Skill.`;

function context(p, cfg) {
  return [
    `المنتج: «${p.name}» (slug: ${p.slug}, النوع: ${p.typeLabel}${p.series ? `, السلسلة: ${p.series}` : ''})`,
    `فولدر الكامبين: campaigns/${p.slug}/`,
    `فولدر المصدر: ${p.source || 'مش محدد'}`,
    `الملف الأساسي للكتاب: ${p.mainFile || 'مش محدد'}`,
    `الهوية: ${p.brand?.token ? `${p.brand.token} ${p.brand.hex}` : 'لسه مفيش brand.md'}`,
    p.notes ? `ملاحظات المنتج: ${p.notes}` : '',
  ].filter(Boolean).join('\n');
}

function reviewNotes(p, stage) {
  const pre = `campaigns/${p.slug}/${stage.dir ? stage.dir + '/' : ''}`;
  const out = [];
  for (const [file, r] of Object.entries(p.reviews || {})) {
    const inStage = stage.dir ? file.startsWith(pre) : (stage.outputs || []).some(o => file === `campaigns/${p.slug}/${o}`);
    if (inStage && r.status !== 'approved') out.push(`- ${file} (${r.status === 'rejected' ? 'محتاج إعادة' : 'محتاج تعديل'}): ${r.note || 'من غير ملاحظة'}`);
  }
  if (p.stages.find(s => s.id === stage.id)?.manual?.note) out.push(`- ملاحظة على المرحلة كلها: ${p.stages.find(s => s.id === stage.id).manual.note}`);
  return out;
}

function buildJob({ slug, stage: stageId, action = 'run', days, extra = '', parentId = null, message = '', pipeline = false }) {
  if (action === 'followup') { const par = jobs.get(parentId); if (!par) throw httpErr(404, 'المهمة الأصلية مش موجودة'); slug = par.slug; stageId = par.stage; }
  const cfg = loadConfig();
  const runner = cfg.runner || {};
  const { products } = discover(cfg);
  const base = products.find(x => x.slug === slug);
  if (!base) throw httpErr(404, 'منتج غير موجود');
  const p = buildProduct(base, cfg, { full: true });
  const stage = cfg.stages.find(s => s.id === stageId);
  if (!stage) throw httpErr(400, 'مرحلة غير معروفة');
  const dayList = stage.args === 'days' && action !== 'followup' && days ? parseDays(days) : [];
  if (stage.args === 'days' && ['run', 'fix'].includes(action) && !dayList.length) throw httpErr(400, 'حدد الأيام (مثال: 1-5)');
  const vars = { name: p.name, slug: p.slug, source: p.source || '', mainFile: p.mainFile || '', campaign: `campaigns/${p.slug}`, days: dayList.join('، '), label: stage.label, skill: stage.skill };

  let prompt, system, tools, skill = stage.skill, resume = null;
  if (action === 'qa') {
    skill = runner.qaSkill || 'content-qa-reviewer';
    let files = (p.stages.find(s => s.id === stageId)?.files || []).map(f => f.path);
    // QA لدفعة أيام: الملفات بتاعة الأيام دي بس
    if (dayList.length) files = files.filter(f => dayList.some(d => new RegExp(`day-${d}(?!\\d)`).test(f)));
    prompt = [`استخدم Skill \`${skill}\` وراجع مخرجات مرحلة «${stage.label}» (اتعملت بـ Skill \`${stage.skill}\`).`, context(p, cfg),
      `الملفات اللي محتاجة مراجعة:\n${files.length ? files.map(f => '- ' + f).join('\n') : '- (مفيش ملفات — ده بذاته ملاحظة)'}`,
      extra ? `تعليمات إضافية من المستخدم: ${extra}` : ''].filter(Boolean).join('\n\n');
    system = SYSTEM_QA;
    tools = runner.qaAllowedTools || ['Read', 'Glob', 'Grep', 'Skill'];
  } else if (action === 'followup') {
    const parent = jobs.get(parentId);
    if (!parent?.sessionId) throw httpErr(400, 'المهمة الأصلية ملهاش session تتكمّل');
    resume = parent.sessionId;
    skill = parent.skill;
    prompt = message || extra;
    if (!prompt.trim()) throw httpErr(400, 'اكتب الرسالة');
    system = parent.action === 'qa' ? SYSTEM_QA : SYSTEM_RUN;
    tools = parent.tools;
    action = parent.action === 'qa' ? 'qa' : 'run';
  } else {
    const notes = action === 'fix' ? reviewNotes(p, stage) : [];
    if (action === 'fix' && !notes.length && !extra) throw httpErr(400, 'مفيش ملاحظات مراجعة على المرحلة دي — اكتب المطلوب تعديله');
    prompt = [
      action === 'fix'
        ? `استخدم Skill \`${stage.skill}\` وعدّل مخرجات مرحلة «${stage.label}» الموجودة حسب ملاحظات المراجعة دي (عدّل الملفات نفسها، متعملش نسخ جديدة):\n${notes.join('\n')}\n\nالملاحظات دي غالبًا أمثلة: دوّر على السبب الأساسي لكل ملاحظة وصلّحه في كل الأماكن المشابهة مرة واحدة، مش بس المكان المذكور، عشان المراجعة الجاية متلاقيش نفس المشكلة في مكان تاني.`
        : `استخدم Skill \`${stage.skill}\` لمرحلة «${stage.label}».`,
      fill(stage.prompt, vars),
      context(p, cfg),
      extra ? `تعليمات إضافية من المستخدم: ${extra}` : '',
    ].filter(Boolean).join('\n\n');
    system = SYSTEM_RUN;
    tools = [...(runner.allowedTools || []), ...(stage.extraTools || [])];
  }

  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex');
  return {
    id, slug, productName: p.name, stage: stageId, stageLabel: stage.label, skill, action, days: dayList, extra, parentId, resume,
    prompt, systemPrompt: system, tools, model: runner.model || null,
    budgetUsd: stage.budgetUsd || runner.budgetUsd || 5, permissionMode: action === 'qa' ? 'default' : (runner.permissionMode || 'acceptEdits'),
    autoQa: !pipeline && action !== 'qa' && !!runner.autoQa, pipeline: !!pipeline,
    status: 'queued', createdAt: Date.now(), startedAt: null, endedAt: null,
    sessionId: null, costUsd: null, turns: null, result: null, verdict: null, changed: [], error: null,
  };
}

export function createJob(spec) {
  const job = buildJob(spec);
  jobs.set(job.id, job);
  fs.writeFileSync(path.join(DIR, `${job.id}.prompt.md`), `# System\n\n${job.systemPrompt}\n\n# Prompt\n\n${job.prompt}\n`);
  save(job);
  appendLog(job.id, { kind: 'system', text: `اتضافت للطابور: ${job.skill}` });
  pump();
  return publicJob(job);
}

export function cancelJob(id) {
  const j = jobs.get(id);
  if (!j) throw httpErr(404, 'مهمة غير موجودة');
  if (j.status === 'queued') { j.status = 'cancelled'; j.endedAt = Date.now(); save(j); appendLog(id, { kind: 'system', text: 'اتلغت قبل ما تبدأ' }); return publicJob(j); }
  const child = procs.get(id);
  if (j.status !== 'running' || !child) throw httpErr(409, 'المهمة مش شغالة');
  j.cancelRequested = true; save(j);
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* خلصت */ } }, 5000);
  return publicJob(j);
}

// ---------- الطابور ----------
function pump() {
  const cfg = loadConfig();
  const max = cfg.runner?.maxConcurrent || 2;
  const running = [...jobs.values()].filter(j => j.status === 'running');
  const busySlugs = new Set(running.map(j => j.slug));
  const queued = [...jobs.values()].filter(j => j.status === 'queued').sort((a, b) => a.createdAt - b.createdAt);
  for (const j of queued) {
    if (running.length >= max) break;
    if (busySlugs.has(j.slug)) continue; // مهمة واحدة لكل منتج في نفس الوقت
    busySlugs.add(j.slug); running.push(j);
    start(j);
  }
}

function snapshot(slug) {
  const m = new Map();
  for (const f of walk(path.join(ROOT, 'campaigns', slug))) m.set(f.path, f.mtime + ':' + f.size);
  return m;
}
function diffSnap(a, b) {
  const out = [];
  for (const [p, v] of b) if (!a.has(p)) out.push({ path: p, change: 'added' }); else if (a.get(p) !== v) out.push({ path: p, change: 'modified' });
  for (const p of a.keys()) if (!b.has(p)) out.push({ path: p, change: 'deleted' });
  return out;
}

function start(j) {
  j.status = 'running'; j.startedAt = Date.now(); save(j);
  const before = snapshot(j.slug);
  if (j.action !== 'qa') {
    try { j.prevStage = readProductJson(j.slug).stages?.[j.stage] || null; setStageStatus(j.slug, j.stage, 'in-progress', `شغالة من الداشبورد (مهمة ${j.id})`); } catch { /* */ }
  }

  const args = ['-p', j.prompt, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', j.permissionMode, '--append-system-prompt', j.systemPrompt,
    '--max-budget-usd', String(j.budgetUsd), '--allowedTools', ...j.tools];
  if (j.action === 'qa') args.push('--disallowedTools', 'Write', 'Edit', 'NotebookEdit', 'Bash');
  if (j.model) args.push('--model', j.model);
  if (j.resume) args.push('--resume', j.resume);
  appendLog(j.id, { kind: 'system', text: `بدأت · ${j.tools.length} أداة مسموحة · ميزانية $${j.budgetUsd}` });

  let child;
  try {
    child = spawn(CLAUDE_BIN, args, { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_DASHBOARD_JOB: j.id } });
  } catch (e) { return finish(j, before, { error: e.message }); }
  procs.set(j.id, child);
  j.pid = child.pid; save(j);

  let buf = '', resultEv = null, stderr = '';
  child.stdout.on('data', chunk => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch { appendLog(j.id, { kind: 'raw', text: line.slice(0, 2000) }); continue; }
      if (d.type === 'system' && d.subtype === 'init') { j.sessionId = d.session_id; save(j); appendLog(j.id, { kind: 'system', text: `session ${d.session_id} · ${d.model || ''}` }); }
      else if (d.type === 'assistant') {
        for (const c of d.message?.content || []) {
          if (c.type === 'text' && c.text?.trim()) appendLog(j.id, { kind: 'text', text: c.text });
          else if (c.type === 'tool_use') appendLog(j.id, { kind: 'tool', name: c.name, text: summarizeInput(c.name, c.input) });
        }
      } else if (d.type === 'user') {
        for (const c of d.message?.content || []) {
          if (c?.type === 'tool_result' && c.is_error) appendLog(j.id, { kind: 'tool_error', text: toText(c.content).slice(0, 600) });
        }
      } else if (d.type === 'result') resultEv = d;
    }
  });
  child.stderr.on('data', c => { stderr += c.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
  child.on('error', e => finish(j, before, { error: e.code === 'ENOENT' ? 'الـ claude CLI مش موجود على الجهاز' : e.message }));
  child.on('close', code => finish(j, before, { code, resultEv, stderr }));
}

// ملخص قصير لتقرير QA: الملاحظات نفسها (البنود المرقمة/النقاط بعد عنوان الملاحظات)، مش العناوين
function qaNote(report) {
  const lines = report.replace(/الحكم\s*[:：]\s*\S+/, '').split('\n').map(l => l.trim()).filter(Boolean);
  const start = lines.findIndex(l => /^#{1,6}\s*(ملاحظات|الملاحظات|المشاكل|issues)/i.test(l));
  const pool = start >= 0 ? lines.slice(start + 1) : lines;
  const items = pool.filter(l => /^(\d+[.)]|[-*•])\s+/.test(l) && !/^#/.test(l)).map(l => l.replace(/^(\d+[.)]|[-*•])\s+/, '').replace(/\*\*/g, ''));
  const picked = (items.length ? items : pool.filter(l => !/^#/.test(l))).slice(0, 2).join(' · ');
  return picked.slice(0, 300);
}

export function remainingDays(slug, stageId) {
  const cfg = loadConfig();
  const base = discover(cfg).products.find(x => x.slug === slug);
  return base ? missingDays(buildProduct(base, cfg, { full: true }), stageId) : [];
}

function toText(c) { return typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join(' ') : JSON.stringify(c); }
function summarizeInput(name, input = {}) {
  if (input.file_path) return input.file_path.replace(ROOT + '/', '');
  if (input.command) return input.command.slice(0, 300);
  if (input.skill) return input.skill;
  if (input.pattern) return input.pattern;
  if (input.prompt) return String(input.prompt).slice(0, 200);
  return JSON.stringify(input).slice(0, 200);
}

async function finish(j, before, { code, resultEv, stderr, error } = {}) {
  if (j.status !== 'running') return;
  procs.delete(j.id);
  const r = resultEv || {};
  j.endedAt = Date.now();
  j.sessionId = r.session_id || j.sessionId;
  j.costUsd = r.total_cost_usd ?? null;
  j.turns = r.num_turns ?? null;
  j.result = r.result || null;
  j.changed = diffSnap(before, snapshot(j.slug));

  if (j.cancelRequested) { j.status = 'cancelled'; }
  else if (error) { j.status = 'failed'; j.error = error; }
  else if (!resultEv) { j.status = 'failed'; j.error = (stderr || `الـ CLI خرج بكود ${code}`).trim().slice(-1500); }
  else if (r.is_error || r.subtype !== 'success') {
    j.status = 'failed';
    j.error = /not logged in|\/login/i.test(r.result || '') ? 'الـ claude CLI مش عامل login — افتح Terminal واكتب claude وبعدين /login' :
      r.subtype === 'error_max_budget_usd' ? `وصلت لحد الميزانية ($${j.budgetUsd})` : (r.result || r.subtype || 'فشلت');
  } else j.status = 'done';

  if (j.status === 'done' && j.action === 'qa') {
    const m = (j.result || '').match(/الحكم\s*[:：]\s*(✅|⚠️|⚠|❌)/) || (j.result || '').match(/(✅|⚠️|❌)/);
    const v = m ? m[1] : null;
    j.verdict = v === '✅' ? 'approved' : v === '❌' ? 'rejected' : v ? 'needs-fix' : null;
    fs.writeFileSync(path.join(DIR, `${j.id}.report.md`), j.result || '');
    const note = qaNote(j.result || '');
    if (j.verdict) {
      let status = j.verdict, n = `QA (${j.id}): ${note}`;
      // مرحلة بالأيام: اعتماد دفعة مش معناه إن المرحلة كلها خلصت
      if (j.days.length) {
        const left = remainingDays(j.slug, j.stage);
        n = `QA أيام ${j.days.join(',')} (${j.id}): ${note}`;
        if (status === 'approved' && left.length) { status = 'in-progress'; n = `أيام ${j.days.join(',')} اتعتمدت · فاضل ${left.length} يوم`; }
      }
      try { await commitPaths([setStageStatus(j.slug, j.stage, status, n)], `dashboard: QA ${j.slug}/${j.stage}${j.days.length ? ' days ' + j.days.join(',') : ''} → ${j.verdict}`); } catch { /* */ }
    }
  }
  if (j.action !== 'qa') {
    // نجحت → مستنية مراجعة. اتلغت/فشلت → المرحلة ترجع لحالتها اللي كانت عليها (السبب ظاهر في صفحة المهمة)
    const paths = j.changed.map(c => c.path);
    try {
      paths.push(j.status === 'done'
        ? setStageStatus(j.slug, j.stage, 'review', `اتعملت من الداشبورد (مهمة ${j.id}) — مستنية مراجعة`)
        : setStageStatus(j.slug, j.stage, j.prevStage?.status || 'auto', j.prevStage?.note || ''));
    } catch { /* */ }
    if (paths.length) await commitPaths(paths, `skill: ${j.skill} → ${j.slug}/${j.stage}${j.days.length ? ' days ' + j.days.join(',') : ''} [job ${j.id}]`);
  }
  appendLog(j.id, { kind: j.status === 'done' ? 'done' : 'error', text: j.status === 'done' ? `خلصت · ${j.changed.length} ملف اتغير${j.costUsd != null ? ` · $${j.costUsd.toFixed(3)}` : ''}` : (j.error || j.status) });
  save(j);

  for (const fn of finishListeners) { try { await fn(publicJob(j)); } catch (e) { console.error('finish listener', e); } }

  if (j.status === 'done' && j.autoQa && j.action !== 'qa') {
    try { createJob({ slug: j.slug, stage: j.stage, action: 'qa', parentId: j.id }); } catch (e) { appendLog(j.id, { kind: 'error', text: 'QA التلقائي مقدرش يبدأ: ' + e.message }); }
  }
  pump();
}

// لما السيرفر يقفل: نوقف أي claude شغال (عشان ميفضلش يكتب ملفات من غير متابعة)
function killAll() { for (const c of procs.values()) { try { process.kill(-c.pid, 'SIGTERM'); } catch { /* */ } } }
process.on('exit', killAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { killAll(); process.exit(0); });
