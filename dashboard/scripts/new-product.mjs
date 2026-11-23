#!/usr/bin/env node
// تسجيل منتج جديد (أو تسجيل الموجود) — نفس العقد اللي هيستخدمه زرار "ارفع وابدأ" بعدين.
//
//   node dashboard/scripts/new-product.mjs --name "اسم الكتاب" [--source "Books/<فولدر>"] [--type ebook] [--series "السلسلة"] [--status active]
//   node dashboard/scripts/new-product.mjs --scan        ← يسجّل أي فولدر في campaigns/ أو Books/ ملوش product.json
//   أضف --dry لعرض اللي هيتعمل من غير كتابة.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, slugify, normalizeName, walk } from '../lib/core.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };
const dry = !!opt('dry');
const config = loadConfig();
const today = new Date().toISOString().slice(0, 10);

function guessMainFile(sourceRel) {
  const files = walk(path.join(ROOT, sourceRel)).filter(f => ['pdf', 'md', 'docx', 'epub'].includes(f.ext));
  const score = f => {
    let s = 0;
    if (/الكتاب الكامل|كتاب|الدليل|book/i.test(f.name)) s += 10;
    if (/هدية|بونص|bonus|B\d+\s*–/i.test(f.inner)) s -= 20;
    if (f.inner.includes('/')) s -= 3;
    if (f.ext === 'pdf') s += 2;
    return s;
  };
  const best = files.map(f => [score(f), f]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0] || b[1].size - a[1].size)[0];
  return best ? best[1].path : null;
}

function writeProduct({ slug, name, source, type = 'ebook', series = null, status = 'active' }) {
  if (!config.productTypes[type]) throw new Error(`نوع غير معروف "${type}". الأنواع المتاحة: ${Object.keys(config.productTypes).join(', ')}`);
  const campDir = path.join(ROOT, config.paths.campaigns, slug);
  const pf = path.join(campDir, config.paths.productFile);
  if (fs.existsSync(pf)) { console.log(`= موجود بالفعل: ${path.relative(ROOT, pf)}`); return; }
  const product = {
    slug, name, type, status, series,
    source,
    mainFile: source ? guessMainFile(source) : null,
    created: today,
    notes: '',
    stages: {},
  };
  console.log(`+ ${path.relative(ROOT, pf)}\n${JSON.stringify(product, null, 2)}`);
  if (dry) return;
  fs.mkdirSync(campDir, { recursive: true });
  if (source) fs.mkdirSync(path.join(ROOT, source), { recursive: true });
  fs.writeFileSync(pf, JSON.stringify(product, null, 2) + '\n');
}

const srcRoot = path.join(ROOT, config.paths.sources);
const campRoot = path.join(ROOT, config.paths.campaigns);
const dirs = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name) : [];

if (opt('scan')) {
  const sources = dirs(srcRoot), camps = dirs(campRoot);
  const used = new Set();
  for (const slug of camps) {
    const src = sources.find(s => normalizeName(s) === normalizeName(slug));
    if (src) used.add(src);
    writeProduct({ slug, name: slug.replace(/-/g, ' '), source: src ? `${config.paths.sources}/${src}` : null });
  }
  for (const s of sources.filter(s => !used.has(s))) {
    writeProduct({ slug: slugify(s), name: slugify(s).replace(/-/g, ' '), source: `${config.paths.sources}/${s}` });
  }
} else if (typeof opt('name') === 'string') {
  const name = opt('name');
  const slug = typeof opt('slug') === 'string' ? opt('slug') : slugify(name);
  const source = typeof opt('source') === 'string' ? opt('source') : `${config.paths.sources}/${name}`;
  writeProduct({ slug, name, source, type: opt('type') || 'ebook', series: opt('series') || null, status: opt('status') || 'active' });
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n'));
  process.exit(1);
}
