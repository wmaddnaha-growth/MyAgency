import { useEffect, useMemo, useRef, useState } from 'react';
import { api, href, fmtDate, fmtDur, useJobs, useServerEvent, useAsync, JOB_STATUS, JOB_ACTION, type Job, type LogEv, type ProductFull, type Stage, type RunnerInfo } from './api';
import { Markdown, Empty, STATUS_LABEL } from './ui';
import { toast } from './Edit';

// ---------- حالة الـ CLI ----------
let runnerCache: RunnerInfo | null = null;
export function useRunner() {
  const [r, setR] = useState<RunnerInfo | null>(runnerCache);
  const refresh = (force = false) => api.runner(force).then(x => { runnerCache = x; setR(x); }).catch(() => {});
  useEffect(() => {
    refresh();
    const f = () => refresh();
    addEventListener('focus', f); return () => removeEventListener('focus', f);
  }, []);
  return { info: r, refresh };
}

export function CliWarning({ info, refresh }: { info: RunnerInfo | null; refresh: (f?: boolean) => void }) {
  if (!info || info.cli.loggedIn) return null;
  return (
    <div className="card notice">
      <h3>{info.cli.installed ? 'الـ claude CLI مش عامل login' : 'الـ claude CLI مش متسطب'}</h3>
      <p>تشغيل الـ Skills من هنا بيستخدم <code>claude</code> اللي على جهازك. سجّل دخول مرة واحدة من Terminal:</p>
      <pre className="pre" dir="ltr">claude{'\n'}/login</pre>
      <p className="muted small">وبعد ما تخلص اقفله (<code dir="ltr">/exit</code>) ودوس «اتأكد تاني».</p>
      <button type="button" className="btn ghost" onClick={() => refresh(true)}>اتأكد تاني</button>
    </div>
  );
}

// ---------- لوحة التشغيل في كل مرحلة ----------
function missingDays(p: ProductFull, s: Stage) {
  const days = p.calendar?.days || [];
  const miss = days.filter(d => s.id === 'copy' ? !d.copy : s.id === 'visuals' ? (d.copy && !d.visuals.length) : s.id === 'reels' ? (/ريل|reel|فيديو/i.test(d.row.format || '') && !d.reels.length && d.copy) : false).map(d => d.day);
  return miss;
}
function compact(days: number[]) {
  const out: string[] = []; let i = 0;
  while (i < days.length) { let j = i; while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++; out.push(i === j ? `${days[i]}` : `${days[i]}-${days[j]}`); i = j + 1; }
  return out.join(', ');
}

