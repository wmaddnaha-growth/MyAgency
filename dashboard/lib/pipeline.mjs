// الشغل الأوتوماتيك (المرحلة 4): لكل منتج «خط» بيمشي على المراحل بالترتيب.
// كل مرحلة: (موافقة لو ليها gate) ← تشغيل ← QA ← تعديل لحد maxFixRounds ← يا اتعتمدت يا يقف يستنى قرارك.
// المراحل اللي بالأيام بتتعمل على دفعات (batchDays) وكل دفعة ليها QA لوحدها.
// الحالة محفوظة في .jobs/pipelines/<slug>.json (برا git) وبترجع بعد ما السيرفر يقوم.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, discover, buildProduct, missingDays } from './core.mjs';
import { createJob, cancelJob, onJobFinished, listJobs } from './jobs.mjs';
import { setStageStatus, httpErr } from './write.mjs';
import { commitPaths } from './git.mjs';

const DIR = path.join(ROOT, '.jobs', 'pipelines');
fs.mkdirSync(DIR, { recursive: true });
const pipes = new Map();
let emit = () => {};
export function setPipelineListener(fn) { emit = fn; }

const file = slug => path.join(DIR, encodeURIComponent(slug) + '.json');
function save(p) { p.updatedAt = Date.now(); fs.writeFileSync(file(p.slug), JSON.stringify(p, null, 2)); emit({ type: 'pipeline', pipeline: p }); }
function log(p, text, kind = 'info') { p.events.push({ t: Date.now(), kind, text }); if (p.events.length > 300) p.events.splice(0, p.events.length - 300); }

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (p.status === 'running' && p.current?.jobId) {
      // السيرفر اتقفل والمرحلة شغالة → نستنى المستخدم يقول كمّل
      p.status = 'waiting';
      p.waiting = { type: 'error', stage: p.current.stage, message: 'السيرفر اتقفل والشغل كان ماشي. دوس «كمّل» عشان المرحلة دي تتعاد.' };
      p.current = null;
      fs.writeFileSync(path.join(DIR, f), JSON.stringify(p, null, 2));
    }
    pipes.set(p.slug, p);
  } catch { /* */ }
}

export const getPipeline = slug => pipes.get(slug) || null;
export const listPipelines = () => [...pipes.values()];

function full(slug) {
  const cfg = loadConfig();
  const base = discover(cfg).products.find(x => x.slug === slug);
  if (!base) throw httpErr(404, 'منتج غير موجود');
  return { cfg, prod: buildProduct(base, cfg, { full: true }) };
}

const DONE = ['approved', 'skipped'];
// المراحل اللي بتشتغل بالأيام (البوستات/التصاميم/الريلز) — حتى لو نوعها collection
const byDays = st => st.kind === 'perDay' || st.args === 'days';

// ---------- بدء ----------
export function startPipeline(slug, { stages, pauseBefore } = {}) {
  const existing = pipes.get(slug);
  if (existing && ['running', 'waiting'].includes(existing.status)) throw httpErr(409, 'فيه شغل أوتوماتيك ماشي بالفعل على المنتج ده');
  const { cfg, prod } = full(slug);
  const ap = cfg.autopilot || {};
  const order = prod.stages.map(s => s.id);
  const chosen = (stages?.length ? stages : ap.presets?.[ap.defaultPreset || 'organic']?.stages || order).filter(id => order.includes(id));
  if (!chosen.length) throw httpErr(400, 'اختار مرحلة واحدة على الأقل');
  const pause = new Set(pauseBefore ?? prod.stages.filter(s => s.gate).map(s => s.id));
  const p = {
    slug, name: prod.name, status: 'running', createdAt: Date.now(), updatedAt: Date.now(),
    plan: order.filter(id => chosen.includes(id)).map(id => {
      const st = prod.stages.find(s => s.id === id);
      return { stage: id, label: st.label, pause: pause.has(id), gateApproved: false, state: 'pending', rounds: 0, batches: 0, note: '' };
    }),
    current: null, waiting: null, spent: 0, maxUsd: ap.maxTotalUsd || 40, events: [],
  };
  log(p, `بدأ الشغل الأوتوماتيك على ${p.plan.length} مرحلة`);
  pipes.set(slug, p);
  save(p);
  step(slug);
  return p;
}

