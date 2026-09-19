'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@ows/admin-app';
import { ExternalLink } from 'lucide-react';
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

  return (
    <AdminLayout>
      <StudioPage width="wide">
        <Link href="/admin/articles" className="text-sm underline">所有網站文章／接管既有文章</Link><PageHeader title="發布中心" description="各平台內容的撰寫狀態、預定日期、正式版本、發布日期與網址。" />

        <div className="flex flex-wrap items-center gap-2 mb-4"><select aria-label="篩選語言" value={language} onChange={e=>setLanguage(e.target.value)} className={selectCls}><option value="">全部語言</option>{languages.map(l=><option key={l}>{l}</option>)}</select>
          <div className="flex gap-1 text-xs">
            <Pill active={platform === 'all'} onClick={() => setPlatform('all')}>所有平台</Pill>
            {PLATFORMS.map((p) => (
              <Pill key={p} active={platform === p} onClick={() => setPlatform(p)}>{PLATFORM_META[p].short}</Pill>
            ))}
          </div>
          <div className="flex gap-1 text-xs ml-auto">
            {STAGE_FILTERS.map((s) => (
              <Pill key={s.key} tone="accent" active={stage === s.key} onClick={() => setStage(s.key)}>{s.label}</Pill>
            ))}
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">平台</th>
                <th className="text-left px-3 py-2 font-medium">標題 / 專案</th>
                <th className="text-left px-3 py-2 font-medium">狀態</th>
                <th className="text-left px-3 py-2 font-medium">預定日期</th>
                <th className="text-left px-3 py-2 font-medium">正式版</th>
                <th className="text-left px-3 py-2 font-medium">發布日期</th>
                <th className="text-left px-3 py-2 font-medium">網址</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr><td colSpan={7}><Empty text="載入中…" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7}><Empty text="沒有符合的內容。" /></td></tr>
              ) : items.map((d) => (
                <tr key={d.id} className="hover:bg-muted/60">
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><PlatformBadge platform={d.platform} /><LanguageBadge language={d.language} /></span></td>
                  <td className="px-3 py-2 min-w-[14rem]">
                    <Link href={STUDIO_ROUTES.workspace(d.id)} className="font-medium text-foreground hover:text-admin-accent-600">{d.title || '（無標題）'}</Link>
                    <div className="text-[11px] text-muted-foreground">{d.project?.title}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={!!d.content_id} title={d.content_id ? "請在寫作工作區發布或下架" : undefined} value={d.stage} onChange={(e) => patch(d, { stage: e.target.value as Stage })} className={selectCls}>
                      {(Object.keys(STAGE_META) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input disabled={!!d.content_id} type="datetime-local" defaultValue={toLocalInput(d.scheduled_at)} onBlur={(e) => { const v = fromLocalInput(e.target.value); if (v !== (d.scheduled_at ? fromLocalInput(toLocalInput(d.scheduled_at)) : null)) patch(d, { scheduled_at: v }); }}
                      className={selectCls} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {d.current_revision_id ? <span className="text-emerald-600">#{d.current_revision_id}</span> : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {d.published_at ? formatDate(d.published_at, true) : <StageBadge stage={d.stage} />}
                  </td>
                  <td className="px-3 py-2 min-w-[12rem]">
                    <div className="flex items-center gap-1">
                      <input disabled={!!d.content_id} defaultValue={d.published_url || ''} placeholder="https://…" onBlur={(e) => { if ((e.target.value || null) !== (d.published_url || null)) patch(d, { published_url: e.target.value || null }); }}
                        className={`${selectCls} w-full`} />
                      {d.published_url && <a href={d.published_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-admin-accent-600"><ExternalLink size={12} /></a>}
                      {!d.published_url && d.content && d.content.status === 'published' && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">/posts/{d.content.slug}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StudioPage>
    </AdminLayout>
  );
}
