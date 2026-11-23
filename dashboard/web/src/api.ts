import { useEffect, useState, useCallback } from 'react';

export type FileInfo = { path: string; name: string; inner: string; ext: string; kind: string; size: number; mtime: number };
export type StageState = { status: string; note?: string; updatedAt?: string; by?: string } | null;
export type Stage = {
  id: string; label: string; group: string; skill: string; kind: 'single' | 'perDay' | 'collection';
  dir: string; outputs?: string[]; dependsOn: string[]; gate?: string; match?: string;
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
export type ProductFull = ProductSummary & {
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
export const api = {
  config: () => getJson<Config>('/api/config'),
  products: () => getJson<{ products: ProductSummary[]; unregisteredSources: { folder: string; suggestedName: string; suggestedSlug: string }[] }>('/api/products'),
  product: (slug: string) => getJson<ProductFull>(`/api/products/${encodeURIComponent(slug)}`),
  search: (q: string) => getJson<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
  text: async (p: string) => { const r = await fetch(fileUrl(p)); if (!r.ok) throw new Error('تعذر فتح الملف'); return r.text(); },
};

// إصدار بيزيد كل ما ملف يتغير على الديسك (SSE)
let version = 0;
const listeners = new Set<(v: number) => void>();
let es: EventSource | null = null;
function ensureEvents() {
  if (es) return;
  es = new EventSource('/api/events');
  es.addEventListener('change', () => { version++; listeners.forEach(l => l(version)); });
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
export type Route = { page: 'home' } | { page: 'product'; slug: string; tab: string; file?: string } | { page: 'search'; q: string };
export function parseHash(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [pathPart, query = ''] = h.split('?');
  const qs = new URLSearchParams(query);
  const parts = pathPart.split('/').filter(Boolean);
  if (parts[0] === 'p' && parts[1]) return { page: 'product', slug: parts[1], tab: parts[2] || 'overview', file: qs.get('f') || undefined };
  if (parts[0] === 'search') return { page: 'search', q: qs.get('q') || '' };
  return { page: 'home' };
}
export function href(r: Route) {
  if (r.page === 'product') return `#/p/${encodeURIComponent(r.slug)}/${r.tab}${r.file ? `?f=${encodeURIComponent(r.file)}` : ''}`;
  if (r.page === 'search') return `#/search?q=${encodeURIComponent(r.q)}`;
  return '#/';
}
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => { const f = () => setR(parseHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}

// ---------- helpers ----------
export const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
export const fmtDate = (ms: number) => ms ? new Date(ms).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const DONE = ['done', 'approved', 'skipped'];