// ---------- الخطوة الجاية ----------
function step(slug) {
  const p = pipes.get(slug);
  if (!p || p.status !== 'running' || p.current) return;
  let cfg, prod;
  try { ({ cfg, prod } = full(slug)); } catch (e) { return wait(p, { type: 'error', message: e.message }); }
  const ap = cfg.autopilot || {};

  if (p.spent >= p.maxUsd) return wait(p, { type: 'budget', message: `وصلنا لحد الميزانية ($${p.spent.toFixed(2)} من $${p.maxUsd}). زوّد الحد أو كمّل لو موافق.` });

  for (const item of p.plan) {
    if (['done', 'skipped'].includes(item.state)) continue;
    const st = prod.stages.find(s => s.id === item.stage);
    const perDay = byDays(st);

    // مرحلة بالأيام: خلصت لما مفيش أيام ناقصة
    if (perDay) {
      if (!prod.calendar) { item.state = 'skipped'; item.note = 'مفيش خطة محتوى'; log(p, `${item.label}: اتخطت (مفيش calendar.csv)`, 'warn'); continue; }
      const miss = missingDays(prod, st.id);
      if (!miss.length) { finishStage(p, item, prod); continue; }
    } else if (DONE.includes(st.status)) { finishStage(p, item, prod, true); continue; }

    // لازم المراحل اللي قبلها تكون جاهزة
    const notReady = st.dependsOn.filter(d => {
      const ds = prod.stages.find(x => x.id === d);
      if (!ds) return false;
      const inPlan = p.plan.find(x => x.stage === d);
      return !(DONE.includes(ds.status) || ds.auto === 'done' || (inPlan && inPlan.state === 'done'));
    });
    if (notReady.length) {
      const names = notReady.map(d => prod.stages.find(x => x.id === d)?.label).join('، ');
      return wait(p, { type: 'decision', stage: st.id, message: `«${st.label}» محتاجة «${names}» تبقى جاهزة الأول، والمرحلة دي مش في الخطة أو لسه مش معتمدة. ضيفها، أو اعتمدها يدوي، أو اتخطّى «${st.label}».` });
    }

    // موافقة قبل المرحلة
    if (item.pause && !item.gateApproved) {
      item.state = 'gate';
      return wait(p, { type: 'gate', stage: st.id, message: `«${st.label}» مستنية موافقتك قبل ما تبدأ${st.gate ? ` (${st.gate})` : ''}.` });
    }

    // شغّل
    let days;
    if (perDay) {
      const size = ap.batchDays || 5;
      days = missingDays(prod, st.id).slice(0, size).join(',');
      item.batches++;
    }
    item.state = 'running';
    // مرحلة عندها ناتج قياسي بس لسه متراجعتش → QA الأول بدل ما تتعمل من الصفر
    // عليها ملاحظات → تعديل. ناقصة أو مش موجودة → تشغيل.
    let action = 'run';
    if (!perDay) {
      if (['needs-fix', 'rejected'].includes(st.status)) action = 'fix';
      else if (st.auto === 'done') action = 'qa';
    }
    if (action === 'fix') item.rounds++;
    return launch(p, item, action, days);
  }

  // كل المراحل خلصت
  p.status = 'done';
  p.waiting = null;
  log(p, `الخط خلص 🎉 · إجمالي $${p.spent.toFixed(2)}`, 'done');
  save(p);
}

function finishStage(p, item, prod, already = false) {
  if (item.state === 'done') return;
  item.state = 'done';
  if (!already || item.rounds || item.batches) log(p, `${item.label}: خلصت ✅`, 'done');
  save(p);
}

function launch(p, item, action, days, extra = '') {
  try {
    const job = createJob({ slug: p.slug, stage: item.stage, action, days, extra, pipeline: true });
    p.current = { stage: item.stage, phase: action, jobId: job.id, days: days || '' };
    p.waiting = null;
    log(p, `${item.label}: ${action === 'qa' ? 'مراجعة QA' : action === 'fix' ? `تعديل (جولة ${item.rounds})` : 'تشغيل'}${days ? ` · أيام ${days}` : ''}`);
    save(p);
  } catch (e) {
    item.state = 'pending';
    wait(p, { type: 'error', stage: item.stage, message: `مقدرتش أبدأ «${item.label}»: ${e.message}` });
  }
}

function wait(p, w) {
  p.status = 'waiting';
  p.waiting = { ...w, at: Date.now() };
  log(p, w.message, w.type === 'error' ? 'error' : 'wait');
  save(p);
}

