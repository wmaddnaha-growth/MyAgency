import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, upload, setDirty, useLiveVersion, fmtDate, type HistoryItem, type Review, type Stage, type ProductFull, type Config, type FileInfo } from './api';
import { Markdown, CsvTable, Empty, STATUS_LABEL } from './ui';

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone?: 'ok' | 'err' };
let pushToast: (t: Omit<Toast, 'id'>) => void = () => {};
export const toast = (text: string, tone: Toast['tone'] = 'ok') => pushToast({ text, tone });
export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    pushToast = t => { const id = Date.now() + Math.random(); setList(l => [...l, { ...t, id }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), t.tone === 'err' ? 7000 : 3500); };
  }, []);
  return <div className="toasts" role="status">{list.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>;
}
const commitNote = (c?: { committed: boolean; reason?: string }) => c?.committed ? ' · اتسجل في السجل' : c?.reason === 'ignored' ? ' · (ميديا مش داخلة git)' : '';

// ---------- سياق المنتج (للمراجعات) ----------
export const ProductCtx = createContext<{ slug: string; reviews: Record<string, Review> } | null>(null);
export const useProductCtx = () => useContext(ProductCtx);

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- محرر النصوص (Markdown / JSON / TXT) ----------
export function TextEditor({ path, onClose }: { path: string; onClose: () => void }) {
  const v = useLiveVersion();
  const [base, setBase] = useState<{ content: string; hash: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>(() => (innerWidth > 1300 ? 'split' : 'edit'));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const isMd = path.endsWith('.md');
  const id = 'edit:' + path;
  const dirty = base != null && draft !== base.content;
  useEffect(() => { setDirty(id, dirty); return () => setDirty(id, false); }, [id, dirty]);

  // تحميل أولي + متابعة التغييرات على الديسك
  const baseRef = useRef(base); baseRef.current = base;
  const draftRef = useRef(draft); draftRef.current = draft;
  useEffect(() => {
    let alive = true;
    api.textMeta(path).then(m => {
      if (!alive) return;
      const b = baseRef.current;
      if (!b || (m.hash !== b.hash && draftRef.current === b.content)) {
        // أول تحميل، أو اتغير على الديسك ومفيش تعديل محلي → حدّث بهدوء
        setBase({ content: m.content, hash: m.hash }); setDraft(m.content); setConflict(null);
      } else if (m.hash !== b.hash) setConflict(m.content);
    }).catch(e => toast(e.message, 'err'));
    return () => { alive = false; };
  }, [path, v]);

  const save = useCallback(async (force = false) => {
    if (!base) return;
    setSaving(true);
    try {
      const r = await api.save(path, draft, base.hash, force);
      setBase({ content: draft, hash: r.hash });
      setConflict(null);
      toast('اتحفظ ✓' + commitNote(r.commit));
    } catch (e: any) {
      if (e.status === 409) { setConflict(e.current ?? ''); toast('الملف اتغير من مكان تاني — شوف التنبيه فوق المحرر', 'err'); }
      else toast(e.message, 'err');
    } finally { setSaving(false); }
  }, [base, draft, path]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty) save(); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [save, dirty]);

  if (!base) return <div className="loading">جاري التحميل…</div>;
  return (
    <div className="editor">
      <div className="editor-bar">
        {isMd && <div className="seg sm">
          {(['edit', 'split', 'preview'] as const).map(m => <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{{ edit: 'تعديل', split: 'جنب بعض', preview: 'معاينة' }[m]}</button>)}
        </div>}
        <span className={`dirty${dirty ? ' on' : ''}`}>{dirty ? '● تعديلات مش محفوظة' : 'محفوظ'}</span>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => { if (!dirty || confirm('تلغي التعديلات؟')) { setDraft(base.content); onClose(); } }}>إلغاء</button>
        <button type="button" className="btn" disabled={!dirty || saving} onClick={() => save()}>{saving ? 'بيحفظ…' : 'حفظ (Ctrl+S)'}</button>
      </div>
      {conflict != null && (
        <div className="conflict">
          <strong>الملف اتعدّل من مكان تاني (Claude أو حد تاني) وإنت بتعدّل.</strong>
          <div className="conflict-actions">
            <button type="button" className="btn ghost" onClick={async () => { setDraft(conflict); setBase({ content: conflict, hash: await sha256(conflict) }); setConflict(null); }}>خد النسخة الجديدة (تعديلاتي تتلغي)</button>
            <button type="button" className="btn ghost" onClick={() => save(true)}>احفظ تعديلاتي فوقها</button>
          </div>
        </div>
      )}
      <div className={`editor-panes m-${isMd ? mode : 'edit'}`}>
        {(mode !== 'preview' || !isMd) && (
          <textarea className={`editor-text${path.endsWith('.json') ? ' ltr' : ''}`} value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false} dir="auto" aria-label="محتوى الملف" />
        )}
        {isMd && mode !== 'edit' && <div className="editor-preview"><Markdown text={draft} /></div>}
      </div>
    </div>
  );
}

