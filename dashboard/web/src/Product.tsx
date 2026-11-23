import { useMemo, useState } from 'react';
import { href, fileUrl, fmtDate, DONE, useLiveVersion, api, type ProductFull, type Stage, type FileInfo, type Day, type Config } from './api';
import { ProductCtx, StageStatusEditor, Uploader, NewFileButton, MetaEditor, toast } from './Edit';
import { RunPanel, ProductJobs } from './Jobs';
import { AutopilotPanel } from './Autopilot';
import { ProductResults } from './Results';
import { ProductTasks, StageOwner } from './Tasks';
import { StatusBadge, FileViewer, FileList, Empty, Progress, STATUS_LABEL, KIND_LABEL } from './ui';

type Props = { p: ProductFull; tab: string; file?: string; config: Config };

const STATUS_PILL: Record<string, string> = { active: 'شغال', paused: 'متوقف', archived: 'مؤرشف', planned: 'مخطط' };

export function Product({ p, tab, file, config }: Props) {
  const go = (t: string, f?: string) => { location.hash = href({ page: 'product', slug: p.slug, tab: t, file: f }); };
  const color = p.brand?.hex || '#5A5246';
  const stage = p.stages.find(s => s.id === tab);
  const groups = useMemo(() => {
    const g: Record<string, Stage[]> = {};
    for (const s of p.stages) (g[s.group] ||= []).push(s);
    return Object.entries(g);
  }, [p.stages]);

  const ctx = useMemo(() => ({ slug: p.slug, reviews: p.reviews || {} }), [p.slug, p.reviews]);
  return (
    <ProductCtx.Provider value={ctx}>
    <div className="page product" style={{ ['--pc' as string]: color }}>
      <header className="phead">
        <div className="phead-main">
          <a href="#/" className="back">→ كل المنتجات</a>
          <h1>{p.name}</h1>
          <div className="phead-meta">
            <span className={`pill ps-${p.status}`}>{STATUS_PILL[p.status] || p.status}</span>
            <span>{p.typeLabel}</span>
            {p.series && <span>سلسلة {p.series}</span>}
            {p.brand?.token ? <span className="swatch"><i style={{ background: color }} />{p.brand.token} <code dir="ltr">{p.brand.hex}</code></span> : <span>من غير لون مخصص</span>}
            <span>آخر تعديل {fmtDate(p.lastUpdate)}</span>
          </div>
        </div>
        <div className="phead-side">
          <div className="big-num">{p.doneCount}<small>/{p.totalStages}</small></div>
          <div className="muted">مرحلة مكتملة</div>
          <Progress done={p.doneCount} total={p.totalStages} />
          {p.mainFile && <a className="btn light" href={fileUrl(p.mainFile)} target="_blank" rel="noreferrer">افتح الكتاب</a>}
        </div>
      </header>

      <nav className="pipeline" aria-label="مراحل خط الإنتاج">
        {p.stages.map((s, i) => (
          <a key={s.id} href={href({ page: 'product', slug: p.slug, tab: s.id })} className={`step st-${s.status}${tab === s.id ? ' current' : ''}`} title={`${STATUS_LABEL[s.status]}${s.detail ? ' — ' + s.detail : ''}`}>
            <span className="step-n">{i + 1}</span>
            <span className="step-l">{s.label}</span>
          </a>
        ))}
      </nav>

      <div className="pbody">
        <aside className="side">
          <SideLink on={tab === 'overview'} onClick={() => go('overview')}>نظرة عامة</SideLink>
          <SideLink on={tab === 'source'} onClick={() => go('source')} count={p.sourceFiles.length}>ملفات الكتاب (المصدر)</SideLink>
          {groups.map(([g, ss]) => (
            <div key={g} className="side-group">
              <div className="side-h">{g}</div>
              {ss.map(s => (
                <SideLink key={s.id} on={tab === s.id} onClick={() => go(s.id)} count={s.fileCount} status={s.status}>{s.label}</SideLink>
              ))}
            </div>
          ))}
          <div className="side-group">
            <div className="side-h">تاني</div>
            <SideLink on={tab === 'results'} onClick={() => go('results')}>النتايج والمبيعات</SideLink>
            <SideLink on={tab === 'other'} onClick={() => go('other')} count={p.otherFiles.length}>ملفات مش متصنفة</SideLink>
            <SideLink on={tab === 'all'} onClick={() => go('all')} count={p.files.length}>كل ملفات الكامبين</SideLink>
          </div>
        </aside>

        <main className="content">
          {tab === 'overview' && <Overview p={p} go={go} config={config} />}
          {tab === 'source' && <FilesPane title="ملفات الكتاب (المصدر)" subtitle={p.source || 'مفيش فولدر مصدر'} files={sortSource(p.sourceFiles, p.mainFile)} file={file} base={p.source || ''} onOpen={f => go('source', f)} onClear={() => go('source')} highlight={p.mainFile}
            tools={p.source ? <Uploader dir={p.source} subdirs={subdirsOf(p.sourceFiles)} label="ارفع الكتاب أو البونصات" /> : null} />}
          {tab === 'other' && <FilesPane title="ملفات مش متصنفة" subtitle="ملفات في الكامبين مش تبع أي مرحلة في pipeline.config.json" files={p.otherFiles} file={file} base={`campaigns/${p.slug}`} onOpen={f => go('other', f)} onClear={() => go('other')} />}
          {tab === 'all' && <FilesPane title="كل ملفات الكامبين" subtitle={`campaigns/${p.slug}/`} files={p.files} file={file} base={`campaigns/${p.slug}`} onOpen={f => go('all', f)} onClear={() => go('all')}
            tools={<Uploader dir={`campaigns/${p.slug}`} subdirs={subdirsOf(p.files)} />} />}
          {tab === 'results' && <ProductResults slug={p.slug} csvPath={f => go('all', f)} />}
          {stage && <StageView p={p} s={stage} file={file} go={go} />}
          {!stage && !['overview', 'source', 'other', 'all', 'results'].includes(tab) && <Empty>التاب ده مش موجود.</Empty>}
        </main>
      </div>
    </div>
    </ProductCtx.Provider>
  );
}

