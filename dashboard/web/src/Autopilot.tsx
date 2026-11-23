import { useMemo, useRef, useState } from 'react';
import { api, upload, href, fmtSize, usePipeline, usePipelines, useJobs, type Config, type Pipeline, type ProductFull } from './api';
import { toast } from './Edit';
import { useRunner, CliWarning } from './Jobs';

const STATE_LABEL: Record<string, string> = { pending: 'لسه', running: 'شغالة', gate: 'مستنية موافقتك', done: 'خلصت', skipped: 'اتخطت' };
const P_STATUS: Record<string, string> = { running: 'شغال', waiting: 'مستني قرارك', paused: 'متوقف مؤقتًا', done: 'خلص', cancelled: 'اتلغى' };

// ---------- اختيار الخطة ----------
type Stg = { id: string; label: string; gate?: string; group: string };
export function PlanPicker({ stages, cfg, value, onChange }: { stages: Stg[]; cfg: Config; value: { stages: string[]; pause: string[] }; onChange: (v: { stages: string[]; pause: string[] }) => void }) {
  const ap = cfg.autopilot!;
  const presetOf = Object.entries(ap.presets).find(([, p]) => p.stages.length === value.stages.length && p.stages.every(s => value.stages.includes(s)))?.[0] || '';
  const toggle = (list: string[], id: string) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  return (
    <div className="plan-picker">
      <div className="seg sm wrap">
        {Object.entries(ap.presets).map(([k, p]) => <button key={k} type="button" className={presetOf === k ? 'on' : ''} onClick={() => onChange({ stages: p.stages, pause: value.pause })}>{p.label}</button>)}
      </div>
      <ul className="plan-list">
        {stages.map(s => {
          const on = value.stages.includes(s.id);
          return (
            <li key={s.id} className={on ? 'on' : ''}>
              <label className="chk"><input type="checkbox" checked={on} onChange={() => onChange({ ...value, stages: toggle(value.stages, s.id) })} /> {s.label}</label>
              {on && <label className="chk small muted" title={s.gate || 'يقف يستنى موافقتك قبل المرحلة دي'}><input type="checkbox" checked={value.pause.includes(s.id)} onChange={() => onChange({ ...value, pause: toggle(value.pause, s.id) })} /> ⏸ يستنى موافقتي{s.gate ? ` (${s.gate})` : ''}</label>}
            </li>
          );
        })}
      </ul>
      <p className="muted small">كل مرحلة: تشغيل ← مراجعة QA ← لو فيه ملاحظات يعدّل لحد {ap.maxFixRounds} جولات ← لو لسه فيه ملاحظات يقف ويستنى قرارك. البوستات والتصاميم والريلز بتتعمل على دفعات {ap.batchDays} أيام. الحد الأقصى للصرف ${ap.maxTotalUsd} وبعدها بيقف.</p>
    </div>
  );
}

function defaultPlan(cfg: Config, stages: Stg[]) {
  const ap = cfg.autopilot!;
  return { stages: ap.presets[ap.defaultPreset]?.stages || stages.map(s => s.id), pause: stages.filter(s => s.gate).map(s => s.id) };
}