// ---------- لما مهمة تخلص ----------
onJobFinished(async job => {
  if (!job.pipeline) return;
  const p = pipes.get(job.slug);
  if (!p || p.current?.jobId !== job.id) return;
  const item = p.plan.find(x => x.stage === job.stage);
  p.spent += job.costUsd || 0;
  p.current = null;

  if (job.status !== 'done') {
    if (item) item.state = 'pending';
    if (p.status === 'cancelled') { save(p); return; }
    return wait(p, { type: 'error', stage: job.stage, message: `«${item?.label}» ${job.status === 'cancelled' ? 'اتلغت' : 'فشلت'}: ${job.error || ''}`.trim() });
  }

  const cfg = loadConfig();
  const maxRounds = cfg.autopilot?.maxFixRounds ?? 2;
  if (job.action !== 'qa') {
    // بعد أي تشغيل/تعديل → QA على نفس الأيام
    save(p);
    if (p.status !== 'running') return;
    return launch(p, item, 'qa', job.days.join(','));
  }

  // نتيجة QA
  if (job.verdict === 'approved') {
    log(p, `${item.label}${job.days.length ? ` (أيام ${job.days.join(',')})` : ''}: QA ✅`, 'done');
    item.rounds = 0;
    const st = cfg.stages.find(s => s.id === item.stage);
    if (!byDays(st)) item.state = 'done';
    else item.state = 'pending'; // الدفعة الجاية (أو تخلص لو مفيش أيام ناقصة)
    save(p);
    return step(p.slug);
  }
  if (!job.verdict) {
    item.state = 'pending';
    return wait(p, { type: 'decision', stage: item.stage, message: `QA على «${item.label}» مطلعش حكم واضح. افتح التقرير وقرر: اعتمد، أو عدّل تاني، أو اتخطّى.`, jobId: job.id });
  }
  if (item.rounds < maxRounds) {
    item.rounds++;
    save(p);
    if (p.status !== 'running') return;
    return launch(p, item, 'fix', job.days.join(','));
  }
  item.state = 'pending';
  return wait(p, {
    type: 'decision', stage: item.stage, jobId: job.id, days: job.days.join(','),
    message: `«${item.label}»${job.days.length ? ` (أيام ${job.days.join(',')})` : ''} لسه عليها ملاحظات بعد ${maxRounds} جولات تعديل. افتح تقرير QA وقرر: اعتمدها زي ما هي، أو جولة تعديل كمان، أو اتخطّاها.`,
  });
});

// ---------- أوامر المستخدم ----------
export async function control(slug, action, { stage, extra } = {}) {
  const p = pipes.get(slug);
  if (!p) throw httpErr(404, 'مفيش شغل أوتوماتيك للمنتج ده');
  const item = stage ? p.plan.find(x => x.stage === stage) : p.plan.find(x => x.stage === p.waiting?.stage);

  switch (action) {
    case 'pause':
      if (p.status !== 'running') throw httpErr(409, 'مش شغال');
      p.status = 'paused'; log(p, 'اتوقف مؤقتًا — المهمة الحالية هتكمل لآخرها ومش هيبدأ حاجة جديدة'); save(p); return p;
    case 'resume':
    case 'continue': {
      if (!['paused', 'waiting'].includes(p.status)) throw httpErr(409, 'مش متوقف');
      if (p.waiting?.type === 'budget') p.maxUsd = Math.ceil(p.spent + (loadConfig().autopilot?.maxTotalUsd || 40) / 2);
      if (p.waiting?.type === 'gate' && item) { item.gateApproved = true; item.state = 'pending'; log(p, `وافقت على «${item.label}»`); }
      p.status = 'running'; p.waiting = null; save(p);
      if (!p.current) step(slug);
      return p;
    }
    case 'approve-stage': {
      // اعتمدها زي ما هي (رغم ملاحظات QA)
      if (!item) throw httpErr(400, 'حدد المرحلة');
      const cfg = loadConfig();
      const st = cfg.stages.find(s => s.id === item.stage);
      if (!byDays(st)) {
        await commitPaths([setStageStatus(slug, item.stage, 'approved', 'اتعتمدت يدوي من الشغل الأوتوماتيك رغم ملاحظات QA')], `dashboard: approve ${slug}/${item.stage}`);
        item.state = 'done';
      } else item.state = 'pending';
      item.rounds = 0;
      log(p, `اعتمدت «${item.label}» زي ما هي`);
      p.status = 'running'; p.waiting = null; save(p); step(slug); return p;
    }
    case 'fix-again': {
      if (!item) throw httpErr(400, 'حدد المرحلة');
      const days = p.waiting?.days || '';
      p.status = 'running'; p.waiting = null; item.state = 'running'; item.rounds++;
      launch(p, item, 'fix', days, extra || '');
      return p;
    }
    case 'skip-stage': {
      if (!item) throw httpErr(400, 'حدد المرحلة');
      item.state = 'skipped';
      await commitPaths([setStageStatus(slug, item.stage, 'skipped', 'اتخطت من الشغل الأوتوماتيك')], `dashboard: skip ${slug}/${item.stage}`);
      log(p, `اتخطيت «${item.label}»`);
      p.status = 'running'; p.waiting = null; save(p); step(slug); return p;
    }
    case 'cancel': {
      p.status = 'cancelled'; p.waiting = null;
      if (p.current?.jobId) { try { cancelJob(p.current.jobId); } catch { /* خلصت */ } }
      log(p, 'الشغل الأوتوماتيك اتلغى'); save(p); return p;
    }
    default: throw httpErr(400, 'أمر غير معروف');
  }
}

// لو مهمة الخط مش موجودة في الطابور خالص (مثلاً اتمسحت) متفضلش معلّقة
setInterval(() => {
  for (const p of pipes.values()) {
    if (p.status === 'running' && p.current?.jobId && !listJobs({ slug: p.slug }).some(j => j.id === p.current.jobId)) {
      p.current = null; wait(p, { type: 'error', message: 'المهمة الحالية اختفت من الطابور — دوس «كمّل».' });
    }
  }
}, 30000).unref();
