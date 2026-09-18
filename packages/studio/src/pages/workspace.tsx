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
import type { ArticleSettings, EditorOptions, Card, ContentStatus, Document, Platform, Stage } from '../types';
import { useAutosave } from '../hooks/useAutosave';
import { ArticleSettingsPanel } from '../components/ArticleSettingsPanel';
import { DocumentEditor } from '../components/DocumentEditor';
import { StudioRightPanel } from '../components/StudioRightPanel';
import { PlatformIcon } from '../components/PlatformIcon';
import { TagChips } from '../components/TagChips';
import { EmptyState, LanguageBadge, PlatformBadge, StageBadge, StageSelect, btnGhost, btnPrimary, formatDate, relativeTime, stripHtml } from '../components/ui';

function WorkspaceContent({docId}: {docId: number | null}) {
  const router = useRouter();

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
  const [options, setOptions] = useState<EditorOptions | null>(null);
  const [settings, setSettings] = useState<ArticleSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [language, setLanguage] = useState('');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { documentApi.options().then(setOptions).catch(e => setError(e.message)); }, []);

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
      setSettings(d.article_settings || null);
      setTitle(d.title || '');
      setBody(d.body || '');
      markClean(d.title || '', d.body || '');
      documentApi.list(d.project_id).then((r) => setSiblings(r.documents.filter((x) => x.id !== d.id))).catch(() => {});
      if (d.content_id) documentApi.contentStatus(d.id).then(setContentStatus).catch(() => setContentStatus(null));
      else setContentStatus(null);
    } catch (e: any) { setError(e.message || "載入失敗"); } finally {
      if (myId === loadIdRef.current) setLoading(false);
    }
  }, [markClean]);

  useEffect(() => {
    if (docId) loadDoc(docId);
    else { setDoc(null); setSiblings([]); }
  }, [docId, loadDoc]);

  const applyDoc = (d: Document) => {
    setDoc(d);
    setSettings(d.article_settings || null);
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

  const sync = async (mode: 'save' | 'publish' | 'schedule' | 'unpublish') => {
    if (!doc) return;
    setSyncing(true);
    try {
      await saveDraft();
      if (mode === 'save') { setPublishOpen(false); return; }
      const res = await documentApi.syncToContent(doc.id, { mode, published_at: schedule ? new Date(schedule).toISOString() : undefined });
      setDoc(res.document);
      setHistoryKey((k) => k + 1);
      setPublishOpen(false);
      documentApi.contentStatus(doc.id).then(setContentStatus).catch(() => {});
      alert(mode === 'publish' ? '此語言已發布' : mode === 'schedule' ? '此語言已排程' : '此語言已下架');
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
    await saveDraft();
    const res = await documentApi.loadFromContent(doc.id);
    applyDoc(res.document);
    documentApi.contentStatus(doc.id).then(setContentStatus).catch(() => {});
  };

  const remove = async () => {
    if (!doc) return;
    try {
      await saveDraft();
      if (doc.content?.status === 'published') { alert('請先下架此語言，再封存。'); return; }
      const res = await documentApi.update(doc.id, {stage:'archived'});
      setDoc(res.document);
      router.push(STUDIO_ROUTES.project(doc.project_id));
    } catch (e: any) { alert(e.message); }
  };

  const saveDraft = async () => {
    if (!doc) return;
    await autosave.flush();
    if (settings && JSON.stringify(settings) !== JSON.stringify(doc.article_settings)) {
      const result = await documentApi.settings(doc.id, settings);
      setDoc(result.document);
    }
  };
  // Capture in-app links, including the shell, so routing waits for a successful save.
  const saveRef = useRef(saveDraft); saveRef.current = saveDraft;
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.('a');
      if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      saveRef.current().then(() => router.push(url.pathname + url.search + url.hash)).catch(e => alert(e.message || '儲存失敗，已保留目前文件'));
    };
    window.document.addEventListener('click', handle, true);
    return () => window.document.removeEventListener('click', handle, true);
  }, [router]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (settings && JSON.stringify(settings) !== JSON.stringify(doc?.article_settings)) { e.preventDefault(); e.returnValue=''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [settings, doc?.article_settings]);
  const translate = async (mode: 'blank' | 'copy') => {
    if (!doc || !language) return;
    setSyncing(true);
    try { await saveDraft(); const result = await documentApi.translate(doc.id, language, mode); router.push(STUDIO_ROUTES.workspace(result.id)); }
    catch (e: any) { alert(e.message); } finally { setSyncing(false); }
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
    await saveDraft();
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
      {error && <p role="alert" className="p-3 text-destructive">{error}</p>}
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
                <PlatformBadge platform={d.platform} /><LanguageBadge language={d.language} />
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
                      <button key={p} type="button" onClick={() => addSibling(p)} className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted"><PlatformIcon platform={p} />{PLATFORM_META[p].label}</button>
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
                  <h2 className="text-lg font-semibold mb-1">繼續寫作</h2><Link href="/admin/articles" className="text-sm underline">所有網站文章與既有文章接管</Link>
                  <p className="text-sm text-muted-foreground mb-4">最近編輯的版本。也可以到<Link href={STUDIO_ROUTES.projects} className="underline mx-0.5">內容專案</Link>建立新版本。</p>
                  <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
                    {recent.map((d) => (
                      <li key={d.id}>
                        <Link href={STUDIO_ROUTES.workspace(d.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition">
                          <PlatformBadge platform={d.platform} /><LanguageBadge language={d.language} />
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
                <StageBadge stage={doc.stage} />{!isBlog && <StageSelect value={doc.stage} onChange={setStage} />}
                <TagChips targetType="document" targetId={doc.id} tags={doc.tags || []} onChange={(tags) => setDoc({ ...doc, tags })} />
                <div className="ml-auto flex items-center gap-2">
                  <SaveIndicator />
                  {isBlog && <button className={`${btnGhost} relative ${settingsOpen ? 'ring-1 ring-admin-accent-500 text-admin-accent-700 dark:text-admin-accent-200' : ''}`} aria-pressed={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>文章設定{settings && !settings.featured_image && <span title="尚未設定文章主圖" className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />}</button>}
                  <button className={btnGhost} onClick={() => setPreview(!preview)}>{preview?'繼續編輯':'預覽'}</button>
                  <button className={btnGhost} disabled={syncing} onClick={() => sync('save')}>儲存草稿</button>
                  <Popover open={publishOpen} onOpenChange={setPublishOpen} placement="bottom-end"
                    trigger={<button type="button" className={`${btnPrimary} text-xs py-1.5`}>{isBlog ? '發布' : '狀態'} <ChevronDown size={12} /></button>}
                    content={
                      <div className="w-56 py-1 text-sm">
                        {isBlog ? (
                          <>
                            {settings && !settings.featured_image && (
                              <div className="mx-2 mb-1 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                                尚未設定文章主圖，文章卡片與社群分享會沒有圖片。
                                <button type="button" className="ml-1 underline" onClick={() => { setSettingsOpen(true); setPublishOpen(false); }}>去設定</button>
                              </div>
                            )}
                            <button type="button" disabled={syncing} onClick={() => sync('save')} className="w-full text-left px-4 py-2 hover:bg-muted disabled:opacity-50">儲存工作草稿</button>
                            <button type="button" disabled={syncing} onClick={() => sync('publish')} className="w-full text-left px-4 py-2 hover:bg-muted disabled:opacity-50 font-medium">立即發布文章</button>
                            <label className="block px-4 py-2 text-xs">預定時間<input aria-label="預定發布時間" type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)} className="w-full text-foreground bg-card" /></label>
                            <button disabled={syncing || !schedule} onClick={() => sync('schedule')} className="w-full px-4 py-2 text-left disabled:opacity-50">排程此語言</button>
                            {doc.content?.status === 'published' && <button disabled={syncing} onClick={() => sync('unpublish')} className="w-full px-4 py-2 text-left">下架此語言／取消排程</button>}

                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setStage('scheduled'); setPublishOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-muted">標記為待發布</button>
                            <button type="button" onClick={markPublished} className="w-full text-left px-4 py-2 hover:bg-muted font-medium">標記為已發布（記正式版）</button>
                          </>
                        )}
                        <div className="border-t border-border/60 my-1" />
                        <button type="button" onClick={remove} className="w-full text-left px-4 py-2 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"><Trash2 size={12} /> 封存此版本</button>
                      </div>
                    } />
                  <button type="button" onClick={() => setRightOpen((o) => !o)} className={`p-1.5 rounded ${rightOpen ? 'text-admin-accent-600 dark:text-admin-accent-200 bg-admin-accent-50 dark:bg-admin-accent-800/30' : 'text-muted-foreground hover:text-foreground'}`} title="右側資訊欄"><PanelRight size={16} /></button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b text-xs">
                <label>語言 <select value={doc.id} disabled={syncing} onChange={async e => {const id=Number(e.target.value);try {await saveDraft(); router.push(STUDIO_ROUTES.workspace(id));} catch(e:any){alert(e.message);}}} className="bg-card border rounded p-1">
                  {(doc.language_versions || [doc]).map(v=><option key={v.id} value={v.id}>{options?.language_names[v.language] || v.language} · {v.stage}</option>)}
                </select></label>
                <select aria-label="新增語言" value={language} onChange={e=>setLanguage(e.target.value)} className="bg-card border rounded p-1"><option value="">新增語言…</option>{options?.languages.filter(l=>!doc.language_versions?.some(v=>v.language===l)).map(l=><option key={l} value={l}>{options.language_names[l] || l}</option>)}</select>
                <button className={btnGhost} disabled={!language || syncing} onClick={()=>translate('blank')}>空白翻譯</button>
                <button className={btnGhost} disabled={!language || syncing} onClick={()=>translate('copy')}>複製為翻譯草稿</button>
                {options && !options.enabled && <Link href="/admin/settings" className="underline">啟用更多語言</Link>}
              </div>
              {(doc.source_changed || !!doc.attributes.translation_review_pending) && <div className="p-3 text-sm bg-amber-50 text-amber-900">
                {doc.source_changed ? '來源內容已更新，請檢查此翻譯；已發布版本會維持原狀。' : '翻譯草稿尚待校對，完成確認後才可發布。'}
                <button className="underline ml-2" onClick={async()=>{try {await saveDraft();const r=await documentApi.reviewed(doc.id);setDoc(r.document);}catch(e:any){alert(e.message);}}}>已完成翻譯校對</button>
              </div>}
              {contentStatus?.content_newer && <div className="p-2 text-xs bg-amber-50 text-amber-900">網站文章有外部修改。<button onClick={loadFromContent} className="underline">備份並載入網站內容</button></div>}

              <div className="flex-1 overflow-y-auto">
                {preview ? <iframe title="此語言的內容預覽" sandbox="" className="w-full h-full min-h-[500px]" srcDoc={`<!doctype html><html lang="${doc.language}"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'"><style>body{font:18px/1.8 sans-serif;max-width:780px;margin:40px auto;padding:20px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}</style><h1>${title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</h1>${PLATFORM_META[doc.platform].editor==='rich'?body:'<pre>'+body.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre>'}</html>`} /> : <DocumentEditor key={doc.id} platform={doc.platform} title={title} body={body} onTitleChange={setTitle} onBodyChange={setBody} />}
              </div>
            </>
          )}
        </div>

        {/* 右：資訊欄 */}
        {doc && settingsOpen && settings && options ? (
          <ArticleSettingsPanel value={settings} options={options} onChange={setSettings} onClose={() => setSettingsOpen(false)}
            dirty={JSON.stringify(settings) !== JSON.stringify(doc.article_settings)} />
        ) : doc && rightOpen && (
          <StudioRightPanel document={doc} siblings={siblings} current={{ title, body }} onRestored={applyDoc}
            beforeAction={saveDraft} onSettings={()=>setSettingsOpen(true)} onInsertCard={insertCard} historyKey={historyKey} onClose={() => setRightOpen(false)} />
        )}
      </div>
    </AdminLayout>
  );
}

export default function WorkspacePage() {
  return <Suspense fallback={<div className="p-6">載入中...</div>}><WorkspaceRoute /></Suspense>;
}

function WorkspaceRoute() {
  const params = useSearchParams();
  const id = params.get('doc') ? Number(params.get('doc')) : null;
  return <WorkspaceContent key={id || 'recent'} docId={id} />;
}
