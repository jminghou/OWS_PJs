'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@ows/admin-app';
import { Image as ImageIcon, Link2, Quote } from 'lucide-react';
import { todayApi } from '../api';
import { FLOW_STEPS, PLATFORM_META, STUDIO_ROUTES } from '../constants';
import type { FlowStep } from '../constants';
import type { InboxItem, TodayResponse } from '../types';
import { FlowBar } from '../components/FlowBar';
import { NewProjectDialog } from '../components/NewProjectDialog';
import { Empty, PageHeader, Section, StageBadge, StudioPage, btnPrimary, relativeTime } from '../components/ui';

const INBOX_KIND: Record<InboxItem['kind'], { label: string; icon: React.ReactNode }> = {
  text: { label: '一句靈感', icon: <Quote size={16} /> },
  link: { label: '參考資料', icon: <Link2 size={16} /> },
  image: { label: '圖片', icon: <ImageIcon size={16} /> },
};

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    todayApi.get().then(setData).catch((e) => setError(e.message || '載入失敗'));
  }, []);

  const counts = data?.flow_counts;
  const activeStep: FlowStep | null = counts
    ? (FLOW_STEPS.find((s) => (counts[s.key] ?? 0) > 0)?.key ?? null)
    : null;

  // 「繼續寫作」：正在進行的優先（write/edit），再補最近編輯，共 5 筆
  const writing = data
    ? [...data.pending, ...data.recent.filter((d) => !data.pending.some((p) => p.id === d.id))].slice(0, 5)
    : [];

  return (
    <AdminLayout>
      <StudioPage>
        <PageHeader
          title="今天"
          description="接續正在進行的內容，而不是先整理資料。"
          actions={<button type="button" onClick={() => setCreating(true)} className={btnPrimary}>建立內容專案</button>}
        />
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mb-4">
          <Section title="繼續寫作" extra={<Link href={STUDIO_ROUTES.projects} className="text-xs text-muted-foreground hover:text-foreground">全部專案</Link>}>
            {!data ? <Empty text="載入中…" /> : writing.length === 0 ? (
              <Empty text="還沒有任何文件。建立內容專案，從一個主題開始。" />
            ) : (
              <ul className="divide-y divide-border/60">
                {writing.map((d) => (
                  <li key={d.id}>
                    <Link href={STUDIO_ROUTES.workspace(d.id)} className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-muted transition">
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium truncate">{d.title || '（無標題）'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {PLATFORM_META[d.platform]?.label} · {relativeTime(d.updated_at)}編輯
                          {typeof d.revision_count === 'number' && d.revision_count > 0 && ` · v${d.revision_count}`}
                          {d.project?.title && <span className="hidden md:inline"> · {d.project.title}</span>}
                        </div>
                      </div>
                      <StageBadge stage={d.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={data ? `收集箱待整理${data.inbox.count ? ` · ${data.inbox.count}` : ''}` : '收集箱待整理'} extra={<Link href={STUDIO_ROUTES.inbox} className="text-xs text-muted-foreground hover:text-foreground">收集箱</Link>}>
            {!data ? <Empty text="載入中…" /> : data.inbox.items.length === 0 ? (
              <Empty text="收集箱是空的。用頂列的「快速收集」隨手丟東西進來。" />
            ) : (
              <ul className="divide-y divide-border/60">
                {data.inbox.items.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <Link href={STUDIO_ROUTES.inbox} className="flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-muted transition">
                      <span className="mt-0.5 text-muted-foreground flex-shrink-0">{INBOX_KIND[i.kind]?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] leading-snug line-clamp-2">{i.title || i.body || i.url}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{INBOX_KIND[i.kind]?.label} · {relativeTime(i.created_at)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <FlowBar counts={counts} active={activeStep} />

        {data && data.upcoming.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            即將發布 {data.upcoming.length} 篇 —— 到<Link href={STUDIO_ROUTES.publishing} className="underline mx-0.5">發布中心</Link>查看排程。
          </p>
        )}
      </StudioPage>

      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </AdminLayout>
  );
}
