import { useEffect, useMemo, useRef, useState } from 'react';
import { company, href, fmtMoney, fmtNum, useAsync, useLiveVersion, type Totals, type ResultRow } from './api';
import { toast } from './Edit';
import { Empty } from './ui';

// ألوان السلسلتين — متراجعة بسكريبت الـ dataviz (contrast + colorblind) على خلفية الكارت
const C_REV = '#00897B', C_SPEND = '#B8862E';

const RANGES: [string, string, number | null][] = [['7', 'آخر 7 أيام', 7], ['30', 'آخر 30 يوم', 30], ['90', 'آخر 90 يوم', 90], ['all', 'الكل', null]];
const isoAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n + 1); return d.toISOString().slice(0, 10); };

export function Kpis({ t, cur }: { t: Totals; cur: string }) {
  const tiles: [string, React.ReactNode, string?][] = [
    ['الإيرادات', fmtMoney(t.revenue, cur)],
    ['الصرف على الإعلانات', fmtMoney(t.spend, cur)],
    ['ROAS', t.roas == null ? '—' : <bdi dir="ltr">{fmtNum(t.roas, 2)}×</bdi>, t.roas == null ? undefined : t.roas >= 1 ? 'إيراد أكبر من الصرف' : 'الصرف أكبر من الإيراد'],
    ['الطلبات', fmtNum(t.orders)],
    ['تكلفة الطلب (CPA)', fmtMoney(t.cpa, cur)],
    ['Leads', fmtNum(t.leads), t.cpl != null ? `تكلفة الـ lead: ${fmtMoney(t.cpl, cur)}` : undefined],
  ];
  return <section className="stats six">{tiles.map(([l, v, s]) => <div key={l} className="stat"><div className="stat-label">{l}</div><div className="stat-value sm">{v}</div>{s && <div className="stat-sub">{s}</div>}</div>)}</section>;
}