// ---------- لوحة الشغل الأوتوماتيك في صفحة المنتج ----------
export function AutopilotPanel({ p, config }: { p: ProductFull; config: Config }) {
  const pipe = usePipeline(p.slug);
  const { info, refresh } = useRunner();
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState(() => defaultPlan(config, p.stages));
  const [busy, setBusy] = useState(false);
  if (!config.autopilot || pipe === undefined) return null;
  const active = pipe && ['running', 'waiting', 'paused'].includes(pipe.status);

  const start = async () => {
    setBusy(true);
    try { await api.startPipeline(p.slug, { stages: plan.stages, pauseBefore: plan.pause }); toast('الشغل الأوتوماتيك بدأ'); setPlanning(false); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  if (!active && !planning) {
    return (
      <div className="card autopilot idle">
        <div className="ap-idle">
          <div>
            <h3>الشغل الأوتوماتيك</h3>
            <p className="muted small">{pipe?.status === 'done' ? `آخر مرة خلص · صرف $${pipe.spent.toFixed(2)}` : pipe?.status === 'cancelled' ? 'آخر مرة اتلغى' : 'Claude يمشي على كل المراحل لوحده بالترتيب، مع مراجعة QA بعد كل خطوة، ويقف يستناك بس لما يحتاج قرار.'}</p>
          </div>
          <button type="button" className="btn" disabled={!info?.cli.loggedIn} onClick={() => setPlanning(true)}>▶ ابدأ الشغل</button>
        </div>
        <CliWarning info={info} refresh={refresh} />
      </div>
    );
  }
  if (!active && planning) {
    return (
      <div className="card autopilot">
        <h3>ابدأ الشغل الأوتوماتيك — {p.name}</h3>
        <PlanPicker stages={p.stages} cfg={config} value={plan} onChange={setPlan} />
        <div className="row"><span className="spacer" /><button type="button" className="btn ghost" onClick={() => setPlanning(false)}>إلغاء</button><button type="button" className="btn" disabled={busy || !plan.stages.length} onClick={start}>ابدأ ({plan.stages.length} مرحلة)</button></div>
      </div>
    );
  }
  return <PipelineView pipe={pipe!} />;
}

function PipelineView({ pipe }: { pipe: Pipeline }) {
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const jobs = useJobs(pipe.slug);
  const cmd = async (c: string, body: Record<string, unknown> = {}, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try { await api.pipelineCmd(pipe.slug, c, body); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const w = pipe.waiting;
  const wItem = w?.stage ? pipe.plan.find(x => x.stage === w.stage) : null;
  const curJob = pipe.current ? (jobs || []).find(j => j.id === pipe.current!.jobId) : null;
  const pct = Math.min(100, Math.round((pipe.spent / pipe.maxUsd) * 100));

  return (
    <div className={`card autopilot ap-${pipe.status}`}>
      <div className="card-h">
        <h3>الشغل الأوتوماتيك <span className={`pstat ps-${pipe.status}`}>{pipe.status === 'running' && <span className="spinner" />}{P_STATUS[pipe.status]}</span></h3>
        <div className="row">
          {pipe.status === 'running' && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => cmd('pause')}>⏸ إيقاف مؤقت</button>}
          {pipe.status === 'paused' && <button type="button" className="btn sm" disabled={busy} onClick={() => cmd('resume')}>▶ كمّل</button>}
          {pipe.status !== 'done' && <button type="button" className="btn ghost sm danger" disabled={busy} onClick={() => cmd('cancel', {}, 'تلغي الشغل الأوتوماتيك؟ المهمة الحالية هتتوقف، واللي خلص يفضل زي ما هو.')}>إلغاء</button>}
        </div>
      </div>

      <ol className="ap-plan">
        {pipe.plan.map(i => (
          <li key={i.stage} className={`aps-${i.state}${pipe.current?.stage === i.stage ? ' cur' : ''}`} title={STATE_LABEL[i.state]}>
            <span className="ap-dot" />
            <span className="ap-l">{i.label}</span>
            {i.batches > 0 && <span className="muted small">{i.batches} دفعة</span>}
            {i.rounds > 0 && <span className="muted small">تعديل {i.rounds}</span>}
            {i.pause && i.state === 'pending' && <span className="muted small">⏸</span>}
          </li>
        ))}
      </ol>

      {pipe.current && (
        <a className="job-active" href={href({ page: 'jobs', id: pipe.current.jobId })}>
          <span className="spinner" /> {pipe.plan.find(x => x.stage === pipe.current!.stage)?.label}: {({ run: 'تشغيل', fix: 'تعديل', qa: 'مراجعة QA' } as Record<string, string>)[pipe.current.phase]}{pipe.current.days ? ` · أيام ${pipe.current.days}` : ''} {curJob?.status === 'queued' ? '(في الطابور)' : ''}
          <span className="muted">افتح السجل اللايف</span>
        </a>
      )}

      {w && pipe.status === 'waiting' && (
        <div className={`ap-wait aw-${w.type}`}>
          <strong>{w.type === 'gate' ? '⏸ مستني موافقتك' : w.type === 'decision' ? '🤔 محتاج قرارك' : w.type === 'budget' ? '💰 وصلنا لحد الميزانية' : '⚠️ حصلت مشكلة'}</strong>
          <p>{w.message}</p>
          {w.jobId && <a href={href({ page: 'jobs', id: w.jobId })}>افتح تقرير QA</a>}
          {w.type === 'decision' && <textarea className="input full" rows={2} value={extra} onChange={e => setExtra(e.target.value)} placeholder="(اختياري) تعليمات للجولة الجاية من التعديل" />}
          <div className="row">
            {w.type === 'gate' && <>
              <button type="button" className="btn" disabled={busy} onClick={() => cmd('continue')}>✓ وافق وكمّل</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => cmd('skip-stage', { stage: w.stage }, `تتخطّى «${wItem?.label}»؟`)}>اتخطّى المرحلة دي</button>
            </>}
            {w.type === 'decision' && wItem && <>
              <button type="button" className="btn" disabled={busy} onClick={() => cmd('approve-stage', { stage: w.stage })}>✓ اعتمدها زي ما هي</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => { cmd('fix-again', { stage: w.stage, extra }); setExtra(''); }}>✎ جولة تعديل كمان</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => cmd('skip-stage', { stage: w.stage }, `تتخطّى «${wItem.label}»؟`)}>اتخطّى</button>
            </>}
            {w.type === 'decision' && !wItem && <button type="button" className="btn" disabled={busy} onClick={() => cmd('continue')}>كمّل</button>}
            {(w.type === 'error' || w.type === 'budget') && <button type="button" className="btn" disabled={busy} onClick={() => cmd('continue')}>▶ كمّل{w.type === 'budget' ? ' (وزوّد الحد)' : ''}</button>}
          </div>
        </div>
      )}

      <div className="ap-foot">
        <span className="muted small">صرف ${pipe.spent.toFixed(2)} من ${pipe.maxUsd}</span>
        <div className="progress"><div style={{ width: pct + '%' }} /></div>
      </div>
      <details>
        <summary>سجل الخطوات ({pipe.events.length})</summary>
        <ul className="ap-events">{[...pipe.events].reverse().slice(0, 40).map((e, i) => <li key={i} className={`ae-${e.kind}`}><span className="muted small">{new Date(e.t).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</span> {e.text}</li>)}</ul>
      </details>
    </div>
  );
}

// ---------- منتجات محتاجة قرارك (الصفحة الرئيسية) ----------
export function WaitingBanner() {
  const list = usePipelines();
  const waiting = (list || []).filter(p => p.status === 'waiting');
  const running = (list || []).filter(p => p.status === 'running');
  if (!waiting.length && !running.length) return null;
  return (
    <section className="card ap-banner">
      {waiting.length > 0 && <>
        <h3>🤔 محتاج قرارك ({waiting.length})</h3>
        <ul>{waiting.map(p => <li key={p.slug}><a href={href({ page: 'product', slug: p.slug, tab: 'overview' })}><strong>{p.name}</strong></a> — {p.waiting?.message}</li>)}</ul>
      </>}
      {running.length > 0 && <p className="muted small"><span className="spinner" /> شغال أوتوماتيك دلوقتي: {running.map(p => p.name).join('، ')}</p>}
    </section>
  );
}

// ---------- منتج جديد: ارفع الكتاب وابدأ ----------
export function NewProductWizard({ config, series, onClose }: { config: Config; series: string[]; onClose: () => void }) {
  const stages: Stg[] = config.stages;
  const [f, setF] = useState({ name: '', series: '', type: Object.keys(config.productTypes)[0], status: 'active' });
  const [files, setFiles] = useState<File[]>([]);
  const [main, setMain] = useState<string>('');
  const [auto, setAuto] = useState(true);
  const [plan, setPlan] = useState(() => defaultPlan(config, stages));
  const [progress, setProgress] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { info } = useRunner();
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const add = (list: FileList | File[]) => {
    const next = [...files, ...[...list].filter(n => !files.some(o => o.name === n.name))];
    setFiles(next);
    if (!main && next.length) {
      const guess = next.filter(x => /\.(pdf|docx|epub|md)$/i.test(x.name)).sort((a, b) => (/كتاب|الكتاب|الدليل|book/i.test(b.name) ? 1 : 0) - (/كتاب|الكتاب|الدليل|book/i.test(a.name) ? 1 : 0) || b.size - a.size)[0];
      if (guess) setMain(guess.name);
    }
  };
  const canAuto = !!config.autopilot && !!info?.cli.loggedIn;
  const totalSize = useMemo(() => files.reduce((s, x) => s + x.size, 0), [files]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length && !confirm('مفيش ملفات للكتاب. تسجّل المنتج من غير ملفات وترفعها بعدين؟')) return;
    try {
      setProgress('بسجّل المنتج…');
      const r = await api.createProduct({ ...f, series: f.series || null });
      const slug = r.product.slug;
      const source = (r.product as any).source as string;
      let mainPath = '';
      for (const [i, file] of files.entries()) {
        setProgress(`برفع ${i + 1} من ${files.length}: ${file.name}`);
        const res = await upload(source, file, pct => setProgress(`برفع ${i + 1} من ${files.length}: ${file.name} (${pct}%)`));
        if (file.name === main) mainPath = res.path;
      }
      if (mainPath) await api.updateMeta(slug, { mainFile: mainPath });
      if (auto && canAuto) {
        setProgress('ببدأ الشغل الأوتوماتيك…');
        await api.startPipeline(slug, { stages: plan.stages, pauseBefore: plan.pause });
        toast('المنتج اتسجل والشغل الأوتوماتيك بدأ 🚀');
      } else toast('المنتج اتسجل ✓');
      onClose();
      location.hash = href({ page: 'product', slug, tab: 'overview' });
    } catch (err: any) { toast(err.message, 'err'); setProgress(null); }
  };

  return (
    <form className="card form wizard" onSubmit={submit}>
      <h3>منتج جديد</h3>
      <div className="form-grid">
        <label className="wide">اسم المنتج<input className="input" value={f.name} onChange={up('name')} required autoFocus placeholder="مثلاً: شفرة الستات" /></label>
        <label>السلسلة<input className="input" value={f.series} onChange={up('series')} list="series-list" placeholder="من غير" /></label>
        <label>النوع<select className="input" value={f.type} onChange={up('type')}>{Object.entries(config.productTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      </div>
      <datalist id="series-list">{series.map(s => <option key={s} value={s} />)}</datalist>

      <div className={`uploader big${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <div className="up-row">
          <button type="button" className="btn ghost" onClick={() => input.current?.click()}>⇪ اختار ملفات الكتاب</button>
          <span className="muted small">أو اسحبها هنا — الكتاب نفسه + البونصات/الهدايا (PDF, Word, Markdown, فيديو…)</span>
          <input ref={input} type="file" multiple hidden onChange={e => { add(e.target.files || []); e.target.value = ''; }} />
        </div>
        {files.length > 0 && (
          <ul className="wz-files">
            {files.map(x => (
              <li key={x.name}>
                <label className="chk" title="ده الكتاب الأساسي"><input type="radio" name="main" checked={main === x.name} onChange={() => setMain(x.name)} /> {main === x.name ? <strong>الكتاب الأساسي</strong> : <span className="muted small">أساسي؟</span>}</label>
                <span className="file-name">{x.name}</span>
                <span className="muted small">{fmtSize(x.size)}</span>
                <button type="button" className="icon-btn" onClick={() => { setFiles(fs => fs.filter(y => y !== x)); if (main === x.name) setMain(''); }} aria-label="شيل">✕</button>
              </li>
            ))}
            <li className="muted small">{files.length} ملف · {fmtSize(totalSize)}</li>
          </ul>
        )}
      </div>

      {config.autopilot && (
        <div className="wz-auto">
          <label className="chk"><input type="checkbox" checked={auto && canAuto} disabled={!canAuto} onChange={e => setAuto(e.target.checked)} /> <strong>ابدأ الشغل الأوتوماتيك على طول</strong>{!canAuto && <span className="muted small"> (محتاج الـ claude CLI يكون عامل login)</span>}</label>
          {auto && canAuto && <PlanPicker stages={stages} cfg={config} value={plan} onChange={setPlan} />}
        </div>
      )}

      {progress && <div className="job-active"><span className="spinner" /> {progress}</div>}
      <div className="row"><span className="spacer" /><button type="button" className="btn ghost" disabled={!!progress} onClick={onClose}>إلغاء</button><button className="btn" disabled={!!progress || !f.name.trim()}>{auto && canAuto ? '🚀 سجّل وابدأ الشغل' : 'سجّل المنتج'}</button></div>
    </form>
  );
}

