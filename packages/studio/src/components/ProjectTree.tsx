'use client';

/**
 * 專案頁的「主體 → 平台版本 → 語言」樹。
 *
 * 作品（work）＝同一份內容的各語言版本；原始語言那份是作品的根。
 * 主體作品＝底下有衍生版本、或是部落格且本身沒有主體的作品。
 * 衍生作品掛在主體底下；其餘沒有主體的作品列在「獨立版本」。
 */

import Link from 'next/link';
import { STUDIO_ROUTES } from '../constants';
import type { Document } from '../types';
import { PlatformBadge, StageBadge, relativeTime } from './ui';

type Work = { root: Document; versions: Document[] };

function groupWorks(docs: Document[]): Work[] {
  const byWork = new Map<string, Document[]>();
  for (const d of docs) byWork.set(d.work_id, [...(byWork.get(d.work_id) || []), d]);
  return [...byWork.values()].map((versions) => {
    const root = versions.find((v) => !v.translation_source_id) || versions[0];
    const rest = versions.filter((v) => v.id !== root.id).sort((a, b) => a.language.localeCompare(b.language));
    return { root, versions: [root, ...rest] };
  });
}

export function buildTree(docs: Document[]) {
  const works = groupWorks(docs);
  const children = new Map<number, Work[]>();
  for (const w of works) {
    if (w.root.derived_from_id) children.set(w.root.derived_from_id, [...(children.get(w.root.derived_from_id) || []), w]);
  }
  const known = new Set(docs.map((d) => d.id));
  const mains = works.filter((w) => !w.root.derived_from_id && (children.has(w.root.id) || w.root.platform === 'blog'));
  const mainIds = new Set(mains.map((w) => w.root.id));
  // 主體不在這個專案清單裡（理論上不會發生）時當獨立版本顯示，不讓它消失
  const independent = works.filter((w) => !mainIds.has(w.root.id) && (!w.root.derived_from_id || !known.has(w.root.derived_from_id)));
  return { mains, children, independent };
}

function WorkRow({ work, role }: { work: Work; role: 'main' | 'derived' | 'independent' }) {
  const { root } = work;
  return (
    <div className={`rounded-lg border p-3 ${role === 'main' ? 'border-admin-accent-300 bg-admin-accent-50/40 dark:bg-admin-accent-800/10' : 'border-border'} ${root.derived_changed ? 'border-amber-400' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        {role === 'main' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-admin-accent-600 text-white">主體</span>}
        <PlatformBadge platform={root.platform} />
        <Link href={STUDIO_ROUTES.workspace(root.id)} className="text-sm font-medium text-foreground truncate flex-1 hover:text-admin-accent-600">
          {root.title || '（無標題）'}
        </Link>
        <StageBadge stage={root.stage} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
        {work.versions.map((v) => (
          <Link key={v.id} href={STUDIO_ROUTES.workspace(v.id)}
            title={v.source_changed ? '翻譯來源已更新，待檢查' : v.derived_changed ? '主體已更新，待檢查' : undefined}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 md:py-0.5 hover:bg-muted ${v.source_changed || v.derived_changed ? 'border-amber-400 text-amber-800 dark:text-amber-200' : 'border-border text-muted-foreground'}`}>
            {v.language}
            {(v.source_changed || v.derived_changed) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="待檢查" />}
          </Link>
        ))}
        <span className="text-muted-foreground ml-auto">{relativeTime(root.updated_at)}</span>
      </div>
      {root.derived_changed && <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">主體已更新，這個版本待檢查</p>}
    </div>
  );
}

export function ProjectTree({ documents }: { documents: Document[] }) {
  const { mains, children, independent } = buildTree(documents);
  return (
    <div className="space-y-4">
      {mains.map((m) => {
        const kids = (children.get(m.root.id) || []).sort((a, b) => a.root.platform.localeCompare(b.root.platform));
        return (
          <div key={m.root.work_id}>
            <WorkRow work={m} role="main" />
            {kids.length > 0 ? (
              <ul className="mt-2 ml-3 pl-3 border-l-2 border-border space-y-2">
                {kids.map((k) => <li key={k.root.work_id}><WorkRow work={k} role="derived" /></li>)}
              </ul>
            ) : (
              <p className="mt-1 ml-6 text-[11px] text-muted-foreground">還沒有衍生版本。按「新增版本」選 FB、IG 等平台，會自動掛在這篇底下。</p>
            )}
          </div>
        );
      })}
      {independent.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">獨立版本（沒有指定主體；可在工作區上方的「衍生自」指定）</p>
          <ul className="space-y-2">
            {independent.map((w) => <li key={w.root.work_id}><WorkRow work={w} role="independent" /></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