export function ResultsPage() {
  const v = useLiveVersion();
  const [range, setRange] = useState('30');
  const days = RANGES.find(r => r[0] === range)![2];
  const res = useAsync(() => company.results(days ? isoAgo(days) : undefined), [v, range]);
  if (res.error) return <div className="page"><Empty>{res.error}</Empty></div>;
  const d = res.data;
  const withData = (d?.products || []).filter(p => p.rows).sort((a, b) => b.totals.revenue - a.totals.revenue);
  const maxRev = Math.max(1, ...withData.map(p => Math.max(p.totals.revenue, p.totals.spend)));
  return (
    <div className="page stack">
      <div className="section-h"><h2>النتايج والمبيعات</h2><span className="muted">الصرف والإيرادات لكل المنتجات</span></div>
      <div className="seg" role="group" aria-label="الفترة">{RANGES.map(([k, l]) => <button key={k} type="button" className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div>
      {!d ? <div className="loading">…</div> : <>
        <Kpis t={d.totals} cur={d.currency} />
        <div className="card">
          <h3>الإيرادات والصرف يوم بيوم</h3>
          {d.series.length ? <LineChart series={d.series} cur={d.currency} /> : <Empty>مفيش أرقام في الفترة دي. سجّل النتايج من صفحة كل منتج (تاب «النتايج»).</Empty>}
        </div>
        <div className="card">
          <h3>حسب المنتج</h3>
          {withData.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>المنتج</th><th>الإيرادات</th><th>الصرف</th><th>ROAS</th><th>الطلبات</th><th>CPA</th><th>Leads</th><th aria-label="مقارنة" /></tr></thead>
                <tbody>{withData.map(p => (
                  <tr key={p.slug}>
                    <td><a className="mx-name" href={href({ page: 'product', slug: p.slug, tab: 'results' })}><i style={{ background: p.color || 'var(--ink-mute)' }} />{p.name}</a></td>
                    <td className="num">{fmtMoney(p.totals.revenue, d.currency)}</td>
                    <td className="num">{fmtMoney(p.totals.spend, d.currency)}</td>
                    <td className="num">{p.totals.roas == null ? '—' : <bdi dir="ltr">{fmtNum(p.totals.roas, 2)}×</bdi>}</td>
                    <td className="num">{fmtNum(p.totals.orders)}</td>
                    <td className="num">{fmtMoney(p.totals.cpa, d.currency)}</td>
                    <td className="num">{fmtNum(p.totals.leads)}</td>
                    <td className="bars-cell" dir="ltr">
                      <div className="hbar" style={{ width: `${(p.totals.revenue / maxRev) * 100}%`, background: C_REV }} title={`الإيرادات ${fmtMoney(p.totals.revenue, d.currency)}`} />
                      <div className="hbar" style={{ width: `${(p.totals.spend / maxRev) * 100}%`, background: C_SPEND }} title={`الصرف ${fmtMoney(p.totals.spend, d.currency)}`} />
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <Empty>مفيش منتج عنده نتايج متسجلة لسه.</Empty>}
          {(d.products.length - withData.length) > 0 && <p className="muted small">{d.products.length - withData.length} منتج ملوش أرقام في الفترة دي.</p>}
        </div>
      </>}
    </div>
  );
}

// ---------- رسم خطي: الإيرادات مقابل الصرف (نفس العملة → محور واحد) ----------
function LineChart({ series, cur }: { series: { date: string; spend: number; revenue: number; orders: number }[]; cur: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(700);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(280, e[0].contentRect.width)));
    ro.observe(box.current); return () => ro.disconnect();
  }, []);
  const H = 260, P = { l: 56, r: 16, t: 16, b: 28 };
  const n = series.length;
  const max = Math.max(1, ...series.flatMap(s => [s.revenue, s.spend]));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => P.l + (n === 1 ? (w - P.l - P.r) / 2 : (i / (n - 1)) * (w - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const path = (k: 'revenue' | 'spend') => series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join('');
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(n / Math.floor((w - P.l) / 70)));
  const showDots = n <= 31;
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left + P.l;
    let best = 0, bd = Infinity;
    series.forEach((_, i) => { const dd = Math.abs(x(i) - px); if (dd < bd) { bd = dd; best = i; } });
    setHover(best);
  };
  const h = hover != null ? series[hover] : null;
  return (
    <div className="chart" ref={box} dir="ltr">
      <div className="legend chart-legend" dir="rtl">
        <span><i className="lk" style={{ background: C_REV }} />الإيرادات</span>
        <span><i className="lk" style={{ background: C_SPEND }} />الصرف</span>
      </div>
      <svg width={w} height={H} role="img" aria-label="الإيرادات والصرف يوم بيوم">
        {ticks.map(t => <g key={t}><line x1={P.l} x2={w - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 8} y={y(t) + 4} className="axis" textAnchor="end">{fmtNum(t)}</text></g>)}
        {series.map((s, i) => i % labelEvery === 0 ? <text key={s.date} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{s.date.slice(5)}</text> : null)}
        <path d={path('spend')} fill="none" stroke={C_SPEND} strokeWidth={2} strokeLinejoin="round" />
        <path d={path('revenue')} fill="none" stroke={C_REV} strokeWidth={2} strokeLinejoin="round" />
        {showDots && series.map((s, i) => <g key={i}><circle cx={x(i)} cy={y(s.spend)} r={4} fill={C_SPEND} stroke="#FFFDF9" strokeWidth={2} /><circle cx={x(i)} cy={y(s.revenue)} r={4} fill={C_REV} stroke="#FFFDF9" strokeWidth={2} /></g>)}
        {n > 1 && <>
          <text x={x(n - 1) - 4} y={y(series[n - 1].revenue) - 10} className="dlabel" textAnchor="end">{fmtNum(series[n - 1].revenue)}</text>
        </>}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="xhair" />}
        <rect x={P.l} y={P.t} width={w - P.l - P.r} height={H - P.t - P.b} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {h && (
        <div className="tip" style={{ left: Math.min(w - 170, Math.max(0, x(hover!) + 12)), top: 24 }} dir="rtl">
          <div className="muted small">{h.date}</div>
          <div><i className="lk" style={{ background: C_REV }} /><b>{fmtMoney(h.revenue, cur)}</b> <span className="muted">إيرادات</span></div>
          <div><i className="lk" style={{ background: C_SPEND }} /><b>{fmtMoney(h.spend, cur)}</b> <span className="muted">صرف</span></div>
          <div className="muted small">{fmtNum(h.orders)} طلب{h.spend ? ` · ROAS ${fmtNum(h.revenue / h.spend, 2)}×` : ''}</div>
        </div>
      )}
      <details dir="rtl"><summary>عرض كجدول</summary>
        <div className="table-wrap"><table className="table"><thead><tr><th>اليوم</th><th>الإيرادات</th><th>الصرف</th><th>الطلبات</th></tr></thead>
          <tbody>{series.map(s => <tr key={s.date}><td>{s.date}</td><td className="num">{fmtMoney(s.revenue, cur)}</td><td className="num">{fmtMoney(s.spend, cur)}</td><td className="num">{s.orders}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  );
}
function niceStep(raw: number) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

// ---------- نتايج منتج واحد ----------
const EMPTY_ROW = { date: new Date().toISOString().slice(0, 10), channel: 'meta', spend: '', orders: '', revenue: '', leads: '', clicks: '', impressions: '', note: '' };
export function ProductResults({ slug, csvPath }: { slug: string; csvPath: (p: string) => void }) {
  const v = useLiveVersion();
  const res = useAsync(() => company.productResults(slug), [slug, v]);
  const [row, setRow] = useState<Record<string, string>>(EMPTY_ROW);
  const [preview, setPreview] = useState<{ csv: string; mapped: Record<string, string>; rows: ResultRow[] } | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const d = res.data;
  const rows = useMemo(() => [...(d?.rows || [])].reverse(), [d]);
  const up = (k: string) => (e: { target: { value: string } }) => setRow(r => ({ ...r, [k]: e.target.value }));
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await company.addResults(slug, [row as any]); toast('اتسجل ✓'); setRow({ ...EMPTY_ROW, date: row.date, channel: row.channel }); } catch (er: any) { toast(er.message, 'err'); }
  };
  const pick = async (f?: File) => {
    if (!f) return;
    const csv = await f.text();
    try { const r = await company.importMeta(slug, csv, true); setPreview({ csv, ...r }); } catch (er: any) { toast(er.message, 'err'); }
  };
  return (
    <div className="stack">
      <div className="section-h"><h2>النتايج والمبيعات</h2>{d && <button type="button" className="linkish small" onClick={() => csvPath(d.path)}>{d.path.split('/').slice(2).join('/')}</button>}</div>
      {d && <Kpis t={d.totals} cur={d.currency} />}
      <form className="card form" onSubmit={add}>
        <h3>سجّل يوم</h3>
        <div className="form-grid">
          <label>اليوم<input type="date" className="input" value={row.date} onChange={up('date')} required /></label>
          <label>القناة<input className="input" value={row.channel} onChange={up('channel')} list="channels" /></label>
          <label>الصرف<input className="input" inputMode="decimal" value={row.spend} onChange={up('spend')} placeholder="0" /></label>
          <label>الطلبات<input className="input" inputMode="numeric" value={row.orders} onChange={up('orders')} placeholder="0" /></label>
          <label>الإيرادات<input className="input" inputMode="decimal" value={row.revenue} onChange={up('revenue')} placeholder="0" /></label>
          <label>Leads<input className="input" inputMode="numeric" value={row.leads} onChange={up('leads')} placeholder="0" /></label>
          <label className="wide">ملاحظة<input className="input" value={row.note} onChange={up('note')} /></label>
        </div>
        <datalist id="channels"><option value="meta" /><option value="tiktok" /><option value="google" /><option value="organic" /><option value="whatsapp" /></datalist>
        <p className="muted small">لو سجّلت نفس اليوم ونفس القناة تاني، الأرقام الجديدة بتحل محل القديمة.</p>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => fileIn.current?.click()}>⇪ استيراد تقرير Meta Ads (CSV)</button>
          <input ref={fileIn} type="file" accept=".csv,text/csv" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <span className="spacer" /><button className="btn">سجّل</button>
        </div>
      </form>
      {preview && (
        <div className="card notice">
          <h3>معاينة الاستيراد — {preview.rows.length} يوم</h3>
          <p className="small">الأعمدة اللي اتعرفت: {Object.entries(preview.mapped).map(([k, h]) => <span key={k} className="chip">{k} ← {h}</span>)}</p>
          <p className="muted small">من Ads Manager صدّر التقرير مقسم باليوم (Breakdown ← Time ← Day). لو عمود «Results» في حملتك معناه Leads مش طلبات، عدّل الأرقام بعد الاستيراد.</p>
          <div className="table-wrap"><table className="table"><thead><tr><th>اليوم</th><th>الصرف</th><th>الطلبات</th><th>الإيرادات</th><th>Leads</th></tr></thead>
            <tbody>{preview.rows.slice(0, 10).map(r => <tr key={r.date}><td>{r.date}</td><td className="num">{fmtNum(r.spend, 2)}</td><td className="num">{r.orders}</td><td className="num">{fmtNum(r.revenue, 2)}</td><td className="num">{r.leads}</td></tr>)}</tbody></table></div>
          <div className="row"><span className="spacer" /><button type="button" className="btn ghost" onClick={() => setPreview(null)}>إلغاء</button>
            <button type="button" className="btn" onClick={async () => { try { await company.importMeta(slug, preview.csv, false); toast(`اتستورد ${preview.rows.length} يوم ✓`); setPreview(null); } catch (er: any) { toast(er.message, 'err'); } }}>استورد</button></div>
        </div>
      )}
      <div className="card">
        <h3>الأيام المتسجلة ({rows.length})</h3>
        {rows.length ? <div className="table-wrap"><table className="table"><thead><tr><th>اليوم</th><th>القناة</th><th>الصرف</th><th>الطلبات</th><th>الإيرادات</th><th>ROAS</th><th>Leads</th><th>ملاحظة</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.date + r.channel}><td>{r.date}</td><td>{r.channel}</td><td className="num">{fmtNum(r.spend, 2)}</td><td className="num">{r.orders}</td><td className="num">{fmtNum(r.revenue, 2)}</td><td className="num">{r.spend ? <bdi dir="ltr">{fmtNum(r.revenue / r.spend, 2)}×</bdi> : '—'}</td><td className="num">{r.leads}</td><td className="small muted">{r.note}</td></tr>)}</tbody></table></div>
          : <Empty>مفيش أرقام متسجلة للمنتج ده لسه.</Empty>}
      </div>
    </div>
  );
}

export { href };
