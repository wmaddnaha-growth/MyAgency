import { useEffect, useState } from 'react';
import { api, useAsync, useLiveVersion, useRoute, href, fileUrl, type SearchHit } from './api';
import { Home } from './Home';
import { Product } from './Product';
import { Empty, KIND_LABEL } from './ui';
import { Toaster } from './Edit';
import { JobsPage, JobPage, JobsIndicator } from './Jobs';
import { CalendarPage } from './Calendar';
import { ResultsPage } from './Results';
import { TasksPage } from './Tasks';

export function App() {
  const route = useRoute();
  const v = useLiveVersion();
  const config = useAsync(() => api.config(), [v]);
  const products = useAsync(() => api.products(), [v]);
  const slug = route.page === 'product' ? route.slug : '';
  const product = useAsync(() => (slug ? api.product(slug) : Promise.resolve(null)), [slug, v]);
  const [q, setQ] = useState(route.page === 'search' ? route.q : '');

  useEffect(() => { window.scrollTo(0, 0); }, [route.page, slug, route.page === 'product' ? route.tab : '']);
  useEffect(() => {
    const name = route.page === 'product' && product.data ? product.data.name : '';
    document.title = name ? `${name} — لوحة المنتجات` : 'لوحة المنتجات';
  }, [route, product.data]);

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">
          <img src={fileUrl('Brand Identity/05-logo-system/icon-color-dark.svg')} alt="" />
          <span>لوحة المنتجات</span>
        </a>
        <nav className="topnav" aria-label="الأقسام">
          {([['home', '#/', 'المنتجات'], ['calendar', '#/calendar', 'الكالندر'], ['results', '#/results', 'النتايج'], ['tasks', '#/tasks', 'المهام']] as const).map(([k, h, l]) => (
            <a key={k} href={h} className={route.page === k || (k === 'home' && route.page === 'product') ? 'on' : ''}>{l}</a>
          ))}
        </nav>
        <form className="search" onSubmit={e => { e.preventDefault(); if (q.trim()) location.hash = href({ page: 'search', q: q.trim() }); }}>
          <input className="input" type="search" placeholder="دوّر في كل الملفات (بوستات، بحث، إعلانات، كتب…)" value={q} onChange={e => setQ(e.target.value)} />
        </form>
        <JobsIndicator />
        <span className="live" title="الصفحة بتتحدث لوحدها لما أي ملف يتغير"><i />لايف</span>
      </header>

      {(config.error || products.error) && <div className="page"><Empty>السيرفر مش بيرد: {config.error || products.error}</Empty></div>}

      {route.page === 'home' && config.data && products.data && <Home data={products.data} config={config.data} />}
      {route.page === 'product' && (
        product.data && config.data ? <Product p={product.data} tab={route.tab} file={route.file} config={config.data} />
          : product.error ? <div className="page"><Empty>{product.error} — <a href="#/">ارجع للمنتجات</a></Empty></div>
          : <div className="page"><div className="loading">جاري التحميل…</div></div>
      )}
      {route.page === 'search' && <SearchPage q={route.q} />}
      {route.page === 'jobs' && (route.id ? <JobPage id={route.id} /> : <JobsPage />)}
      {route.page === 'calendar' && <CalendarPage />}
      {route.page === 'results' && <ResultsPage />}
      {route.page === 'tasks' && products.data && <TasksPage products={products.data.products} />}
      <Toaster />
      {(route.page === 'home' && (!config.data || !products.data) && !config.error && !products.error) && <div className="page"><div className="loading">جاري التحميل…</div></div>}
    </>
  );
}

function SearchPage({ q }: { q: string }) {
  const res = useAsync(() => api.search(q), [q]);
  const groups: Record<string, SearchHit[]> = {};
  for (const h of res.data || []) (groups[h.slug || h.path.split('/')[1]] ||= []).push(h);
  const tabFor = (h: SearchHit) => h.root === 'Books' ? 'source' : 'all';
  return (
    <div className="page stack">
      <div className="section-h"><h2>نتايج البحث عن «{q}»</h2>{res.data && <span className="muted">{res.data.length} نتيجة{res.data.length >= 60 ? ' (أول 60)' : ''}</span>}</div>
      {res.loading && <div className="loading">بدوّر…</div>}
      {res.data && !res.data.length && <Empty>مفيش نتايج.</Empty>}
      {Object.entries(groups).map(([g, hits]) => (
        <div key={g} className="card">
          <h3>{g.replace(/-/g, ' ')}</h3>
          <ul className="hits">
            {hits.map(h => (
              <li key={h.path}>
                {h.slug ? <a href={href({ page: 'product', slug: h.slug, tab: tabFor(h), file: h.path })}>{h.path.split('/').slice(2).join('/')}</a> : <a href={fileUrl(h.path)} target="_blank" rel="noreferrer">{h.path}</a>}
                <span className="muted"> · {KIND_LABEL[h.kind] || h.kind}</span>
                {h.snippet && <div className="snippet">…{h.snippet}…</div>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
