'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@ows/admin-app';
import { ExternalLink } from 'lucide-react';
import { AdminResponsiveTable } from '@ows/ui/admin';
import { documentApi, publishingApi } from '../api';
import { PLATFORMS, PLATFORM_META, STAGE_META, STUDIO_ROUTES } from '../constants';
import type { Document, Platform, Stage } from '../types';
import { Empty, LanguageBadge, PageHeader, Pill, PlatformBadge, StageBadge, StudioPage, formatDate, fromLocalInput, selectCls, toLocalInput } from '../components/ui';

const STAGE_FILTERS: Array<{ key: Stage | 'all'; label: string }> = [
  { key: 'all', label: '全部' }, { key: 'write', label: '撰寫' }, { key: 'edit', label: '編輯' },
  { key: 'scheduled', label: '待發布' }, { key: 'published', label: '已發布' }, { key: 'archived', label: '封存' },
];

export default function PublishingPage() {
  const [items, setItems] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [language, setLanguage] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  useEffect(()=>{ documentApi.options().then(o=>setLanguages(o.languages)).catch(()=>{}); },[]);
  const [stage, setStage] = useState<Stage | 'all'>('all');

  const load = useCallback(() => {
    setLoading(true);
    publishingApi.list({ platform, stage, language: language || undefined, per_page: 200 }).then((r) => setItems(r.items)).finally(() => setLoading(false));
  }, [platform, stage, language]);
  useEffect(() => { load(); }, [load]);

  const patch = async (doc: Document, data: Parameters<typeof documentApi.updatePublishing>[1]) => {
    try {
      const res = await documentApi.updatePublishing(doc.id, data);
      setItems((prev) => prev.map((d) => d.id === doc.id ? { ...d, ...res.document } : d));
    } catch (e: any) { alert(e.message || '更新失敗'); }
  };

  const titleCell = (d: Document) => (
    <>
      <Link href={STUDIO_ROUTES.workspace(d.id)} className="font-medium text-foreground hover:text-admin-accent-600 break-words">{d.title || '（無標題）'}</Link>
      <div className="text-[11px] text-muted-foreground">{d.project?.title}</div>
    </>
  );
  const stageSelect = (d: Document) => (
    <select disabled={!!d.content_id} title={d.content_id ? "請在寫作工作區發布或下架" : undefined} value={d.stage} onChange={(e) => patch(d, { stage: e.target.value as Stage })} className={`${selectCls} w-full md:w-auto`}>
      {(Object.keys(STAGE_META) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
    </select>
  );
  const scheduleInput = (d: Document) => (
    <input disabled={!!d.content_id} type="datetime-local" defaultValue={toLocalInput(d.scheduled_at)} onBlur={(e) => { const v = fromLocalInput(e.target.value); if (v !== (d.scheduled_at ? fromLocalInput(toLocalInput(d.scheduled_at)) : null)) patch(d, { scheduled_at: v }); }}
      className={`${selectCls} w-full md:w-auto`} />
  );
  const revisionCell = (d: Document) => (
    d.current_revision_id ? <span className="text-xs text-emerald-600">#{d.current_revision_id}</span> : <span className="text-xs text-muted-foreground/60">—</span>
  );
  const urlField = (d: Document) => (
    <div className="flex items-center gap-1">
      <input disabled={!!d.content_id} defaultValue={d.published_url || ''} placeholder="https://…" onBlur={(e) => { if ((e.target.value || null) !== (d.published_url || null)) patch(d, { published_url: e.target.value || null }); }}
        className={`${selectCls} w-full`} />
      {d.published_url && <a href={d.published_url} target="_blank" rel="noreferrer" aria-label="開啟網址" className="flex-shrink-0 p-2.5 -m-1 md:p-0 md:m-0 text-muted-foreground hover:text-admin-accent-600"><ExternalLink size={14} /></a>}
      {!d.published_url && d.content && d.content.status === 'published' && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">/posts/{d.content.slug}</span>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <StudioPage width="wide">
        <Link href="/admin/articles" className="inline-block py-2 md:py-0 text-sm underline">所有網站文章／接管既有文章</Link><PageHeader title="發布中心" description="各平台內容的撰寫狀態、預定日期、正式版本、發布日期與網址。" />

        <div className="flex flex-wrap items-center gap-2 mb-4"><select aria-label="篩選語言" value={language} onChange={e=>setLanguage(e.target.value)} className={selectCls}><option value="">全部語言</option>{languages.map(l=><option key={l}>{l}</option>)}</select>
          {/* 手機：篩選鈕各自一列、可橫向捲動，不擠在一起 */}
          <div className="flex gap-1 text-xs max-w-full overflow-x-auto -mx-1 px-1 basis-full sm:basis-auto">
            <Pill active={platform === 'all'} onClick={() => setPlatform('all')}>所有平台</Pill>
            {PLATFORMS.map((p) => (
              <Pill key={p} active={platform === p} onClick={() => setPlatform(p)}>{PLATFORM_META[p].short}</Pill>
            ))}
          </div>
          <div className="flex gap-1 text-xs max-w-full overflow-x-auto -mx-1 px-1 basis-full sm:basis-auto sm:ml-auto">
            {STAGE_FILTERS.map((s) => (
              <Pill key={s.key} tone="accent" active={stage === s.key} onClick={() => setStage(s.key)}>{s.label}</Pill>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-xl"><Empty text="載入中…" /></div>
        ) : (
          <div className="md:bg-card md:text-card-foreground md:border md:border-border md:rounded-xl">
            <AdminResponsiveTable
              rows={items}
              rowKey={(d) => d.id}
              empty={<div className="bg-card border border-border rounded-xl"><Empty text="沒有符合的內容。" /></div>}
              rowClassName={() => 'hover:bg-muted/60'}
              columns={[
                { key: 'platform', header: '平台', cell: (d) => <span className="inline-flex items-center gap-1"><PlatformBadge platform={d.platform} /><LanguageBadge language={d.language} /></span> },
                { key: 'title', header: '標題 / 專案', className: 'min-w-[14rem]', cell: titleCell },
                { key: 'stage', header: '狀態', cell: stageSelect },
                { key: 'scheduled', header: '預定日期', cell: scheduleInput },
                { key: 'revision', header: '正式版', className: 'text-xs text-muted-foreground', cell: revisionCell },
                { key: 'published', header: '發布日期', className: 'text-xs text-muted-foreground whitespace-nowrap', cell: (d) => d.published_at ? formatDate(d.published_at, true) : <StageBadge stage={d.stage} /> },
                { key: 'url', header: '網址', className: 'min-w-[12rem]', cell: urlField },
              ]}
              renderCard={(d) => (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center gap-1 pt-0.5"><PlatformBadge platform={d.platform} /><LanguageBadge language={d.language} /></span>
                    <div className="flex-1 min-w-0">{titleCell(d)}</div>
                    {revisionCell(d)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="space-y-1"><span className="text-muted-foreground">狀態</span>{stageSelect(d)}</label>
                    <div className="space-y-1"><span className="block text-muted-foreground">發布日期</span><div className="py-1">{d.published_at ? formatDate(d.published_at, true) : <StageBadge stage={d.stage} />}</div></div>
                  </div>
                  <label className="block space-y-1 text-xs"><span className="text-muted-foreground">預定日期</span>{scheduleInput(d)}</label>
                  <div className="space-y-1 text-xs"><span className="block text-muted-foreground">網址</span>{urlField(d)}</div>
                </div>
              )}
            />
          </div>
        )}
      </StudioPage>
    </AdminLayout>
  );
}
