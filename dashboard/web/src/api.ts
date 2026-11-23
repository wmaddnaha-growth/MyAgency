import { useEffect, useState, useCallback, useRef } from 'react';

export type FileInfo = { path: string; name: string; inner: string; ext: string; kind: string; size: number; mtime: number };
export type StageState = { status: string; note?: string; updatedAt?: string; by?: string } | null;
export type Stage = {
  id: string; label: string; group: string; skill: string; kind: 'single' | 'perDay' | 'collection';
  dir: string; outputs?: string[]; dependsOn: string[]; gate?: string; match?: string; args?: 'days'; prompt?: string;
  auto: string; status: string; progress: { done: number; total: number | null } | null; detail: string;
  fileCount: number; files?: FileInfo[]; manual: StageState; blockedBy: string[];
};
export type Brand = { token: string | null; hex: string | null } | null;
export type ProductSummary = {
  slug: string; name: string; type: string; typeLabel: string; status: string; series: string | null;
  source: string | null; mainFile: string | null; created: string | null; notes: string; registered: boolean;
  brand: Brand; stages: Stage[]; doneCount: number; totalStages: number;
  next: { id: string; label: string; skill: string } | null; warnings: string[]; lastUpdate: number;
  counts: Record<string, number>; fileCount: number; sourceCount: number; calendarDays: number;
};
export type Day = { week: number | null; day: number; row: Record<string, string>; copy: string | null; visuals: string[]; reels: string[] };
export type Review = { status: string; note?: string; updatedAt?: string };
export type ProductFull = ProductSummary & {
  reviews: Record<string, Review>;
  files: FileInfo[]; otherFiles: FileInfo[]; sourceFiles: FileInfo[];
  calendar: { headers: string[]; days: Day[] } | null;
};
export type Config = {
  productStatuses: Record<string, string>;
  productTypes: Record<string, { label: string; stages: string[] }>;
  stageStatuses: { auto: Record<string, string>; manual: Record<string, string> };
  stages: Stage[];
};
export type SearchHit = { path: string; kind: string; root: string; slug: string | null; snippet: string | null };

export const fileUrl = (p: string) => `/api/file?path=${encodeURIComponent(p)}`;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dashboard': '1' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || r.statusText) as Error & { status?: number; current?: string }; e.status = r.status; e.current = data.current; throw e; }
  return data as T;
}
export type Commit = { committed: boolean; reason?: string };
export type HistoryItem = { hash: string; date: number; author: string; subject: string };

export type JobChange = { path: string; change: 'added' | 'modified' | 'deleted' };
export type Job = {
  id: string; slug: string; productName: string; stage: string; stageLabel: string; skill: string; action: 'run' | 'fix' | 'qa';
  days: number[]; extra: string; parentId: string | null; status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';
  createdAt: number; startedAt: number | null; endedAt: number | null; sessionId: string | null; costUsd: number | null; turns: number | null;
  result: string | null; verdict: string | null; changed: JobChange[]; error: string | null; budgetUsd: number; tools: string[]; model: string | null;
  prompt?: string; systemPrompt?: string; autoQa?: boolean;
};
export type LogEv = { t: number; kind: string; text: string; name?: string };
export type RunnerInfo = { cli: { installed: boolean; loggedIn: boolean; authMethod?: string; error?: string }; runner: { maxConcurrent?: number; budgetUsd?: number; autoQa?: boolean; model?: string | null } };

export const api = {
  runner: (refresh = false) => getJson<RunnerInfo>('/api/runner' + (refresh ? '?refresh' : '')),
  jobs: (slug?: string) => getJson<Job[]>('/api/jobs' + (slug ? `?slug=${encodeURIComponent(slug)}` : '')),
  job: (id: string) => getJson<Job & { log: LogEv[] }>(`/api/jobs/${id}`),
  createJob: (spec: { slug: string; stage: string; action: string; days?: string; extra?: string; parentId?: string; message?: string }) => post<Job>('/api/jobs', spec),
  cancelJob: (id: string) => post<Job>(`/api/jobs/${id}/cancel`, {}),
  config: () => getJson<Config>('/api/config'),
  products: () => getJson<{ products: ProductSummary[]; unregisteredSources: { folder: string; suggestedName: string; suggestedSlug: string }[] }>('/api/products'),
  product: (slug: string) => getJson<ProductFull>(`/api/products/${encodeURIComponent(slug)}`),
  search: (q: string) => getJson<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
  textMeta: (p: string) => getJson<{ path: string; content: string; hash: string; mtime: number }>(`/api/text?path=${encodeURIComponent(p)}`),
  save: (path: string, content: string, baseHash?: string, force = false) =>
    post<{ path: string; hash: string; commit: Commit; sync: null | { changed: number; removed: number; added: string[]; unsynced: string[] } }>('/api/save', { path, content, baseHash, force }),
  newFile: (dir: string, name: string, content = '') => post<{ path: string }>('/api/new-file', { dir, name, content }),
  trash: (path: string) => post<{ path: string; trashedTo: string }>('/api/trash', { path }),
  history: (p: string) => getJson<HistoryItem[]>(`/api/history?path=${encodeURIComponent(p)}`),
  version: (p: string, hash: string) => getJson<{ content: string }>(`/api/version?path=${encodeURIComponent(p)}&hash=${hash}`),
  restore: (path: string, hash: string) => post<{ path: string }>('/api/restore', { path, hash }),
  setStage: (slug: string, stage: string, status: string, note: string) => post(`/api/products/${encodeURIComponent(slug)}/stage`, { stage, status, note }),
  setReview: (slug: string, path: string, status: string | null, note = '') => post(`/api/products/${encodeURIComponent(slug)}/review`, { path, status, note }),
  updateMeta: (slug: string, patch: Record<string, unknown>) => post(`/api/products/${encodeURIComponent(slug)}/meta`, patch),
  createProduct: (data: Record<string, unknown>) => post<{ product: { slug: string } }>('/api/products', data),
  text: async (p: string) => { const r = await fetch(fileUrl(p)); if (!r.ok) throw new Error('تعذر فتح الملف'); return r.text(); },
};