// ---------- محرر CSV (جدول) ----------
function parse(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(Boolean)) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}
const toCsv = (rows: string[][]) => rows.map(r => r.map(v => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(',')).join('\n') + '\n';

export function CsvEditor({ path, onClose }: { path: string; onClose: () => void }) {
  const [base, setBase] = useState<{ text: string; hash: string } | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [saving, setSaving] = useState(false);
  const id = 'csv:' + path;
  useEffect(() => { api.textMeta(path).then(m => { setBase({ text: m.content, hash: m.hash }); setRows(parse(m.content)); }).catch(e => toast(e.message, 'err')); }, [path]);
  const text = useMemo(() => toCsv(rows), [rows]);
  const dirty = base != null && text !== toCsv(parse(base.text));
  useEffect(() => { setDirty(id, dirty); return () => setDirty(id, false); }, [id, dirty]);
  if (!base) return <div className="loading">جاري التحميل…</div>;
  const [head, ...body] = rows;
  const isCal = /calendar\.csv$/.test(path);
  const set = (i: number, j: number, val: string) => setRows(r => r.map((row, ri) => ri === i + 1 ? row.map((c, cj) => cj === j ? val : c) : row));
  const addRow = () => setRows(r => {
    const last = r[r.length - 1] || [];
    const n = head.map((h, j) => h === 'week' ? (last[j] || '1') : h === 'day' ? String(Math.max(0, ...r.slice(1).map(x => Number(x[j]) || 0)) + 1) : '');
    return [...r, n];
  });
  const save = async (force = false) => {
    setSaving(true);
    try {
      const r = await api.save(path, text, base.hash, force);
      setBase({ text, hash: r.hash });
      let msg = 'اتحفظ ✓' + commitNote(r.commit);
      if (r.sync) {
        const parts = [];
        if (r.sync.changed) parts.push(`${r.sync.changed} خانة`);
        if (r.sync.added.length) parts.push(`أيام جديدة: ${r.sync.added.join('، ')}`);
        if (r.sync.removed) parts.push(`${r.sync.removed} يوم اتشال`);
        if (parts.length) msg += ` · calendar.md اتحدّث (${parts.join(' · ')})`;
        if (r.sync.unsynced.length) toast(`أيام متزامنتش مع calendar.md (عدّلها يدوي): ${r.sync.unsynced.join('، ')}`, 'err');
      }
      toast(msg);
    } catch (e: any) {
      if (e.status === 409 && confirm('الملف اتغير من مكان تاني بعد ما فتحته. تحفظ تعديلاتك فوقه؟')) return save(true);
      toast(e.message, 'err');
    } finally { setSaving(false); }
  };
  return (
    <div className="editor">
      <div className="editor-bar">
        <span className={`dirty${dirty ? ' on' : ''}`}>{dirty ? '● تعديلات مش محفوظة' : 'محفوظ'}</span>
        {isCal && <span className="muted small">التعديلات بتتنقل لـ calendar.md تلقائي</span>}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={addRow}>+ صف</button>
        <button type="button" className="btn ghost" onClick={() => { if (!dirty || confirm('تلغي التعديلات؟')) onClose(); }}>إلغاء</button>
        <button type="button" className="btn" disabled={!dirty || saving} onClick={() => save()}>{saving ? 'بيحفظ…' : 'حفظ'}</button>
      </div>
      <div className="table-wrap">
        <table className="table csv-edit">
          <thead><tr>{head.map((h, j) => <th key={j}>{h}</th>)}<th /></tr></thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i}>
                {head.map((h, j) => (
                  <td key={j} className={`c-${h}`}>
                    {['week', 'day'].includes(h)
                      ? <input className="cell num" value={r[j] ?? ''} onChange={e => set(i, j, e.target.value)} inputMode="numeric" aria-label={h} />
                      : <textarea className="cell" value={r[j] ?? ''} onChange={e => set(i, j, e.target.value)} rows={Math.min(4, Math.ceil((r[j]?.length || 1) / 38))} aria-label={h} />}
                  </td>
                ))}
                <td><button type="button" className="icon-btn" title="امسح الصف" onClick={() => confirm('تمسح الصف ده؟') && setRows(rs => rs.filter((_, k) => k !== i + 1))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- السجل (git) ----------
export function HistoryPanel({ path, kind, onRestored }: { path: string; kind: string; onRestored: () => void }) {
  const v = useLiveVersion();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [sel, setSel] = useState<HistoryItem | null>(null);
  const [content, setContent] = useState<string | null>(null);
  useEffect(() => { api.history(path).then(setItems).catch(() => setItems([])); }, [path, v]);
  useEffect(() => { setContent(null); if (sel && ['text', 'table', 'json'].includes(kind)) api.version(path, sel.hash).then(r => setContent(r.content)).catch(e => toast(e.message, 'err')); }, [sel, path, kind]);
  if (!items) return <div className="loading">جاري التحميل…</div>;
  if (!items.length) return <Empty>مفيش سجل للملف ده في git (يمكن ميديا مستبعدة أو ملف جديد لسه متسجلش).</Empty>;
  return (
    <div className="history">
      <ul className="hist-list">
        {items.map((h, i) => (
          <li key={h.hash}>
            <button type="button" className={`hist${sel?.hash === h.hash ? ' on' : ''}`} onClick={() => setSel(h)}>
              <span className="hist-s">{h.subject}{i === 0 && <span className="pill">الحالية</span>}</span>
              <span className="muted small">{fmtDate(h.date)} · {new Date(h.date).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })} · <code dir="ltr">{h.hash.slice(0, 7)}</code></span>
            </button>
          </li>
        ))}
      </ul>
      <div className="hist-view">
        {!sel && <Empty>اختار نسخة عشان تشوفها.</Empty>}
        {sel && (
          <>
            <div className="editor-bar">
              <span>نسخة <code dir="ltr">{sel.hash.slice(0, 7)}</code></span>
              <span className="spacer" />
              {sel.hash !== items[0].hash && (
                <button type="button" className="btn" onClick={async () => {
                  if (!confirm('ترجّع الملف للنسخة دي؟ (النسخة الحالية هتفضل في السجل)')) return;
                  try { await api.restore(path, sel.hash); toast('اترجع للنسخة دي ✓'); onRestored(); } catch (e: any) { toast(e.message, 'err'); }
                }}>استرجع النسخة دي</button>
              )}
            </div>
            {content == null ? (['text', 'table', 'json'].includes(kind) ? <div className="loading">…</div> : <Empty>معاينة النسخ القديمة متاحة للنصوص بس — تقدر تسترجعها.</Empty>)
              : kind === 'table' ? <CsvTable text={content} /> : path.endsWith('.md') ? <Markdown text={content} /> : <pre className="pre">{content}</pre>}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- مراجعة ملف ----------
export const REVIEW_LABEL: Record<string, string> = { approved: 'معتمد', 'needs-fix': 'محتاج تعديل', rejected: 'محتاج إعادة' };
export function ReviewControl({ slug, path, review }: { slug: string; path: string; review?: Review }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(review?.status || '');
  const [note, setNote] = useState(review?.note || '');
  useEffect(() => { setStatus(review?.status || ''); setNote(review?.note || ''); }, [review?.status, review?.note]);
  const save = async (s = status, n = note) => {
    try { await api.setReview(slug, path, s || null, n); toast(s ? `اتعلّم «${REVIEW_LABEL[s]}»` : 'اتشالت المراجعة'); setOpen(false); } catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <div className="review">
      <button type="button" className={`btn ghost rv rv-${review?.status || 'none'}`} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {review ? REVIEW_LABEL[review.status] : 'مراجعة'}
      </button>
      {open && (
        <div className="popover">
          <div className="seg sm">
            {Object.entries(REVIEW_LABEL).map(([k, l]) => <button key={k} type="button" className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}
          </div>
          <textarea className="input" rows={3} placeholder="ملاحظاتك على الملف (اختياري)" value={note} onChange={e => setNote(e.target.value)} />
          <div className="row">
            {review && <button type="button" className="btn ghost" onClick={() => save('', '')}>شيل المراجعة</button>}
            <span className="spacer" />
            <button type="button" className="btn" disabled={!status} onClick={() => save()}>حفظ</button>
          </div>
        </div>
      )}
      {review?.note && !open && <div className="review-note" title={review.note}>💬 {review.note}</div>}
    </div>
  );
}

// ---------- رفع ملفات ----------
export function Uploader({ dir, subdirs = [], label = 'رفع ملفات', defaultSub = '' }: { dir: string; subdirs?: string[]; label?: string; defaultSub?: string }) {
  const [sub, setSub] = useState(defaultSub);
  const [custom, setCustom] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<{ name: string; pct: number }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const target = () => {
    const s = sub === '__new' ? custom.trim().replace(/[\\:*?"<>|]/g, '').replace(/\s+/g, '-') : sub;
    return s ? `${dir}/${s}` : dir;
  };
  const send = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    if (sub === '__new' && !custom.trim()) { toast('اكتب اسم الفولدر الجديد الأول', 'err'); return; }
    const t = target();
    setBusy(list.map(f => ({ name: f.name, pct: 0 })));
    let ok = 0;
    for (const [i, f] of list.entries()) {
      try { await upload(t, f, pct => setBusy(b => b.map((x, j) => j === i ? { ...x, pct } : x))); ok++; }
      catch (e: any) { toast(`${f.name}: ${e.message}`, 'err'); }
    }
    setBusy([]);
    if (ok) toast(`اترفع ${ok} ملف في ${t.split('/').slice(2).join('/') || t}`);
  };
  return (
    <div className={`uploader${over ? ' over' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}>
      <div className="up-row">
        <button type="button" className="btn ghost" onClick={() => input.current?.click()}>⇪ {label}</button>
        <span className="muted small">أو اسحب الملفات هنا · هيتحطوا في</span>
        <select className="input sm" value={sub} onChange={e => setSub(e.target.value)} aria-label="الفولدر">
          <option value="">{dir.split('/').slice(2).join('/') || dir.split('/').pop()}/</option>
          {subdirs.map(s => <option key={s} value={s}>{s}/</option>)}
          <option value="__new">+ فولدر جديد…</option>
        </select>
        {sub === '__new' && <input className="input sm" placeholder="اسم الفولدر (مثلاً week-1/day-6-...)" value={custom} onChange={e => setCustom(e.target.value)} dir="auto" />}
        <input ref={input} type="file" multiple hidden onChange={e => { send(e.target.files || []); e.target.value = ''; }} />
      </div>
      {busy.length > 0 && <ul className="up-list">{busy.map(b => <li key={b.name}><span>{b.name}</span><div className="progress"><div style={{ width: b.pct + '%' }} /></div></li>)}</ul>}
    </div>
  );
}

// ---------- ملف جديد ----------
export function NewFileButton({ dir, onCreated, template = '' }: { dir: string; onCreated: (path: string) => void; template?: string }) {
  return (
    <button type="button" className="btn ghost" onClick={async () => {
      const name = prompt('اسم الملف الجديد (هيبقى .md لو من غير امتداد):');
      if (!name) return;
      try { const r = await api.newFile(dir, name, template); toast('اتعمل ✓'); onCreated(r.path); } catch (e: any) { toast(e.message, 'err'); }
    }}>+ ملف جديد</button>
  );
}

export async function trashFile(path: string, after?: () => void) {
  if (!confirm(`تحذف «${path.split('/').pop()}»؟\n\nالملف هيتنقل لفولدر .trash/ في روت البروجكت (مش حذف نهائي)، وتقدر ترجعه من هناك.`)) return;
  try { const r = await api.trash(path); toast(`اتنقل لـ ${r.trashedTo.split('/').slice(0, 2).join('/')}/`); after?.(); } catch (e: any) { toast(e.message, 'err'); }
}

// ---------- حالة المرحلة اليدوية ----------
const MANUAL: [string, string][] = [['auto', 'تلقائي (من الملفات)'], ['in-progress', 'شغال'], ['review', 'مستني QA'], ['approved', 'معتمد ✅'], ['needs-fix', 'محتاج تعديل ⚠️'], ['rejected', 'محتاج إعادة ❌'], ['skipped', 'مش مطلوب']];
export function StageStatusEditor({ slug, s }: { slug: string; s: Stage }) {
  const [status, setStatus] = useState(s.manual?.status || 'auto');
  const [note, setNote] = useState(s.manual?.note || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setStatus(s.manual?.status || 'auto'); setNote(s.manual?.note || ''); }, [s.manual?.status, s.manual?.note]);
  const changed = status !== (s.manual?.status || 'auto') || note !== (s.manual?.note || '');
  return (
    <div className="stage-status">
      <label className="muted small" htmlFor={`st-${s.id}`}>الحالة اليدوية</label>
      <select id={`st-${s.id}`} className="input sm" value={status} onChange={e => setStatus(e.target.value)}>
        {MANUAL.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {status !== 'auto' && <input className="input sm grow" placeholder="ملاحظة (مثلاً ملخص ملاحظات QA)" value={note} onChange={e => setNote(e.target.value)} />}
      {changed && <button type="button" className="btn" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await api.setStage(slug, s.id, status, status === 'auto' ? '' : note); toast(`«${s.label}» → ${status === 'auto' ? 'تلقائي' : STATUS_LABEL[status]}`); }
        catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
      }}>حفظ</button>}
      {s.manual?.status && <span className="muted small">آخر تحديث {s.manual.updatedAt}{s.auto ? ` · من الملفات: ${STATUS_LABEL[s.auto]}` : ''}</span>}
    </div>
  );
}

// ---------- بيانات المنتج ----------
export function MetaEditor({ p, config, onClose }: { p: ProductFull; config: Config; onClose: () => void }) {
  const [f, setF] = useState({ name: p.name, status: p.status, series: p.series || '', type: p.type, mainFile: p.mainFile || '', notes: p.notes || '' });
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const docs = p.sourceFiles.filter((x: FileInfo) => ['pdf', 'text'].includes(x.kind) || ['docx', 'epub'].includes(x.ext));
  return (
    <form className="card form" onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      try { await api.updateMeta(p.slug, f); toast('بيانات المنتج اتحفظت ✓'); onClose(); } catch (err: any) { toast(err.message, 'err'); } finally { setBusy(false); }
    }}>
      <h3>بيانات المنتج</h3>
      <div className="form-grid">
        <label>الاسم<input className="input" value={f.name} onChange={up('name')} required /></label>
        <label>الحالة<select className="input" value={f.status} onChange={up('status')}>{Object.entries(config.productStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>السلسلة<input className="input" value={f.series} onChange={up('series')} placeholder="من غير" list="series-list" /></label>
        <label>النوع<select className="input" value={f.type} onChange={up('type')}>{Object.entries(config.productTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="wide">ملف الكتاب الأساسي<select className="input" value={f.mainFile} onChange={up('mainFile')}><option value="">— مش محدد —</option>{docs.map(d => <option key={d.path} value={d.path}>{d.inner}</option>)}</select></label>
        <label className="wide">ملاحظات<textarea className="input" rows={3} value={f.notes} onChange={up('notes')} /></label>
      </div>
      <p className="muted small">الـ slug (<code>{p.slug}</code>) وفولدر الكامبين مش بيتغيروا من هنا عشان اللينكات والمسارات متتكسرش.</p>
      <div className="row"><span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>إلغاء</button><button className="btn" disabled={busy}>حفظ</button></div>
    </form>
  );
}

export function NewProductForm({ config, series, onClose }: { config: Config; series: string[]; onClose: () => void }) {
  const [f, setF] = useState({ name: '', series: '', type: Object.keys(config.productTypes)[0], status: 'active' });
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  return (
    <form className="card form" onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      try {
        const r = await api.createProduct({ ...f, series: f.series || null });
        toast('المنتج اتسجل ✓ — ارفع ملفات الكتاب في تاب «ملفات الكتاب»');
        onClose();
        location.hash = `#/p/${encodeURIComponent(r.product.slug)}/source`;
      } catch (err: any) { toast(err.message, 'err'); } finally { setBusy(false); }
    }}>
      <h3>منتج جديد</h3>
      <div className="form-grid">
        <label className="wide">اسم المنتج<input className="input" value={f.name} onChange={up('name')} required autoFocus placeholder="مثلاً: شفرة الستات" /></label>
        <label>السلسلة<input className="input" value={f.series} onChange={up('series')} list="series-list" placeholder="من غير" /></label>
        <label>النوع<select className="input" value={f.type} onChange={up('type')}>{Object.entries(config.productTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label>الحالة<select className="input" value={f.status} onChange={up('status')}>{Object.entries(config.productStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <datalist id="series-list">{series.map(s => <option key={s} value={s} />)}</datalist>
      <p className="muted small">هيتعمل <code>campaigns/&lt;الاسم&gt;/product.json</code> وفولدر <code>Books/&lt;الاسم&gt;/</code>. بعدها ارفع ملف الكتاب والبونصات من صفحة المنتج.</p>
      <div className="row"><span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>إلغاء</button><button className="btn" disabled={busy || !f.name.trim()}>سجّل المنتج</button></div>
    </form>
  );
}
