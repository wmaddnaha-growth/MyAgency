#!/usr/bin/env node
// تسجيل منتج جديد (أو تسجيل الموجود) — نفس المنطق اللي بيستخدمه زرار «منتج جديد» في الداشبورد.
//
//   node dashboard/scripts/new-product.mjs --name "اسم الكتاب" [--source "Books/<فولدر>"] [--type ebook] [--series "السلسلة"] [--status active]
//   node dashboard/scripts/new-product.mjs --scan        ← يسجّل أي فولدر في campaigns/ أو Books/ ملوش product.json
//   أضف --dry لعرض اللي هيتعمل من غير كتابة.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, slugify, normalizeName } from '../lib/core.mjs';
import { createProduct } from '../lib/write.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };
const str = k => (typeof opt(k) === 'string' ? opt(k) : undefined);
const dry = !!opt('dry');
const config = loadConfig();

function run(spec) {
  try {
    const r = createProduct(spec, { dry });
    console.log(`+ ${r.path}\n${JSON.stringify(r.product, null, 2)}`);
  } catch (e) {
    console.log(`= ${e.message}`);
  }
}

const dirs = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name) : [];

if (opt('scan')) {
  const sources = dirs(path.join(ROOT, config.paths.sources));
  const camps = dirs(path.join(ROOT, config.paths.campaigns));
  const used = new Set();
  for (const slug of camps) {
    const src = sources.find(s => normalizeName(s) === normalizeName(slug));
    if (src) used.add(src);
    if (fs.existsSync(path.join(ROOT, config.paths.campaigns, slug, config.paths.productFile))) continue;
    run({ slug, name: slug.replace(/-/g, ' '), source: src ? `${config.paths.sources}/${src}` : undefined });
  }
  for (const s of sources.filter(s => !used.has(s))) {
    run({ slug: slugify(s), name: slugify(s).replace(/-/g, ' '), source: `${config.paths.sources}/${s}` });
  }
} else if (str('name')) {
  run({ name: str('name'), slug: str('slug'), source: str('source'), type: str('type') || 'ebook', series: str('series'), status: str('status') || 'active' });
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n'));
  process.exit(1);
}