export function RunPanel({ p, s }: { p: ProductFull; s: Stage }) {
  const { info, refresh } = useRunner();
  const jobs = useJobs(p.slug);
  const stageJobs = (jobs || []).filter(j => j.stage === s.id);
  const active = stageJobs.find(j => ['queued', 'running'].includes(j.status));
  const miss = useMemo(() => missingDays(p, s), [p, s]);
  const [days, setDays] = useState(() => compact(miss.slice(0, 5)));
  const [extra, setExtra] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDays(compact(miss.slice(0, 5))); }, [s.id]); // eslint-disable-line
  const hasNotes = Object.entries(p.reviews || {}).some(([f, r]) => r.status !== 'approved' && f.startsWith(`campaigns/${p.slug}/${s.dir ? s.dir + '/' : ''}`) && (s.dir || (s.outputs || []).some(o => f.endsWith(o)))) || ['needs-fix', 'rejected'].includes(s.status);
  const blocked = s.blockedBy.length > 0;
  const ready = info?.cli.loggedIn;

  const go = async (action: 'run' | 'fix' | 'qa') => {
    if (action !== 'qa' && s.gate && !confirm(`تنبيه: ${s.gate}\n\nتكمّل؟`)) return;
    if (action === 'run' && blocked && !confirm(`المرحلة دي معتمدة على: ${s.blockedBy.map(id => p.stages.find(x => x.id === id)?.label).join('، ')} — ولسه مش جاهزة. الـ Skill ممكن توقف أو تطلّع نتيجة أضعف. تكمّل؟`)) return;
    setBusy(true);
    try {
      const j = await api.createJob({ slug: p.slug, stage: s.id, action, days: s.args === 'days' ? days : undefined, extra });
      toast(`${JOB_ACTION[action]}: اتضافت للطابور`);
      setExtra(''); setOpen(false);
      location.hash = href({ page: 'jobs', id: j.id });
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="card runpanel">
      <div className="card-h">
        <h3>تشغيل بـ Claude</h3>
        <span className="muted small"><code dir="ltr">{s.skill}</code></span>
      </div>
      <CliWarning info={info} refresh={refresh} />
      {active && (
        <a className="job-active" href={href({ page: 'jobs', id: active.id })}>
          <span className="spinner" /> {JOB_ACTION[active.action]} {JOB_STATUS[active.status]}… <span className="muted">افتح السجل اللايف</span>
        </a>
      )}
      {s.args === 'days' && (
        <label className="field">الأيام
          <input className="input" value={days} onChange={e => setDays(e.target.value)} placeholder="مثال: 6-10, 12" dir="ltr" />
          <span className="muted small">{miss.length ? `أيام ناقصة: ${compact(miss)}` : 'كل الأيام عندها ملفات — تقدر تحدد أيام تتعمل من جديد'}</span>
        </label>
      )}
      {open ? (
        <label className="field">تعليمات إضافية (اختياري)
          <textarea className="input" rows={3} value={extra} onChange={e => setExtra(e.target.value)} placeholder="مثلاً: ركّز على الأزواج في أول سنة جواز، أو استخدم نبرة أهدى" />
        </label>
      ) : <button type="button" className="linkish small" onClick={() => setOpen(true)}>+ تعليمات إضافية</button>}
      <div className="row">
        <button type="button" className="btn" disabled={!ready || busy} onClick={() => go('run')}>▶ شغّل {s.label}</button>
        <button type="button" className="btn ghost" disabled={!ready || busy || !hasNotes && !extra} title={hasNotes ? 'بيبعت ملاحظات المراجعة للـ Skill تعدّل الملفات' : 'مفيش ملاحظات مراجعة — اكتب المطلوب في التعليمات الإضافية'} onClick={() => go('fix')}>✎ عدّل حسب الملاحظات</button>
        <button type="button" className="btn ghost" disabled={!ready || busy || !s.fileCount} onClick={() => go('qa')}>✓ مراجعة QA</button>
      </div>
      {s.gate && <p className="gate">⏸ {s.gate}</p>}
      {info?.runner.autoQa && <p className="muted small">بعد أي تشغيل ناجح، مراجعة QA بتبدأ لوحدها وحكمها بيتسجل على حالة المرحلة.</p>}
      {stageJobs.length > 0 && <JobList jobs={stageJobs.slice(0, 5)} compact />}
    </div>
  );
}

