// Git helper: كل تعديل من الداشبورد بيتسجل commit لوحده، فتقدر ترجع لأي نسخة.
// العمليات متسلسلة (queue) عشان ميحصلش تعارض على index.lock.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './core.mjs';

const hasGit = () => fs.existsSync(path.join(ROOT, '.git'));

function git(args, { allowFail = false, maxBuffer = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-c', 'core.quotepath=false', ...args], { cwd: ROOT, maxBuffer, encoding: 'buffer' }, (err, stdout, stderr) => {
      if (err && !allowFail) return reject(new Error(stderr.toString() || err.message));
      resolve({ ok: !err, out: stdout, err: stderr.toString() });
    });
  });
}

let chain = Promise.resolve();
const queue = fn => (chain = chain.then(fn, fn));

// يعمل commit للمسارات دي بس (حتى لو فيه تعديلات تانية في البروجكت)
export function commitPaths(paths, message) {
  if (!hasGit() || !paths.length) return Promise.resolve({ committed: false });
  return queue(async () => {
    const tracked = [];
    for (const p of paths) {
      const ignored = await git(['check-ignore', '-q', '--', p], { allowFail: true });
      if (ignored.ok) continue; // ميديا تقيلة مستبعدة من git
      tracked.push(p);
    }
    if (!tracked.length) return { committed: false, reason: 'ignored' };
    await git(['add', '-A', '--', ...tracked], { allowFail: true });
    const diff = await git(['diff', '--cached', '--quiet', '--', ...tracked], { allowFail: true });
    if (diff.ok) return { committed: false, reason: 'no changes' };
    const r = await git(['commit', '-q', '-m', message, '--only', '--', ...tracked], { allowFail: true });
    return { committed: r.ok, error: r.ok ? undefined : r.err };
  });
}

export async function fileHistory(relPath, limit = 40) {
  if (!hasGit()) return [];
  const r = await git(['log', '--follow', `-n${limit}`, '--format=%H%x09%at%x09%an%x09%s', '--', relPath], { allowFail: true });
  if (!r.ok) return [];
  return r.out.toString().trim().split('\n').filter(Boolean).map(l => {
    const [hash, at, author, ...s] = l.split('\t');
    return { hash, date: Number(at) * 1000, author, subject: s.join('\t') };
  });
}

// محتوى الملف في commit معيّن (بيدوّر على الاسم القديم لو الملف اتنقل)
export async function fileAt(hash, relPath) {
  if (!/^[0-9a-f]{7,40}$/.test(hash)) throw new Error('hash غير صالح');
  let r = await git(['show', `${hash}:${relPath}`], { allowFail: true });
  if (r.ok) return r.out;
  const names = await git(['log', '--follow', '--name-only', '--format=%H', '--', relPath], { allowFail: true });
  const lines = names.out.toString().split('\n');
  const i = lines.indexOf(hash);
  const old = lines.slice(i + 1).find(Boolean);
  if (old) { r = await git(['show', `${hash}:${old}`], { allowFail: true }); if (r.ok) return r.out; }
  throw new Error('النسخة دي مش موجودة');
}

export async function gitStatus() {
  if (!hasGit()) return { enabled: false };
  const r = await git(['status', '--porcelain'], { allowFail: true });
  return { enabled: true, dirty: r.out.toString().split('\n').filter(Boolean).length };
}
