import { useMemo, useState } from 'react';
import { api, company, href, useAsync, useLiveVersion, type CalItem } from './api';
import { toast } from './Edit';
import { Empty } from './ui';

export const PUB_LABEL: Record<string, string> = { planned: 'متخطط', ready: 'جاهز للنشر', scheduled: 'متجدول', published: 'اتنشر', skipped: 'اتلغى' };
const PUB_ICON: Record<string, string> = { planned: '○', ready: '◐', scheduled: '◷', published: '●', skipped: '✕' };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarPage() {
  const v = useLiveVersion();
  const data = useAsync(() => company.calendar(), [v]);
  const comp = useAsync(() => company.get(), []);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<CalItem | null>(null);
  const weekStart = comp.data?.weekStart ?? 6;

  const items = (data.data?.items || []).filter(i => !hidden.has(i.slug));
  const byDate = useMemo(() => { const m = new Map<string, CalItem[]>(); for (const i of items) { if (!m.has(i.date)) m.set(i.date, []); m.get(i.date)!.push(i); } return m; }, [items]);
  const products = useMemo(() => { const m = new Map<string, { name: string; color: string | null; n: number }>(); for (const i of data.data?.items || []) { const x = m.get(i.slug) || { name: i.name, color: i.color, n: 0 }; x.n++; m.set(i.slug, x); } return [...m.entries()]; }, [data.data]);
  const today = data.data?.today || iso(new Date());
  const overdue = items.filter(i => i.date < today && !['published', 'skipped'].includes(i.status));
  const todays = items.filter(i => i.date === today);

  // شبكة الشهر
  const cells: (Date | null)[] = [];
  const first = new Date(month);
  const offset = (first.getDay() - weekStart + 7) % 7;
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7) cells.push(null);
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStart + i) % 7]);
  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));

  if (data.error) return <div className="page"><Empty>{data.error}</Empty></div>;
  return (
    <div className="page stack">
      <div className="section-h"><h2>كالندر النشر</h2><span className="muted">كل بوستات كل المنتجات بتواريخها الحقيقية</span></div>

      {(data.data?.noDate.length || 0) > 0 && (
        <div className="card notice">
          <h3>منتجات عندها خطة محتوى بس من غير تاريخ بداية</h3>
          <p className="muted small">حدد يوم البداية، ويوم 1 في الخطة هيبقى اليوم ده وكل يوم بعده بالترتيب.</p>
          <ul className="nodate">{data.data!.noDate.map(n => <NoDateRow key={n.slug} {...n} />)}</ul>
        </div>
      )}

      {(overdue.length > 0 || todays.length > 0) && (
        <div className="two">
          <div className="card"><h3>النهارده ({todays.length})</h3>{todays.length ? <ItemList items={todays} onPick={setSel} /> : <p className="muted">مفيش نشر النهارده.</p>}</div>
          <div className="card"><h3 className={overdue.length ? 'warn-t' : ''}>متأخر ({overdue.length})</h3>{overdue.length ? <ItemList items={overdue.slice(0, 12)} onPick={setSel} /> : <p className="muted">مفيش حاجة متأخرة 👌</p>}</div>
        </div>
      )}

      <div className="card">
        <div className="cal-bar">
          <div className="row">
            <button type="button" className="btn ghost sm" onClick={() => shift(-1)} aria-label="الشهر اللي فات">→</button>
            <strong className="cal-month">{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
            <button type="button" className="btn ghost sm" onClick={() => shift(1)} aria-label="الشهر الجاي">←</button>
            <button type="button" className="btn ghost sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>النهارده</button>
          </div>
          <div className="cal-filter">
            {products.map(([slug, p]) => (
              <button key={slug} type="button" className={`chip${hidden.has(slug) ? ' off' : ''}`} onClick={() => setHidden(h => { const n = new Set(h); n.has(slug) ? n.delete(slug) : n.add(slug); return n; })}>
                <i className="sw" style={{ background: p.color || 'var(--ink-mute)' }} />{p.name} <span className="muted">{p.n}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="cal-legend muted small">{Object.entries(PUB_LABEL).map(([k, l]) => <span key={k}><b className={`pi pi-${k}`}>{PUB_ICON[k]}</b> {l}</span>)}</div>
        <div className="cal-grid" role="grid">
          {heads.map(h => <div key={h} className="cal-head" role="columnheader">{h}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell empty" />;
            const key = iso(d);
            const list = byDate.get(key) || [];
            return (
              <div key={i} className={`cal-cell${key === today ? ' today' : ''}${key < today ? ' past' : ''}`} role="gridcell">
                <div className="cal-d">{d.getDate()}</div>
                {list.slice(0, 4).map(it => <CalChip key={it.slug + it.day} it={it} onPick={setSel} past={key < today} />)}
                {list.length > 4 && <div className="muted small">+{list.length - 4}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {sel && <PostDrawer it={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function CalChip({ it, onPick, past }: { it: CalItem; onPick: (i: CalItem) => void; past?: boolean }) {
  const late = past && !['published', 'skipped'].includes(it.status);
  return (
    <button type="button" className={`cal-chip ps-${it.status}${late ? ' late' : ''}`} style={{ ['--c' as string]: it.color || 'var(--ink-mute)' }} onClick={() => onPick(it)} title={`${it.name} · يوم ${it.day} · ${PUB_LABEL[it.status]}\n${it.hook}`}>
      <b className={`pi pi-${it.status}`}>{PUB_ICON[it.status]}</b>
      <span className="cc-t">{it.format.split(' ')[0]} · {it.hook}</span>
    </button>
  );
}

function ItemList({ items, onPick }: { items: CalItem[]; onPick: (i: CalItem) => void }) {
  return (
    <ul className="cal-list">
      {items.map(it => (
        <li key={it.slug + it.day}>
          <button type="button" className="linkish" onClick={() => onPick(it)}><i className="sw" style={{ background: it.color || 'var(--ink-mute)' }} />{it.name} · يوم {it.day}</button>
          <span className="muted small"> {it.date} · {PUB_LABEL[it.status]} · {it.hook.slice(0, 50)}</span>
        </li>
      ))}
    </ul>
  );
}

function NoDateRow({ slug, name, days, color }: { slug: string; name: string; days: number; color: string | null }) {
  const [d, setD] = useState('');
  return (
    <li>
      <i className="sw" style={{ background: color || 'var(--ink-mute)' }} /><strong>{name}</strong> <span className="muted small">({days} يوم)</span>
      <input type="date" className="input sm" value={d} onChange={e => setD(e.target.value)} aria-label={`تاريخ بداية ${name}`} />
      <button type="button" className="btn sm" disabled={!d} onClick={async () => { try { await api.updateMeta(slug, { launchDate: d }); toast(`«${name}» هيبدأ نشر ${d}`); } catch (e: any) { toast(e.message, 'err'); } }}>حفظ</button>
    </li>
  );
}

function PostDrawer({ it, onClose }: { it: CalItem; onClose: () => void }) {
  const [status, setStatus] = useState(it.manual ? it.status : '');
  const [url, setUrl] = useState(it.url);
  const [date, setDate] = useState(it.date);
  const [note, setNote] = useState(it.note);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await company.setPublishing(it.slug, { day: it.day, status, url, note, date: date !== it.date ? date : undefined }); toast('اتحفظ ✓'); onClose(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label="تفاصيل البوست" style={{ ['--pc' as string]: it.color || 'var(--teal)' }}>
        <div className="card-h"><h3>{it.name} · يوم {it.day}</h3><button type="button" className="icon-btn" onClick={onClose} aria-label="قفل">✕</button></div>
        <p className="lead">«{it.hook}»</p>
        <dl className="kv small">
          <dt>النوع</dt><dd>{it.type}</dd><dt>الصيغة</dt><dd>{it.format}</dd><dt>CTA</dt><dd>{it.cta}</dd>
          <dt>جاهزية</dt><dd>{it.hasCopy ? '✓ بوست' : '○ بوست'} · {it.visuals ? '✓ تصميم' : '○ تصميم'}{/ريل|reel|فيديو/i.test(it.format) ? (it.reels ? ' · ✓ ريل' : ' · ○ ريل') : ''}</dd>
        </dl>
        <a className="btn ghost" href={href({ page: 'product', slug: it.slug, tab: 'copy', file: `day:${it.day}` })}>افتح البوست والتصميم</a>
        <label className="field">حالة النشر
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">تلقائي ({it.hasCopy ? 'حسب الملفات' : 'متخطط'})</option>
            {Object.entries(PUB_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="field">تاريخ النشر<input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="field">لينك البوست بعد النشر<input className="input" dir="ltr" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label>
        <label className="field">ملاحظة<input className="input" value={note} onChange={e => setNote(e.target.value)} /></label>
        <div className="row"><span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>إلغاء</button><button type="button" className="btn" disabled={busy} onClick={save}>حفظ</button></div>
      </aside>
    </div>
  );
}