// ---------- قايمة المهام ----------
export function JobList({ jobs, compact }: { jobs: Job[]; compact?: boolean }) {
  if (!jobs.length) return <Empty>مفيش مهام لسه.</Empty>;
  return (
    <ul className={`joblist${compact ? ' compact' : ''}`}>
      {jobs.map(j => (
        <li key={j.id}>
          <a href={href({ page: 'jobs', id: j.id })} className={`jobrow js-${j.status}`}>
            <span className={`jstat js-${j.status}`}>{j.status === 'running' && <span className="spinner" />}{JOB_STATUS[j.status]}</span>
            <span className="jtitle">
              {!compact && <strong>{j.productName}</strong>}{!compact && ' · '}{j.stageLabel} · {JOB_ACTION[j.action]}{j.days.length ? ` (أيام ${compact_(j.days)})` : ''}
              {j.verdict && <span className={`badge st-${j.verdict}`}><i />{STATUS_LABEL[j.verdict]}</span>}
            </span>
            <span className="muted small nowrap">{fmtDate(j.createdAt)} {new Date(j.createdAt).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}{j.costUsd != null ? ` · $${j.costUsd.toFixed(2)}` : ''}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
const compact_ = compact;

export function JobsPage() {
  const jobs = useJobs();
  const [f, setF] = useState<'all' | 'active' | 'failed'>('all');
  const list = (jobs || []).filter(j => f === 'all' || (f === 'active' ? ['queued', 'running'].includes(j.status) : ['failed', 'interrupted'].includes(j.status)));
  const { info, refresh } = useRunner();
  return (
    <div className="page stack">
      <div className="section-h"><h2>المهام</h2><span className="muted">كل تشغيلات الـ Skills من الداشبورد</span></div>
      <CliWarning info={info} refresh={refresh} />
      <div className="seg">
        {([['all', 'الكل'], ['active', 'شغالة / في الطابور'], ['failed', 'فشلت']] as const).map(([k, l]) => <button key={k} type="button" className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}
      </div>
      {jobs == null ? <div className="loading">…</div> : <div className="card"><JobList jobs={list} /></div>}
    </div>
  );
}

// ---------- صفحة المهمة (سجل لايف) ----------
export function JobPage({ id }: { id: string }) {
  const [job, setJob] = useState<(Job & { log: LogEv[] }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  useEffect(() => { setJob(null); api.job(id).then(setJob, e => setErr(e.message)); }, [id]);
  useServerEvent('job', ({ job: j }: { job: Job }) => { if (j.id === id) setJob(x => x ? { ...x, ...j } : x); });
  useServerEvent('log', ({ id: jid, ev }: { id: string; ev: LogEv }) => { if (jid === id) setJob(x => x ? { ...x, log: [...x.log, ev] } : x); });
  useEffect(() => { if (follow && job?.status === 'running') endRef.current?.scrollIntoView({ block: 'end' }); }, [job?.log.length, follow, job?.status]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (job?.status !== 'running') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [job?.status]);
  const children = useJobs(job?.slug);
  const qaChild = (children || []).find(j => j.parentId === id && j.action === 'qa');

  if (err) return <div className="page"><Empty>{err}</Empty></div>;
  if (!job) return <div className="page"><div className="loading">جاري التحميل…</div></div>;
  const live = ['queued', 'running'].includes(job.status);
  const dur = job.startedAt ? (job.endedAt || now) - job.startedAt : 0;

  return (
    <div className="page stack">
      <div className="card jobhead">
        <div className="jobhead-main">
          <a className="back-dark" href={href({ page: 'product', slug: job.slug, tab: job.stage })}>→ {job.productName} / {job.stageLabel}</a>
          <h2>{JOB_ACTION[job.action]}: <code dir="ltr">{job.skill}</code></h2>
          <div className="row small muted">
            <span className={`jstat js-${job.status}`}>{job.status === 'running' && <span className="spinner" />}{JOB_STATUS[job.status]}</span>
            {job.days.length > 0 && <span>الأيام: {compact(job.days)}</span>}
            {dur > 0 && <span>المدة: {fmtDur(dur)}</span>}
            {job.costUsd != null && <span>التكلفة: ${job.costUsd.toFixed(3)} من ${job.budgetUsd}</span>}
            {job.turns != null && <span>{job.turns} خطوة</span>}
            {job.verdict && <span className={`badge st-${job.verdict}`}><i />{STATUS_LABEL[job.verdict]}</span>}
          </div>
        </div>
        <div className="row">
          {live && <button type="button" className="btn ghost danger" onClick={async () => { if (confirm('توقف المهمة؟ الملفات اللي اتعملت لحد دلوقتي هتفضل زي ما هي.')) { try { await api.cancelJob(id); } catch (e: any) { toast(e.message, 'err'); } } }}>■ إيقاف</button>}
          {job.parentId && <a className="btn ghost" href={href({ page: 'jobs', id: job.parentId })}>المهمة الأصلية</a>}
          {qaChild && <a className="btn ghost" href={href({ page: 'jobs', id: qaChild.id })}>مراجعة QA: {JOB_STATUS[qaChild.status]}</a>}
        </div>
      </div>

      {job.error && <div className="card notice err"><strong>{job.status === 'cancelled' ? 'اتلغت' : 'المشكلة'}:</strong> {job.error}</div>}

      <div className="jobgrid">
        <div className="card">
          <div className="card-h"><h3>السجل {live && <span className="muted small">(لايف)</span>}</h3>
            {live && <label className="small muted"><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> تابع آخر سطر</label>}</div>
          <div className="joblog">
            {job.log.map((e, i) => <LogLine key={i} e={e} />)}
            {job.status === 'running' && <div className="logline lk-wait"><span className="spinner" /> شغالة…</div>}
            <div ref={endRef} />
          </div>
        </div>
        <div className="stack">
          {job.result && <div className="card"><h3>{job.action === 'qa' ? 'تقرير QA' : 'النتيجة'}</h3><Markdown text={job.result} /></div>}
          {job.changed.length > 0 && (
            <div className="card">
              <h3>الملفات اللي اتغيرت ({job.changed.length})</h3>
              <ul className="changed">
                {job.changed.map(c => (
                  <li key={c.path}>
                    <span className={`chg chg-${c.change}`}>{{ added: 'جديد', modified: 'اتعدل', deleted: 'اتمسح' }[c.change]}</span>
                    {c.change === 'deleted' ? <span>{c.path.split('/').slice(2).join('/')}</span>
                      : <a href={href({ page: 'product', slug: job.slug, tab: 'all', file: c.path })}>{c.path.split('/').slice(2).join('/')}</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!live && job.sessionId && (
            <form className="card" onSubmit={async e => {
              e.preventDefault();
              try { const j = await api.createJob({ slug: job.slug, stage: job.stage, action: 'followup', parentId: id, message: msg }); setMsg(''); location.hash = href({ page: 'jobs', id: j.id }); }
              catch (er: any) { toast(er.message, 'err'); }
            }}>
              <h3>رسالة متابعة</h3>
              <p className="muted small">بتكمّل نفس المحادثة مع Claude (عارف كل اللي حصل فيها).</p>
              <textarea className="input full" rows={3} value={msg} onChange={e => setMsg(e.target.value)} placeholder="مثلاً: خلّي الهوك بتاع يوم 7 أقصر، وغيّر الـ CTA" />
              <div className="row"><span className="spacer" /><button className="btn" disabled={!msg.trim()}>ابعت</button></div>
            </form>
          )}
          {job.prompt && <details className="card"><summary>البرومبت اللي اتبعت</summary><pre className="pre small">{job.prompt}</pre><p className="muted small">الأدوات المسموحة: <code dir="ltr">{job.tools.join(' ')}</code></p></details>}
        </div>
      </div>
    </div>
  );
}

function LogLine({ e }: { e: LogEv }) {
  const time = new Date(e.t).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (e.kind === 'text') return <div className="logline lk-text"><Markdown text={e.text} /></div>;
  return (
    <div className={`logline lk-${e.kind}`}>
      <span className="lt muted">{time}</span>
      {e.kind === 'tool' && <span className="lname">{e.name}</span>}
      <span className="lx" dir="auto">{e.text}</span>
    </div>
  );
}

// ---------- مؤشر في الهيدر ----------
export function JobsIndicator() {
  const jobs = useJobs();
  const running = (jobs || []).filter(j => ['queued', 'running'].includes(j.status)).length;
  return <a href="#/jobs" className={`jobs-ind${running ? ' on' : ''}`}>{running ? <span className="spinner light" /> : null}المهام{running ? ` (${running})` : ''}</a>;
}

// ---------- آخر مهام المنتج ----------
export function ProductJobs({ slug }: { slug: string }) {
  const jobs = useJobs(slug);
  if (!jobs?.length) return null;
  return <div className="card"><div className="card-h"><h3>آخر مهام Claude</h3><a className="small" href="#/jobs">كل المهام</a></div><JobList jobs={jobs.slice(0, 6)} compact /></div>;
}

export { useAsync };
