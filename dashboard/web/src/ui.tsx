import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { marked } from 'marked';
import { api, fileUrl, fmtSize, fmtDate, useLiveVersion, type FileInfo, type Stage } from './api';

export const STATUS_LABEL: Record<string, string> = {
  missing: 'لسه', partial: 'ناقص', done: 'موجود', blocked: 'مستني مرحلة قبله',
  'in-progress': 'شغال', review: 'مستني QA', approved: 'معتمد', 'needs-fix': 'محتاج تعديل', rejected: 'محتاج إعادة', skipped: 'مش مطلوب',
};

export function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  return <span className={`badge st-${status}${small ? ' sm' : ''}`}><i />{STATUS_LABEL[status] || status}</span>;
}

export function StageDots({ stages, onPick }: { stages: Stage[]; onPick?: (id: string) => void }) {
  return (
    <div className="dots" aria-label="حالة المراحل">
      {stages.map(s => (
        <button key={s.id} type="button" className={`dot st-${s.status}`} title={`${s.label}: ${STATUS_LABEL[s.status] || s.status}${s.detail ? ' — ' + s.detail : ''}`}
          onClick={onPick ? e => { e.preventDefault(); e.stopPropagation(); onPick(s.id); } : undefined} />
      ))}
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return <div className="progress" title={`${done} / ${total}`}><div style={{ width: pct + '%' }} /></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

// ---------- Markdown ----------
marked.setOptions({ gfm: true, breaks: false });
export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => {
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    return marked.parse(body) as string;
  }, [text]);
  return <div className="md" dir="auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------- CSV ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
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

// ---------- File viewer ----------
export function FileViewer({ file, onClose }: { file: FileInfo | { path: string; kind?: string; name?: string; size?: number; mtime?: number }; onClose?: () => void }) {
  const v = useLiveVersion();
  const kind = file.kind || guessKind(file.path);
  const name = file.name || file.path.split('/').pop()!;
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isText = ['text', 'table', 'json'].includes(kind);
  useEffect(() => {
    if (!isText) return;
    let alive = true; setErr(null);
    api.text(file.path).then(t => alive && setText(t), e => alive && setErr(e.message));
    return () => { alive = false; };
  }, [file.path, v, isText]);
  const src = fileUrl(file.path) + `&v=${v}`;

  return (
    <div className="viewer">
      <div className="viewer-head">
        <div className="viewer-title">
          <span className={`kind k-${kind}`}>{KIND_LABEL[kind] || kind}</span>
          <strong title={file.path}>{name}</strong>
          {file.size != null && <span className="muted">{fmtSize(file.size)}</span>}
          {file.mtime ? <span className="muted">· {fmtDate(file.mtime)}</span> : null}
        </div>
        <div className="viewer-actions">
          <button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(file.path)} title="نسخ المسار">نسخ المسار</button>
          <a className="btn ghost" href={fileUrl(file.path)} target="_blank" rel="noreferrer">فتح في تاب</a>
          <a className="btn ghost" href={fileUrl(file.path) + '&download'}>تنزيل</a>
          {onClose && <button type="button" className="btn ghost" onClick={onClose} aria-label="قفل">✕</button>}
        </div>
      </div>
      <div className="viewer-body">
        {err && <Empty>{err}</Empty>}
        {isText && text == null && !err && <div className="loading">جاري التحميل…</div>}
        {kind === 'text' && text != null && (file.path.endsWith('.md') ? <Markdown text={text} /> : <pre className="pre">{text}</pre>)}
        {kind === 'json' && text != null && <pre className="pre" dir="ltr">{pretty(text)}</pre>}
        {kind === 'table' && text != null && <CsvTable text={text} />}
        {kind === 'image' && <img className="media" src={src} alt={name} />}
        {kind === 'video' && <video className="media" src={src} controls preload="metadata" />}
        {kind === 'audio' && <audio src={src} controls />}
        {kind === 'pdf' && <iframe className="frame" src={fileUrl(file.path)} title={name} />}
        {kind === 'html' && <iframe className="frame" src={fileUrl(file.path)} title={name} sandbox="allow-scripts" />}
        {kind === 'other' && <Empty>مفيش معاينة للنوع ده — استخدم «تنزيل».</Empty>}
      </div>
    </div>
  );
}

function pretty(t: string) { try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; } }

export function CsvTable({ text }: { text: string }) {
  const rows = useMemo(() => parseCsv(text.replace(/^﻿/, '')), [text]);
  if (!rows.length) return <Empty>الملف فاضي</Empty>;
  return (
    <div className="table-wrap">
      <table className="table"><thead><tr>{rows[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((r, i) => <tr key={i}>{rows[0].map((_, j) => <td key={j}>{r[j]}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

export const KIND_LABEL: Record<string, string> = { text: 'نص', table: 'جدول', json: 'JSON', image: 'صورة', video: 'فيديو', audio: 'صوت', pdf: 'PDF', html: 'HTML', other: 'ملف' };
export function guessKind(p: string) {
  const e = p.split('.').pop()!.toLowerCase();
  if (['md', 'txt'].includes(e)) return 'text'; if (e === 'csv') return 'table'; if (e === 'json') return 'json';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(e)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(e)) return 'video'; if (['mp3', 'wav', 'm4a', 'ogg'].includes(e)) return 'audio';
  if (e === 'pdf') return 'pdf'; if (['html', 'htm'].includes(e)) return 'html'; return 'other';
}

// ---------- File list ----------
export function FileList({ files, active, onOpen, base }: { files: FileInfo[]; active?: string; onOpen: (f: FileInfo) => void; base?: string }) {
  if (!files.length) return <Empty>مفيش ملفات هنا لسه.</Empty>;
  return (
    <ul className="files">
      {files.map(f => {
        const label = base && f.path.startsWith(base) ? f.path.slice(base.length).replace(/^\//, '') : f.inner;
        return (
          <li key={f.path}>
            <button type="button" className={`file${active === f.path ? ' active' : ''}`} onClick={() => onOpen(f)}>
              <span className={`kind k-${f.kind}`}>{KIND_LABEL[f.kind] || f.kind}</span>
              <span className="file-name" title={f.path}>{label}</span>
              <span className="muted file-meta">{fmtSize(f.size)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