export function upload(dir: string, file: File, onProgress?: (pct: number) => void): Promise<{ path: string }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/upload?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(file.name)}`);
    x.setRequestHeader('X-Dashboard', '1');
    x.upload.onprogress = e => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => { let d: any = {}; try { d = JSON.parse(x.responseText); } catch { /* */ } x.status < 300 ? resolve(d) : reject(new Error(d.error || 'فشل الرفع')); };
    x.onerror = () => reject(new Error('فشل الرفع'));
    x.send(file);
  });
}

export const isWritable = (p: string) => /^(campaigns|Books)\//.test(p);

// ---------- تعديلات مش محفوظة ----------
const dirty = new Set<string>();
export function setDirty(id: string, on: boolean) { on ? dirty.add(id) : dirty.delete(id); }
export const hasDirty = () => dirty.size > 0;
const LEAVE = 'فيه تعديلات مش محفوظة. تسيبها وتمشي؟';
addEventListener('beforeunload', e => { if (dirty.size) { e.preventDefault(); e.returnValue = LEAVE; } });

// إصدار بيزيد كل ما ملف يتغير على الديسك (SSE)
let version = 0;
const listeners = new Set<(v: number) => void>();
let es: EventSource | null = null;
const evListeners = new Map<string, Set<(d: any) => void>>();
function ensureEvents() {
  if (es) return;
  es = new EventSource('/api/events');
  es.addEventListener('change', () => { version++; listeners.forEach(l => l(version)); });
  for (const name of ['job', 'log']) es.addEventListener(name, e => { const d = JSON.parse((e as MessageEvent).data); evListeners.get(name)?.forEach(f => f(d)); });
}
export function useServerEvent(name: 'job' | 'log', cb: (d: any) => void) {
  const ref = useRef(cb); ref.current = cb;
  useEffect(() => {
    ensureEvents();
    const f = (d: any) => ref.current(d);
    if (!evListeners.has(name)) evListeners.set(name, new Set());
    evListeners.get(name)!.add(f);
    return () => { evListeners.get(name)!.delete(f); };
  }, [name]);
}
// قايمة المهام لايف (بتتحدث مع كل حدث job)
export function useJobs(slug?: string) {
  const [list, setList] = useState<Job[] | null>(null);
  useEffect(() => { let a = true; api.jobs(slug).then(l => a && setList(l)).catch(() => a && setList([])); return () => { a = false; }; }, [slug]);
  useServerEvent('job', ({ job }: { job: Job }) => {
    if (slug && job.slug !== slug) return;
    setList(l => { const rest = (l || []).filter(x => x.id !== job.id); return [job, ...rest].sort((a, b) => b.createdAt - a.createdAt); });
  });
  return list;
}
export function useLiveVersion() {
  const [v, setV] = useState(version);
  useEffect(() => { ensureEvents(); listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return v;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const run = useCallback(fn, deps); // eslint-disable-line
  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true }));
    run().then(data => alive && setState({ data, loading: false }), e => alive && setState({ error: String(e.message || e), loading: false }));
    return () => { alive = false; };
  }, [run]);
  return state;
}

// ---------- Router (hash) ----------
export type Route = { page: 'home' } | { page: 'product'; slug: string; tab: string; file?: string } | { page: 'search'; q: string } | { page: 'jobs'; id?: string };
export function parseHash(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [pathPart, query = ''] = h.split('?');
  const qs = new URLSearchParams(query);
  const parts = pathPart.split('/').filter(Boolean);
  if (parts[0] === 'p' && parts[1]) return { page: 'product', slug: parts[1], tab: parts[2] || 'overview', file: qs.get('f') || undefined };
  if (parts[0] === 'search') return { page: 'search', q: qs.get('q') || '' };
  if (parts[0] === 'jobs') return { page: 'jobs', id: parts[1] };
  return { page: 'home' };
}
export function href(r: Route) {
  if (r.page === 'product') return `#/p/${encodeURIComponent(r.slug)}/${r.tab}${r.file ? `?f=${encodeURIComponent(r.file)}` : ''}`;
  if (r.page === 'search') return `#/search?q=${encodeURIComponent(r.q)}`;
  if (r.page === 'jobs') return r.id ? `#/jobs/${r.id}` : '#/jobs';
  return '#/';
}
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    let last = location.hash;
    const f = () => {
      if (dirty.size && !confirm(LEAVE)) { history.replaceState(null, '', last || '#/'); return; }
      dirty.clear();
      last = location.hash; setR(parseHash());
    };
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

// ---------- helpers ----------
export const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
export const fmtDate = (ms: number) => ms ? new Date(ms).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const DONE = ['done', 'approved', 'skipped'];

export const fmtDur = (ms: number) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} ث` : `${Math.floor(s / 60)} د ${s % 60} ث`; };
export const JOB_STATUS: Record<string, string> = { queued: 'في الطابور', running: 'شغالة', done: 'خلصت', failed: 'فشلت', cancelled: 'اتلغت', interrupted: 'اتقطعت' };
export const JOB_ACTION: Record<string, string> = { run: 'تشغيل', fix: 'تعديل حسب الملاحظات', qa: 'مراجعة QA' };
