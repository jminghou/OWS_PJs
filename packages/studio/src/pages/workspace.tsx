'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@ows/admin-app';
import { Popover } from '@ows/ui/ui';
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Cloud, CloudOff, ExternalLink, Loader2, PanelRight, Plus, Trash2,
} from 'lucide-react';
import { documentApi, todayApi } from '../api';
import { PLATFORMS, PLATFORM_META, STUDIO_ROUTES } from '../constants';
import type { Card, ContentStatus, Document, Platform, Stage } from '../types';
import { useAutosave } from '../hooks/useAutosave';
import { DocumentEditor } from '../components/DocumentEditor';
import { StudioRightPanel } from '../components/StudioRightPanel';
import { TagChips } from '../components/TagChips';
import { EmptyState, PlatformBadge, StageBadge, StageSelect, btnGhost, btnPrimary, formatDate, relativeTime, stripHtml } from '../components/ui';

function WorkspaceContent() {
  const router = useRouter();
  const params = useSearchParams();
  const docId = params.get('doc') ? Number(params.get('doc')) : null;

  const [doc, setDoc] = useState<Document | null>(null);
  const [siblings, setSiblings] = useState<Document[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);
  const [contentStatus, setContentStatus] = useState<ContentStatus | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [insertHtml, setInsertHtml] = useState<string | null>(null);
  const [recent, setRecent] = useState<Document[]>([]);
  const loadIdRef = useRef(0);

  // 沒帶 ?doc= 時列出最近編輯的文件供挑選
  useEffect(() => {
    if (docId) return;
    todayApi.get().then((t) => setRecent(t.recent)).catch(() => setRecent([]));
  }, [docId]);

  const autosave = useAutosave({
    documentId: doc?.id ?? null, title, body,
    onSaved: () => setHistoryKey((k) => k + 1),
  });
  const { markClean } = autosave;

  const loadDoc = useCallback(async (id: number) => {
    const myId = ++loadIdRef.current;
    setLoading(true);
    try {
      const d = await documentApi.get(id);
      if (myId !== loadIdRef.current) return;
      setDoc(d);
      setTitle(d.title || '');
      setBody(d.body || '');
      markClean(d.title || '', d.body || '');
      documentApi.list(d.project_id).then((r) => setSiblings(r.documents.filter((x) => x.id !== d.id))).catch(() => {});
      if (d.content_id) documentApi.contentStatus(d.id).then(setContentStatus).catch(() => setContentStatus(null));
      else setContentStatus(null);
    } finally {
      if (myId === loadIdRef.current) setLoading(false);
    }
  }, [markClean]);

  useEffect(() => {
    if (docId) loadDoc(docId);
    else { setDoc(null); setSiblings([]); }
  }, [docId, loadDoc]);

  const applyDoc = (d: Document) => {
    setDoc(d);
    setTitle(d.title || '');
    setBody(d.body || '');
    markClean(d.title || '', d.body || '');
    setHistoryKey((k) => k + 1);
  };

  const setStage = async (stage: Stage) => {
    if (!doc) return;
    const res = await documentApi.update(doc.id, { stage });
    setDoc(res.document);
  };

  const sync = async (mode: 'save' | 'publish') => {
    if (!doc) return;
    setSyncing(true);
    try {
      await autosave.flush();
      const res = await documentApi.syncToContent(doc.id, { mode, title, body });
      setDoc(res.document);
      markClean(title, body);
      setHistoryKey((k) => k + 1);
      setPublishOpen(false);
      documentApi.contentStatus(doc.id).then(setContentStatus).catch(() => {});
      alert(mode === 'publish' ? '已發布到文章' : '已儲存到文章');
    } catch (e: any) { alert(e.message || '同步失敗'); }
    finally { setSyncing(false); }
  };

  const markPublished = async () => {
    if (!doc) return;
    const url = prompt('已發布的網址（選填）', doc.published_url || '') ?? undefined;
    const res = await documentApi.updatePublishing(doc.id, { stage: 'published', published_url: url });
    setDoc({ ...doc, ...res.document });
    setHistoryKey((k) => k + 1);
    setPublishOpen(false);
  };

  const loadFromContent = async () => {
    if (!doc || !confirm('用文章目前的內容覆蓋工作草稿？現況會先備份成一個版本。')) return;
    const res = await documentApi.loadFromContent(doc.id);
    applyDoc(res.document);
    documentApi.contentStatus(doc.id).then(setContentStatus).catch(() => {});
  };

  const remove = async () => {
    if (!doc || !confirm('刪除這個版本？所有歷史版本一併刪除（綁定的文章不會）。')) return;
    await documentApi.delete(doc.id);
    router.push(STUDIO_ROUTES.project(doc.project_id));
  };

  const insertCard = (card: Card) => {
    const meta = PLATFORM_META[doc!.platform];
    if (meta.editor === 'rich') {
      setInsertHtml(`<blockquote><p><strong>${card.title}</strong></p><p>${stripHtml(card.body, 600)}</p></blockquote>`);
    } else {
      setBody((b) => (b ? b.trimEnd() + '\n\n' : '') + `${card.title}\n${stripHtml(card.body, 600)}`);
    }
  };
  // TipTap 以 content prop 驅動；插入卡片 = 把 HTML 接到現有內容後重設
  useEffect(() => {
    if (insertHtml) { setBody((b) => b + insertHtml); setInsertHtml(null); }
  }, [insertHtml]);

  const addSibling = async (platform: Platform) => {
    if (!doc) return;
    const res = await documentApi.create(doc.project_id, { platform, title: doc.project?.title });
    router.push(STUDIO_ROUTES.workspace(res.id));
  };

  const isBlog = doc?.platform === 'blog';

  const SaveIndicator = () => {
    const s = autosave.status;
    const cls = 'inline-flex items-center gap-1 text-xs';
    if (s === 'saving') return <span className={`${cls} text-muted-foreground`}><Loader2 size={12} className="animate-spin" /> 儲存中</span>;
    if (s === 'error') return <span className={`${cls} text-destructive`} title={autosave.error || ''}><CloudOff size={12} /> 未儲存</span>;
    if (s === 'dirty') return <span className={`${cls} text-muted-foreground`}><Cloud size={12} /> 有變更</span>;
    if (s === 'saved' && autosave.savedAt) return <span className={`${cls} text-emerald-600`}><Check size={12} /> 已儲存 {formatDate(autosave.savedAt, true).slice(-5)}</span>;
    return <span className={`${cls} text-muted-foreground/60`}><Cloud size={12} /> 自動儲存</span>;
  };

  return (
    <AdminLayout>
      <div className="flex h-full">
        {/* 左：專案文件清單 */}
        <aside className="w-[240px] flex-shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border/60">
            {doc ? (
              <Link href={STUDIO_ROUTES.project(doc.project_id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft size={12} /> <span className="truncate">{doc.project?.title}</span>
              </Link>
            ) : <span className="text-xs text-muted-foreground">寫作工作區</span>}
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {doc && [doc, ...siblings.filter((s) => s.id !== doc.id)].sort((a, b) => a.platform.localeCompare(b.platform)).map((d) => (
              <Link key={d.id} href={STUDIO_ROUTES.workspace(d.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${d.id === doc.id ? 'bg-admin-accent-50 dark:bg-admin-accent-800/30 text-admin-accent-800 dark:text-admin-accent-100' : 'text-foreground/80 hover:bg-muted'}`}>
                <PlatformBadge platform={d.platform} />
                <span className="truncate flex-1">{d.title || '（無標題）'}</span>
              </Link>
            ))}
          </div>
          {doc && (
            <div className="p-2 border-t border-border/60">
              <Popover placement="top-start"
                trigger={<button type="button" className={`${btnGhost} w-full justify-center text-xs py-1.5`}><Plus size={12} /> 新增平台版本</button>}
                content={
                  <div className="w-44 py-1">
                    {PLATFORMS.map((p) => (
                      <button key={p} type="button" onClick={() => addSibling(p)} className="w-full text-left px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted">{PLATFORM_META[p].label}</button>
                    ))}
                  </div>
                } />
            </div>
          )}
        </aside>

        {/* 中：編輯器 */}
        <div className="flex-1 min-w-0 flex flex-col bg-card">
          {!docId ? (
            <div className="max-w-2xl mx-auto w-full p-8">
              {recent.length === 0 ? (
                <EmptyState title="從內容專案選擇一個版本開始寫" description="每個專案底下可以有部落格、FB、IG、Threads、電子報與影片腳本版本。" action={<Link href={STUDIO_ROUTES.projects} className={btnPrimary}>前往內容專案</Link>} />
              ) : (
                <>
                  <h2 className="text-lg font-semibold mb-1">繼續寫作</h2>
                  <p className="text-sm text-muted-foreground mb-4">最近編輯的版本。也可以到<Link href={STUDIO_ROUTES.projects} className="underline mx-0.5">內容專案</Link>建立新版本。</p>
                  <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
                    {recent.map((d) => (
                      <li key={d.id}>
                        <Link href={STUDIO_ROUTES.workspace(d.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition">
                          <PlatformBadge platform={d.platform} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{d.title || '（無標題）'}</div>
                            <div className="text-xs text-muted-foreground truncate">{d.project?.title} · {relativeTime(d.updated_at)}</div>
                          </div>
                          <StageBadge stage={d.stage} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : loading || !doc ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">載入中…</div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 h-12 border-b border-border/60 flex-shrink-0">
                <PlatformBadge platform={doc.platform} />
                <StageSelect value={doc.stage} onChange={setStage} />
                <TagChips targetType="document" targetId={doc.id} tags={doc.tags || []} onChange={(tags) => setDoc({ ...doc, tags })} />
                <div className="ml-auto flex items-center gap-2">
                  <SaveIndicator />
                  {isBlog && doc.content && (
                    <Link href={STUDIO_ROUTES.article(doc.content.id)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" title="SEO、分類、封面等在文章管理設定">
                      <ExternalLink size={12} /> 文章管理
                    </Link>
                  )}
                  <Popover open={publishOpen} onOpenChange={setPublishOpen} placement="bottom-end"
                    trigger={<button type="button" className={`${btnPrimary} text-xs py-1.5`}>{isBlog ? '發布' : '狀態'} <ChevronDown size={12} /></button>}
                    content={
                      <div className="w-56 py-1 text-sm">
                        {isBlog ? (
                          <>
                            <button type="button" disabled={syncing} onClick={() => sync('save')} className="w-full text-left px-4 py-2 hover:bg-muted disabled:opacity-50">儲存到文章（不改狀態）</button>
                            <button type="button" disabled={syncing} onClick={() => sync('publish')} className="w-full text-left px-4 py-2 hover:bg-muted disabled:opacity-50 font-medium">立即發布文章</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setStage('scheduled'); setPublishOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-muted">標記為待發布</button>
                            <button type="button" onClick={markPublished} className="w-full text-left px-4 py-2 hover:bg-muted font-medium">標記為已發布（記正式版）</button>
                          </>
                        )}
                        <div className="border-t border-border/60 my-1" />
                        <button type="button" onClick={remove} className="w-full text-left px-4 py-2 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"><Trash2 size={12} /> 刪除此版本</button>
                      </div>
                    } />
                  <button type="button" onClick={() => setRightOpen((o) => !o)} className={`p-1.5 rounded ${rightOpen ? 'text-admin-accent-600 dark:text-admin-accent-200 bg-admin-accent-50 dark:bg-admin-accent-800/30' : 'text-muted-foreground hover:text-foreground'}`} title="右側資訊欄"><PanelRight size={16} /></button>
                </div>
              </div>

              {contentStatus?.bound && (contentStatus.content_newer || contentStatus.diverged) && (
                <div className="flex items-center gap-2 px-4 py-1.5 text-xs bg-amber-50 text-amber-800 border-b border-amber-100">
                  <AlertTriangle size={12} />
                  {contentStatus.content_newer ? '文章在文章管理頁有較新的修改。' : '工作草稿與文章內容不同。'}
                  <button type="button" onClick={loadFromContent} className="underline">從文章載入</button>
                  <span className="text-amber-500">或</span>
                  <button type="button" onClick={() => sync('save')} className="underline">把草稿儲存到文章</button>
                  <span className="ml-auto text-amber-500">文章狀態：{contentStatus.content?.status}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                <DocumentEditor key={doc.id} platform={doc.platform} title={title} body={body} onTitleChange={setTitle} onBodyChange={setBody} />
              </div>
            </>
          )}
        </div>

        {/* 右：資訊欄 */}
        {doc && rightOpen && (
          <StudioRightPanel document={doc} siblings={siblings} current={{ title, body }} onRestored={applyDoc}
            onInsertCard={insertCard} historyKey={historyKey} onClose={() => setRightOpen(false)} />
        )}
      </div>
    </AdminLayout>
  );
}

export default function WorkspacePage() {
  return <Suspense fallback={<div className="p-6">載入中...</div>}><WorkspaceContent /></Suspense>;
}
