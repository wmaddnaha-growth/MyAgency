import { useMemo, useState } from 'react';
import { href, fmtDate, DONE, type ProductSummary, type Config } from './api';
import { StageDots, StatusBadge, Progress, Empty, STATUS_LABEL } from './ui';
import { NewProductWizard, WaitingBanner } from './Autopilot';
import { usePipelines, type Pipeline } from './api';

type Data = { products: ProductSummary[]; unregisteredSources: { folder: string; suggestedName: string; suggestedSlug: string }[] };

function readPref<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function writePref(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

export function Home({ data, config }: { data: Data; config: Config }) {
  const [view, setView] = useState<'cards' | 'matrix'>(() => readPref('view', 'cards'));
  const [status, setStatus] = useState<string>('all');
  const [series, setSeries] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const pipes = usePipelines();
  const [sort, setSort] = useState<'name' | 'progress' | 'updated'>(() => readPref('sort', 'updated'));

  const all = data.products;
  const seriesList = [...new Set(all.map(p => p.series).filter(Boolean))] as string[];
  const typeList = [...new Set(all.map(p => p.type))];

  const list = useMemo(() => {
    let l = all.filter(p =>
      (status === 'all' || p.status === status) &&
      (series === 'all' || (series === '__none' ? !p.series : p.series === series)) &&
      (type === 'all' || p.type === type) &&
      (!q || (p.name + ' ' + p.slug + ' ' + (p.series || '')).includes(q)));
    l = [...l].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ar')
      : sort === 'progress' ? b.doneCount / b.totalStages - a.doneCount / a.totalStages
      : b.lastUpdate - a.lastUpdate);
    return l;
  }, [all, status, series, type, q, sort]);

  const totalStages = all.reduce((s, p) => s + p.totalStages, 0);
  const doneStages = all.reduce((s, p) => s + p.doneCount, 0);
  const warn = all.filter(p => p.warnings.length).length;
  const active = all.filter(p => p.status === 'active').length;

  // أكتر مرحلة ناقصة على مستوى الشركة
  const stageIds = config.stages.map(s => s.id);

  return (
    <div className="page">
      <section className="stats">
        <Stat label="المنتجات" value={all.length} sub={`${active} شغال`} />
        <Stat label="مراحل مكتملة" value={`${doneStages}/${totalStages}`} sub={<Progress done={doneStages} total={totalStages} />} />
        <Stat label="محتاجة انتباه" value={warn} sub="منتجات فيها تحذيرات" tone={warn ? 'warn' : undefined} />
        <Stat label="مصادر غير مسجلة" value={data.unregisteredSources.length} sub="فولدرات في Books/ من غير كامبين" tone={data.unregisteredSources.length ? 'warn' : undefined} />
      </section>

      <WaitingBanner />
      <section className="toolbar">
        <input className="input" placeholder="فلترة بالاسم…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" value={status} onChange={e => setStatus(e.target.value)} aria-label="الحالة">
          <option value="all">كل الحالات</option>
          {Object.entries(config.productStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={series} onChange={e => setSeries(e.target.value)} aria-label="السلسلة">
          <option value="all">كل السلاسل</option>
          {seriesList.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="__none">من غير سلسلة</option>
        </select>
        {typeList.length > 1 && (
          <select className="input" value={type} onChange={e => setType(e.target.value)} aria-label="النوع">
            <option value="all">كل الأنواع</option>
            {typeList.map(t => <option key={t} value={t}>{config.productTypes[t]?.label || t}</option>)}
          </select>
        )}
        <select className="input" value={sort} onChange={e => { setSort(e.target.value as typeof sort); writePref('sort', e.target.value); }} aria-label="الترتيب">
          <option value="updated">آخر تعديل</option>
          <option value="progress">نسبة الإنجاز</option>
          <option value="name">الاسم</option>
        </select>
        <button type="button" className="btn" onClick={() => setCreating(c => !c)}>+ منتج جديد</button>
        <div className="seg">
          <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => { setView('cards'); writePref('view', 'cards'); }}>كروت</button>
          <button type="button" className={view === 'matrix' ? 'on' : ''} onClick={() => { setView('matrix'); writePref('view', 'matrix'); }}>مصفوفة</button>
        </div>
      </section>

      {creating && <div className="mb"><NewProductWizard config={config} series={seriesList} onClose={() => setCreating(false)} /></div>}
      {!list.length && <Empty>مفيش منتجات بالفلتر ده.</Empty>}

      {view === 'cards' ? (
        <section className="grid">
          {list.map(p => <ProductCard key={p.slug} p={p} pipe={(pipes || []).find(x => x.slug === p.slug && ['running', 'waiting', 'paused'].includes(x.status))} />)}
        </section>
      ) : (
        <section className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th>المنتج</th>
                {stageIds.map(id => <th key={id} className="vert"><span>{config.stages.find(s => s.id === id)?.label}</span></th>)}
                <th>الإنجاز</th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.slug}>
                  <td><a className="mx-name" href={href({ page: 'product', slug: p.slug, tab: 'overview' })}><i style={{ background: p.brand?.hex || 'var(--paper-3)' }} />{p.name}</a></td>
                  {stageIds.map(id => {
                    const s = p.stages.find(x => x.id === id);
                    return <td key={id} className="mx-cell">{s ? <a href={href({ page: 'product', slug: p.slug, tab: id })} className={`dot st-${s.status}`} title={`${s.label}: ${STATUS_LABEL[s.status]}${s.detail ? ' — ' + s.detail : ''}`} /> : <span className="muted">—</span>}</td>;
                  })}
                  <td className="nowrap">{p.doneCount}/{p.totalStages}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Legend />
        </section>
      )}

      {data.unregisteredSources.length > 0 && (
        <section className="card notice">
          <h3>مصادر في Books/ لسه مش متسجلة كمنتج</h3>
          <ul>{data.unregisteredSources.map(s => <li key={s.folder}><code>{s.folder}</code></li>)}</ul>
          <p className="muted">سجّلها بأمر: <code dir="ltr">node dashboard/scripts/new-product.mjs --scan</code></p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'warn' }) {
  return <div className={`stat${tone ? ' ' + tone : ''}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div></div>;
}

export function Legend() {
  return (
    <div className="legend">
      {['done', 'approved', 'partial', 'review', 'needs-fix', 'missing', 'blocked'].map(s => <span key={s}><i className={`dot st-${s}`} />{STATUS_LABEL[s]}</span>)}
    </div>
  );
}

function ProductCard({ p, pipe }: { p: ProductSummary; pipe?: Pipeline }) {
  const color = p.brand?.hex || 'var(--ink-mute)';
  const go = (tab: string) => { location.hash = href({ page: 'product', slug: p.slug, tab }); };
  const pending = p.stages.filter(s => !DONE.includes(s.status));
  return (
    <div className="pcard" style={{ ['--pc' as string]: color }}>
      <div className="pcard-band" />
      <div className="pcard-body">
        <div className="pcard-top">
          <h2><a className="stretch" href={href({ page: 'product', slug: p.slug, tab: 'overview' })}>{p.name}</a></h2>
          <span className={`pill ps-${p.status}`}>{({ active: 'شغال', paused: 'متوقف', archived: 'مؤرشف', planned: 'مخطط' } as Record<string, string>)[p.status] || p.status}</span>
        </div>
        {pipe && <div className={`pcard-ap ps-${pipe.status}`}>{pipe.status === 'running' ? <><span className="spinner" /> شغال أوتوماتيك</> : pipe.status === 'waiting' ? '🤔 محتاج قرارك' : '⏸ متوقف مؤقتًا'}</div>}
        <div className="pcard-meta muted">
          {p.typeLabel}{p.series ? ` · سلسلة ${p.series}` : ''}{p.brand?.token ? ` · ${p.brand.token}` : ' · من غير لون'}
        </div>
        <div className="pcard-progress">
          <Progress done={p.doneCount} total={p.totalStages} />
          <span className="muted nowrap">{p.doneCount} من {p.totalStages} مرحلة</span>
        </div>
        <StageDots stages={p.stages} onPick={go} />
        <div className="pcard-next">
          {p.next ? <>الخطوة الجاية: <strong>{p.next.label}</strong></> : <strong>كل المراحل خلصت</strong>}
          {pending.some(s => s.status === 'partial') && <span className="muted"> · {pending.filter(s => s.status === 'partial').length} ناقصة</span>}
        </div>
        <div className="pcard-foot muted">
          <span>{p.fileCount} ملف كامبين · {p.sourceCount} ملف مصدر</span>
          <span>{fmtDate(p.lastUpdate)}</span>
        </div>
        {p.warnings.length > 0 && <div className="pcard-warn">⚠ {p.warnings[0]}{p.warnings.length > 1 ? ` (+${p.warnings.length - 1})` : ''}</div>}
      </div>
    </div>
  );
}

export { StatusBadge };