function SideLink({ on, onClick, children, count, status }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number; status?: string }) {
  return (
    <button type="button" className={`side-link${on ? ' on' : ''}`} onClick={onClick}>
      {status && <i className={`dot sm st-${status}`} />}
      <span className="sl-label">{children}</span>
      {count != null && count > 0 && <span className="count">{count}</span>}
    </button>
  );
}

function subdirsOf(files: FileInfo[]) {
  return [...new Set(files.map(f => f.inner.split('/').slice(0, -1).join('/')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
}

function sortSource(files: FileInfo[], main: string | null) {
  return [...files].sort((a, b) => (a.path === main ? -1 : b.path === main ? 1 : a.inner.localeCompare(b.inner, 'ar')));
}

// ---------- Overview ----------
function Overview({ p, go, config }: { p: ProductFull; go: (t: string, f?: string) => void; config: Config }) {
  const [editing, setEditing] = useState(false);
  const recent = [...p.files].sort((a, b) => b.mtime - a.mtime).slice(0, 8);
  const partial = p.stages.filter(s => s.status === 'partial');
  return (
    <div className="stack">
      <AutopilotPanel p={p} config={config} />
      {editing && <MetaEditor p={p} config={config} onClose={() => setEditing(false)} />}
      {p.warnings.length > 0 && (
        <div className="card notice">
          <h3>محتاج انتباه</h3>
          <ul>{p.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <div className="two">
        <div className="card">
          <h3>الخطوة الجاية</h3>
          {p.next ? (
            <>
              <p className="lead">{p.next.label}</p>
              <p className="muted">الـ Skill: <code dir="ltr">{p.next.skill}</code></p>
              <button type="button" className="btn" onClick={() => go(p.next!.id)}>افتح المرحلة</button>
            </>
          ) : <p className="lead">كل المراحل خلصت 🎉</p>}
        </div>
        <div className="card">
          <div className="card-h"><h3>ملخص</h3>{!editing && <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>✎ تعديل البيانات</button>}</div>
          <dl className="kv">
            <dt>الملف الأساسي</dt><dd>{p.mainFile ? <button type="button" className="linkish" onClick={() => go('source', p.mainFile!)}>{p.mainFile.split('/').pop()}</button> : <span className="muted">مش محدد</span>}</dd>
            <dt>ملفات المصدر</dt><dd>{p.sourceFiles.length}</dd>
            <dt>ملفات الكامبين</dt><dd>{p.files.length} {Object.entries(p.counts).map(([k, v]) => <span key={k} className="muted"> · {v} {KIND_LABEL[k] || k}</span>)}</dd>
            <dt>أيام خطة المحتوى</dt><dd>{p.calendarDays || '—'}</dd>
            <dt>بداية النشر</dt><dd>{p.launchDate ? <a href="#/calendar">{p.launchDate}</a> : <span className="muted">مش محدد — من «تعديل البيانات»</span>}</dd>
            {p.notes && <><dt>ملاحظات</dt><dd>{p.notes}</dd></>}
          </dl>
        </div>
      </div>

      <div className="card">
        <h3>كل المراحل</h3>
        <table className="table stages">
          <thead><tr><th>المرحلة</th><th>الحالة</th><th>التفاصيل</th><th>الـ Skill</th></tr></thead>
          <tbody>
            {p.stages.map(s => (
              <tr key={s.id} onClick={() => go(s.id)} className="clickable">
                <td><strong>{s.label}</strong><div className="muted small">{s.group}</div></td>
                <td><StatusBadge status={s.status} /></td>
                <td className="small">
                  {s.progress?.total ? <div className="inline-prog"><Progress done={s.progress.done} total={s.progress.total} /> {s.detail}</div> : s.detail}
                  {s.blockedBy.length > 0 && <div className="muted">مستني: {s.blockedBy.map(id => p.stages.find(x => x.id === id)?.label).join('، ')}</div>}
                  {s.gate && !DONE.includes(s.status) && <div className="gate">⏸ {s.gate}</div>}
                </td>
                <td><code dir="ltr" className="small">{s.skill}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProductTasks slug={p.slug} stages={p.stages} />
      <ProductJobs slug={p.slug} />
      {partial.length > 0 && (
        <div className="card">
          <h3>مراحل فيها شغل بس مش بالشكل القياسي</h3>
          <p className="muted">فيه ملفات في فولدر المرحلة، لكن الملف اللي الـ Skill المفروض يطلّعه مش موجود. اعرضها وقرر لو محتاجة تتعمل من جديد.</p>
          <ul>{partial.map(s => <li key={s.id}><button type="button" className="linkish" onClick={() => go(s.id)}>{s.label}</button> — {s.detail}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h3>آخر ملفات اتعدلت</h3>
        {recent.length ? (
          <ul className="recent">
            {recent.map(f => {
              const st = p.stages.find(s => s.dir && f.inner.startsWith(s.dir + '/')) || p.stages.find(s => s.outputs?.includes(f.inner));
              return <li key={f.path}><button type="button" className="linkish" onClick={() => go(st?.id || 'all', f.path)}>{f.inner}</button><span className="muted"> · {st?.label || 'غير مصنف'} · {fmtDate(f.mtime)}</span></li>;
            })}
          </ul>
        ) : <Empty>مفيش ملفات كامبين لسه.</Empty>}
      </div>
    </div>
  );
}

// ---------- Files pane (list + viewer) ----------
function FilesPane({ title, subtitle, files, file, onOpen, onClear, base, highlight, tools }: { title: string; subtitle?: string; files: FileInfo[]; file?: string; onOpen: (p: string) => void; onClear: () => void; base: string; highlight?: string | null; tools?: React.ReactNode }) {
  const current = files.find(f => f.path === file) || (file ? { path: file } : undefined);
  return (
    <div className="stack">
      <div className="section-h"><h2>{title}</h2>{subtitle && <span className="muted" dir="auto">{subtitle}</span>}</div>
      {tools}
      <div className="split">
        <div className="split-list">
          <FileList files={files} active={file || highlight || undefined} onOpen={f => onOpen(f.path)} base={base} />
        </div>
        <div className="split-view">
          {current ? <FileViewer key={current.path} file={current} onDeleted={onClear} /> : <Empty>اختار ملف من القايمة عشان تعرضه.</Empty>}
        </div>
      </div>
    </div>
  );
}

// ---------- Stage ----------
function StageView({ p, s, file, go }: { p: ProductFull; s: Stage; file?: string; go: (t: string, f?: string) => void }) {
  const base = `campaigns/${p.slug}`;
  const stageFiles = s.files || [];
  const outputs = (s.outputs || []).map(o => ({ rel: o, path: `${base}/${o}`, exists: p.files.some(f => f.inner === o) }));
  const dayMode = file?.startsWith('day:');
  const autoFile = file || (s.kind === 'single' ? outputs.find(o => o.exists)?.path || stageFiles.find(f => f.kind === 'text')?.path : undefined);
  const open = (f?: string) => go(s.id, f);

  return (
    <div className="stack">
      <div className="card stage-head">
        <div className="stage-title">
          <h2>{s.label}</h2>
          <StatusBadge status={s.status} />
        </div>
        <div className="stage-meta">
          <span>الـ Skill: <code dir="ltr">{s.skill}</code></span>
          <StageOwner slug={p.slug} stage={s.id} />
          {s.dir && <span>الفولدر: <code>{s.dir}/</code></span>}
          {s.dependsOn.length > 0 && <span>بتعتمد على: {s.dependsOn.map(id => {
            const d = p.stages.find(x => x.id === id);
            return <button key={id} type="button" className={`chip st-${d?.status}`} onClick={() => go(id)}>{d?.label || id}</button>;
          })}</span>}
        </div>
        {s.detail && <p className="muted">{s.detail}</p>}
        {s.gate && <p className="gate">⏸ {s.gate}</p>}
        <StageStatusEditor slug={p.slug} s={s} />
        {outputs.length > 0 && (
          <div className="outputs">
            {outputs.map(o => (
              <button key={o.rel} type="button" className={`output ${o.exists ? 'ok' : 'no'}`} disabled={!o.exists} onClick={() => open(o.path)}>
                <span>{o.exists ? '✓' : '○'}</span><code>{o.rel}</code>{!o.exists && <span className="muted"> — لسه</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <RunPanel key={s.id} p={p} s={s} />
      {s.id === 'calendar' && p.calendar && <CalendarTable p={p} go={go} />}
      {s.kind === 'perDay' && <DayBoard p={p} s={s} active={file} go={go} />}
      {s.kind === 'perDay' && dayMode && <DayView p={p} day={Number(file!.slice(4))} onClose={() => open()} go={go} />}
      {s.id === 'visuals' && <Gallery files={stageFiles.filter(f => f.kind === 'image')} onOpen={f => open(f.path)} />}
      {s.kind === 'collection' && <Collection files={stageFiles} dir={s.dir} />}

      {!dayMode && (
        <div className="tools">
          <Uploader dir={s.dir ? `${base}/${s.dir}` : base} subdirs={subdirsOf(stageFiles.map(f => ({ ...f, inner: s.dir ? f.inner.slice(s.dir.length + 1) : f.inner })))} />
          {s.kind !== 'collection' && <NewFileButton dir={s.dir ? `${base}/${s.dir}` : base} onCreated={f => open(f)} />}
        </div>
      )}
      {!dayMode && (
        <div className="split">
          <div className="split-list">
            <div className="list-h">ملفات المرحلة ({stageFiles.length})</div>
            <FileList files={stageFiles} active={autoFile} onOpen={f => open(f.path)} base={`${base}/${s.dir}`} />
          </div>
          <div className="split-view">
            {autoFile ? <FileViewer key={autoFile} file={stageFiles.find(f => f.path === autoFile) || { path: autoFile }} onDeleted={() => open()} />
              : <Empty>{stageFiles.length ? 'اختار ملف من القايمة.' : s.status === 'blocked' ? 'المرحلة دي مستنية المراحل اللي قبلها.' : 'المرحلة دي لسه متعملتش.'}</Empty>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Calendar ----------
const COL_LABEL: Record<string, string> = { week: 'أسبوع', day: 'يوم', type: 'النوع', goal: 'الهدف', hook: 'الهوك', format: 'الصيغة', cta: 'CTA' };

function CalendarTable({ p, go }: { p: ProductFull; go: (t: string, f?: string) => void }) {
  const cal = p.calendar!;
  const cols = cal.headers.filter(h => !['week'].includes(h));
  return (
    <div className="card">
      <h3>خطة المحتوى — {cal.days.length} يوم</h3>
      <div className="table-wrap">
        <table className="table cal">
          <thead><tr>{cols.map(h => <th key={h}>{COL_LABEL[h] || h}</th>)}<th>بوست</th><th>تصميم</th><th>ريل</th></tr></thead>
          <tbody>
            {cal.days.map(d => (
              <tr key={d.day} className={`clickable wk-${(d.week || 0) % 2}`} onClick={() => go('copy', `day:${d.day}`)}>
                {cols.map(h => <td key={h} className={h === 'hook' ? 'hook' : ''}>{d.row[h]}</td>)}
                <td><Tick ok={!!d.copy} /></td><td><Tick ok={d.visuals.length > 0} /></td><td><Tick ok={d.reels.length > 0} na={!/ريل|reel|فيديو/i.test(d.row.format || '')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tick({ ok, na }: { ok: boolean; na?: boolean }) {
  if (ok) return <span className="tick ok" title="موجود">●</span>;
  if (na) return <span className="tick na" title="مش مطلوب للصيغة دي">–</span>;
  return <span className="tick no" title="لسه">○</span>;
}

function DayBoard({ p, s, active, go }: { p: ProductFull; s: Stage; active?: string; go: (t: string, f?: string) => void }) {
  if (!p.calendar) return <Empty>مفيش خطة محتوى (calendar.csv) عشان الأيام تتربط بيها.</Empty>;
  const weeks: Record<string, Day[]> = {};
  for (const d of p.calendar.days) (weeks[d.week ?? '—'] ||= []).push(d);
  const has = (d: Day) => s.match === 'folder' ? d.visuals.length > 0 : !!d.copy;
  return (
    <div className="card">
      <h3>الأيام</h3>
      {Object.entries(weeks).map(([w, ds]) => (
        <div key={w} className="week">
          <div className="week-h">الأسبوع {w}</div>
          <div className="days">
            {ds.map(d => (
              <button key={d.day} type="button" className={`daycell ${has(d) ? 'ok' : 'no'}${active === `day:${d.day}` ? ' on' : ''}`} onClick={() => go(s.id, `day:${d.day}`)} title={d.row.hook}>
                <span className="dn">يوم {d.day}</span>
                <span className="dt">{d.row.type}</span>
                <span className="df muted">{d.row.format}</span>
                <span className="dflags"><i className={d.copy ? 'on' : ''} title="بوست">ب</i><i className={d.visuals.length ? 'on' : ''} title="تصميم">ت</i><i className={d.reels.length ? 'on' : ''} title="ريل">ر</i></span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayView({ p, day, onClose, go }: { p: ProductFull; day: number; onClose: () => void; go: (t: string, f?: string) => void }) {
  useLiveVersion();
  const d = p.calendar?.days.find(x => x.day === day);
  if (!d) return <Empty>اليوم ده مش موجود في الخطة.</Empty>;
  const vis = d.visuals.map(v => p.files.find(f => f.path === v)!).filter(Boolean);
  const images = vis.filter(f => f.kind === 'image');
  const texts = vis.filter(f => f.kind === 'text');
  // الأسماء المتوقعة حسب بنية الـ Skills: 01-copy/week-N/day-N-<وصف>.md و 02-visuals/week-N/day-N-<وصف>/
  const wk = `week-${d.week || 1}`;
  const stem = d.copy ? d.copy.split('/').pop()!.replace(/\.md$/, '')
    : vis[0] ? vis[0].path.split('/').slice(-2, -1)[0]
    : `day-${d.day}-${(d.row.hook || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).slice(0, 5).join('-')}`.replace(/-$/, '');
  const visDir = vis[0] ? vis[0].path.split('/').slice(0, -1).join('/') : `campaigns/${p.slug}/02-visuals/${wk}/${stem}`;
  const createCopy = async () => {
    const tpl = `# يوم ${d.day} — أسبوع ${d.week || 1} — ${d.row.type || ''}\n\n**الهدف:** ${d.row.goal || ''}\n**الصيغة:** ${d.row.format || ''}\n**الهوك:** ${d.row.hook || ''}\n\n---\n\n\n\n---\n\n**CTA:** ${d.row.cta || ''}\n`;
    try { const r = await api.newFile(`campaigns/${p.slug}/01-copy/${wk}`, `${stem}.md`, tpl); toast('ملف البوست اتعمل ✓ — دوس «تعديل» واكتب'); go('copy', `day:${d.day}`); void r; }
    catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <div className="card dayview">
      <div className="dayview-h">
        <div>
          <h3>يوم {d.day}{d.week ? ` · الأسبوع ${d.week}` : ''} — {d.row.type}</h3>
          <p className="lead">«{d.row.hook}»</p>
          <p className="muted">الهدف: {d.row.goal} · الصيغة: {d.row.format} · CTA: {d.row.cta}</p>
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>✕ قفل اليوم</button>
      </div>
      <div className="day-grid">
        <div>
          <div className="list-h">البوست</div>
          {d.copy ? <FileViewer key={d.copy} compact file={p.files.find(f => f.path === d.copy) || { path: d.copy }} />
            : <Empty>البوست لسه متكتبش (book-launch-writer).<div className="row center"><button type="button" className="btn" onClick={createCopy}>+ اكتبه بنفسك هنا</button></div></Empty>}
        </div>
        <div>
          <div className="list-h">التصميم</div>
          {images.length > 0 && <div className="gallery small">{images.map(f => <button key={f.path} type="button" onClick={() => go('visuals', f.path)}><img src={fileUrl(f.path)} alt={f.name} loading="lazy" /></button>)}</div>}
          {texts.map(f => <FileViewer key={f.path} compact file={f} />)}
          {!vis.length && <Empty>مفيش تصميم لليوم ده لسه (book-launch-visual-producer).</Empty>}
          <Uploader dir={visDir} label="ارفع تصميم لليوم ده" />
          {d.reels.length > 0 && <>
            <div className="list-h">الريل</div>
            {d.reels.filter(r => /\.(mp4|webm|mov)$/i.test(r)).map(r => <video key={r} className="media" src={fileUrl(r)} controls preload="metadata" />)}
          </>}
        </div>
      </div>
    </div>
  );
}

function Gallery({ files, onOpen }: { files: FileInfo[]; onOpen: (f: FileInfo) => void }) {
  if (!files.length) return null;
  return (
    <div className="card">
      <h3>معرض الصور ({files.length})</h3>
      <div className="gallery">
        {files.map(f => <button key={f.path} type="button" onClick={() => onOpen(f)} title={f.inner}><img src={fileUrl(f.path)} alt={f.name} loading="lazy" /><span>{f.inner.split('/').slice(-2, -1)[0] || f.name}</span></button>)}
      </div>
    </div>
  );
}

function Collection({ files, dir }: { files: FileInfo[]; dir: string }) {
  const items: Record<string, FileInfo[]> = {};
  for (const f of files) { const k = f.inner.split('/')[1] && f.inner.split('/').length > 2 ? f.inner.split('/')[1] : '(ملفات مباشرة)'; (items[k] ||= []).push(f); }
  const keys = Object.keys(items);
  if (!keys.length) return null;
  return (
    <div className="card">
      <h3>العناصر ({keys.length})</h3>
      <div className="reels">
        {keys.map(k => {
          const fs = items[k];
          const vids = fs.filter(f => f.kind === 'video');
          const imgs = fs.filter(f => f.kind === 'image');
          const readme = fs.find(f => /readme\.md$/i.test(f.name));
          return (
            <div key={k} className="reel">
              <div className="reel-h"><strong>{k}</strong><span className="muted">{dir}/{k}/</span></div>
              <div className="reel-media">
                {vids.map(v => <figure key={v.path}><video src={fileUrl(v.path)} controls preload="metadata" /><figcaption>{v.name}</figcaption></figure>)}
                {imgs.map(v => <figure key={v.path}><img src={fileUrl(v.path)} alt={v.name} /><figcaption>{v.name}</figcaption></figure>)}
              </div>
              {readme && <details><summary>تفاصيل (README)</summary><FileViewer file={readme} /></details>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
