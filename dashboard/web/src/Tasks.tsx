import { useState } from 'react';
import { company, href, useAsync, useLiveVersion, type Task, type Member, type ProductSummary } from './api';
import { toast } from './Edit';
import { Empty, STATUS_LABEL } from './ui';

const T_STATUS: Record<string, string> = { todo: 'لسه', doing: 'شغال', done: 'خلصت' };
const ME_KEY = 'me';
const readMe = () => { try { return localStorage.getItem(ME_KEY) || ''; } catch { return ''; } };

export function TasksPage({ products }: { products: ProductSummary[] }) {
  const v = useLiveVersion();
  const data = useAsync(() => company.tasks(), [v]);
  const [me, setMe] = useState(readMe);
  const [who, setWho] = useState<string>(() => readMe() || 'all');
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  if (data.error) return <div className="page"><Empty>{data.error}</Empty></div>;
  const d = data.data;
  const team = d?.team || [];
  const list = (d?.tasks || []).filter(t => (who === 'all' || (who === '__none' ? !t.assignee : t.assignee === who)) && (showDone || t.status !== 'done'));
  const today = d?.today || '';
  const cols: Task['status'][] = showDone ? ['todo', 'doing', 'done'] : ['todo', 'doing'];
  const overdue = list.filter(t => t.due && t.due < today && t.status !== 'done').length;

  return (
    <div className="page stack">
      <div className="section-h"><h2>المهام</h2><span className="muted">مهام الفريق على كل المنتجات</span></div>
      <div className="toolbar">
        <select className="input" value={who} onChange={e => setWho(e.target.value)} aria-label="الشخص">
          <option value="all">كل الفريق</option>
          {team.map(m => <option key={m.id} value={m.name}>{m.name}{m.name === me ? ' (أنا)' : ''}</option>)}
          <option value="__none">من غير مسؤول</option>
        </select>
        <select className="input" value={me} onChange={e => { setMe(e.target.value); try { localStorage.setItem(ME_KEY, e.target.value); } catch { /* */ } if (e.target.value) setWho(e.target.value); }} aria-label="أنا مين">
          <option value="">أنا مين؟</option>
          {team.map(m => <option key={m.id} value={m.name}>أنا {m.name}</option>)}
        </select>
        <label className="chk small"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> اعرض اللي خلص</label>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => setEditingTeam(x => !x)}>الفريق ({team.length})</button>
        <button type="button" className="btn" onClick={() => setAdding(x => !x)}>+ مهمة</button>
      </div>
      {editingTeam && <TeamEditor team={team} onClose={() => setEditingTeam(false)} />}
      {adding && <TaskForm products={products} team={team} onClose={() => setAdding(false)} defaults={{ assignee: who !== 'all' && who !== '__none' ? who : '' }} />}
      {!team.length && !editingTeam && <div className="card notice"><p>لسه مفيش أعضاء فريق. دوس «الفريق» وضيف الأسامي عشان توزّع المهام.</p></div>}
      {overdue > 0 && <p className="warn-t">⚠ {overdue} مهمة فات ميعادها</p>}
      {!d ? <div className="loading">…</div> : (
        <div className={`kanban k${cols.length}`}>
          {cols.map(c => {
            const items = list.filter(t => t.status === c).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
            return (
              <section key={c} className="kcol">
                <h3>{T_STATUS[c]} <span className="muted">{items.length}</span></h3>
                {items.length ? items.map(t => <TaskCard key={t.id} t={t} today={today} team={team} />) : <p className="muted small">مفيش.</p>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({ t, today, team }: { t: Task; today: string; team: Member[] }) {
  const late = t.due && t.due < today && t.status !== 'done';
  const stageLink = t.stage ? href({ page: 'product', slug: t.slug, tab: t.stage }) : href({ page: 'product', slug: t.slug, tab: 'overview' });
  const setStatus = async (status: string) => { try { await company.saveTask(t.slug, { id: t.id, status: status as Task['status'] }); } catch (e: any) { toast(e.message, 'err'); } };
  const setAssignee = async (assignee: string) => { try { await company.saveTask(t.slug, { id: t.id, assignee }); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <article className={`tcard${late ? ' late' : ''}${t.kind === 'stage' ? ' stage' : ''}`} style={{ ['--c' as string]: t.color || 'var(--ink-mute)' }}>
      <a href={stageLink} className="tc-prod"><i className="sw" style={{ background: t.color || 'var(--ink-mute)' }} />{t.productName}{t.stageLabel ? ` · ${t.stageLabel}` : ''}</a>
      <div className="tc-title">{t.title}</div>
      {t.note && <div className="muted small">{t.note}</div>}
      <div className="tc-meta small">
        {t.kind === 'stage'
          ? <span className="muted">{t.assignee} · حالة المرحلة: {STATUS_LABEL[t.stageStatus || ''] || t.stageStatus}</span>
          : <>
            <select className="input sm" value={t.assignee} onChange={e => setAssignee(e.target.value)} aria-label="المسؤول">
              <option value="">— مسؤول —</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            {t.due && <span className={late ? 'warn-t' : 'muted'}>{late ? 'فات ' : ''}{t.due}</span>}
            <span className="spacer" />
            {t.status !== 'doing' && t.status !== 'done' && <button type="button" className="btn ghost sm" onClick={() => setStatus('doing')}>ابدأ</button>}
            {t.status !== 'done' && <button type="button" className="btn ghost sm" onClick={() => setStatus('done')}>✓ خلصت</button>}
            {t.status === 'done' && <button type="button" className="btn ghost sm" onClick={() => setStatus('todo')}>رجّعها</button>}
            <button type="button" className="icon-btn" title="امسح" onClick={async () => { if (confirm('تمسح المهمة؟')) { try { await company.deleteTask(t.slug, t.id); } catch (e: any) { toast(e.message, 'err'); } } }}>✕</button>
          </>}
      </div>
    </article>
  );
}

export function TaskForm({ products, team, onClose, defaults = {}, fixedSlug, stages }: { products?: ProductSummary[]; team: Member[]; onClose: () => void; defaults?: Partial<Task>; fixedSlug?: string; stages?: { id: string; label: string }[] }) {
  const [f, setF] = useState({ slug: fixedSlug || products?.[0]?.slug || '', title: '', assignee: defaults.assignee || '', due: '', stage: defaults.stage || '', note: '' });
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const stageList = stages || products?.find(p => p.slug === f.slug)?.stages || [];
  return (
    <form className="card form" onSubmit={async e => {
      e.preventDefault();
      try { await company.saveTask(f.slug, { title: f.title, assignee: f.assignee, due: f.due, stage: f.stage, note: f.note }); toast('المهمة اتضافت ✓'); onClose(); } catch (er: any) { toast(er.message, 'err'); }
    }}>
      <h3>مهمة جديدة</h3>
      <div className="form-grid">
        <label className="wide">المهمة<input className="input" value={f.title} onChange={up('title')} required autoFocus placeholder="مثلاً: صوّر ريل يوم 3" /></label>
        {!fixedSlug && <label>المنتج<select className="input" value={f.slug} onChange={up('slug')}>{products!.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>}
        <label>المرحلة<select className="input" value={f.stage} onChange={up('stage')}><option value="">— عامة —</option>{stageList.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>المسؤول<select className="input" value={f.assignee} onChange={up('assignee')}><option value="">— مش متحدد —</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select></label>
        <label>الميعاد<input type="date" className="input" value={f.due} onChange={up('due')} /></label>
        <label className="wide">تفاصيل<input className="input" value={f.note} onChange={up('note')} /></label>
      </div>
      <div className="row"><span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>إلغاء</button><button className="btn" disabled={!f.title.trim() || !f.slug}>ضيف</button></div>
    </form>
  );
}

function TeamEditor({ team, onClose }: { team: Member[]; onClose: () => void }) {
  const [list, setList] = useState<Member[]>(team.length ? team : [{ id: '', name: '', role: '' }]);
  const set = (i: number, k: keyof Member, v: string) => setList(l => l.map((m, j) => j === i ? { ...m, [k]: v } : m));
  return (
    <div className="card form">
      <h3>الفريق</h3>
      {list.map((m, i) => (
        <div key={i} className="row">
          <input className="input" placeholder="الاسم" value={m.name} onChange={e => set(i, 'name', e.target.value)} aria-label="الاسم" />
          <input className="input" placeholder="الدور (كتابة، ديزاين، ميديا باينج…)" value={m.role} onChange={e => set(i, 'role', e.target.value)} aria-label="الدور" />
          <button type="button" className="icon-btn" onClick={() => setList(l => l.filter((_, j) => j !== i))} aria-label="شيل">✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn ghost" onClick={() => setList(l => [...l, { id: '', name: '', role: '' }])}>+ عضو</button>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        <button type="button" className="btn" onClick={async () => { try { await company.save({ team: list }); toast('الفريق اتحفظ ✓'); onClose(); } catch (e: any) { toast(e.message, 'err'); } }}>حفظ</button>
      </div>
      <p className="muted small">الأسامي بتتحفظ في <code>company.json</code>. لو غيرت اسم حد، مهامه القديمة هتفضل بالاسم القديم.</p>
    </div>
  );
}

// ---------- جوه صفحة المنتج ----------
export function ProductTasks({ slug, stages }: { slug: string; stages: { id: string; label: string }[] }) {
  const v = useLiveVersion();
  const data = useAsync(() => company.productTasks(slug), [slug, v]);
  const comp = useAsync(() => company.get(), [v]);
  const [adding, setAdding] = useState(false);
  const open = (data.data?.tasks || []).filter(t => t.status !== 'done');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="card">
      <div className="card-h"><h3>مهام الفريق ({open.length})</h3><div className="row"><a className="small" href="#/tasks">كل المهام</a><button type="button" className="btn ghost sm" onClick={() => setAdding(x => !x)}>+ مهمة</button></div></div>
      {adding && <TaskForm team={comp.data?.team || []} fixedSlug={slug} stages={stages} onClose={() => setAdding(false)} />}
      {open.length ? (
        <ul className="ptasks">{open.map(t => (
          <li key={t.id}>
            <label className="chk"><input type="checkbox" onChange={async () => { try { await company.saveTask(slug, { id: t.id, status: 'done' }); } catch (e: any) { toast(e.message, 'err'); } }} /> {t.title}</label>
            <span className="muted small">{[t.assignee, stages.find(s => s.id === t.stage)?.label, t.due && (t.due < today ? `فات ${t.due}` : t.due)].filter(Boolean).join(' · ')}</span>
          </li>
        ))}</ul>
      ) : !adding && <p className="muted small">مفيش مهام مفتوحة.</p>}
    </div>
  );
}

export function StageOwner({ slug, stage }: { slug: string; stage: string }) {
  const v = useLiveVersion();
  const data = useAsync(() => company.productTasks(slug), [slug, v]);
  const comp = useAsync(() => company.get(), [v]);
  const team = comp.data?.team || [];
  const cur = data.data?.owners?.[stage] || '';
  if (!team.length && !cur) return null;
  return (
    <span className="owner">
      <label className="muted small" htmlFor={`own-${stage}`}>المسؤول</label>
      <select id={`own-${stage}`} className="input sm" value={cur} onChange={async e => { try { await company.setOwner(slug, stage, e.target.value); toast(e.target.value ? `${e.target.value} مسؤول عن المرحلة` : 'اتشال المسؤول'); } catch (er: any) { toast(er.message, 'err'); } }}>
        <option value="">— مش متحدد —</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
      </select>
    </span>
  );
}
