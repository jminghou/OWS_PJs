'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@ows/admin-app';
import { ExternalLink, FolderOpen, Link2, Plus, Trash2, X } from 'lucide-react';
import { contentApi } from '@ows/platform-api';
import { cardApi, documentApi, projectApi } from '../api';
import { FLOW_STEPS, PLATFORMS, PLATFORM_META, STAGE_META, STUDIO_ROUTES } from '../constants';
import type { FlowStep } from '../constants';
import type { Card, Platform, Project, ProjectDetail, Stage } from '../types';
import { CardPicker } from '../components/CardPicker';
import { NewProjectDialog } from '../components/NewProjectDialog';
import { TagChips } from '../components/TagChips';
import {
  Empty, EmptyState, KindBadge, PlatformBadge, Section, SidebarItem, SidebarSearch, StageBadge, StageSelect, StudioSplit,
  btnDanger, btnGhost, btnPrimary, inputCls, relativeTime, selectCls, stripHtml,
} from '../components/ui';

function ProjectsPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('id') ? Number(params.get('id')) : null;
  const stageParam = (params.get('stage') as Stage | null) || 'all';
  const flowParam = (params.get('flow') as FlowStep | null) || null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<Stage | 'all'>(stageParam);
  const [flow, setFlow] = useState<FlowStep | null>(flowParam);
  useEffect(() => { setFlow(flowParam); }, [flowParam]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(() => {
    setLoading(true);
    projectApi.list({ stage: flow ? undefined : stage, flow: flow || undefined, search: search || undefined, per_page: 100, include_archived: stage === 'archived' ? 1 : undefined })
      .then((r) => setProjects(r.projects)).finally(() => setLoading(false));
  }, [stage, flow, search]);
  useEffect(() => { const t = setTimeout(loadList, 200); return () => clearTimeout(t); }, [loadList]);

  const loadDetail = useCallback(() => {
    if (!selectedId) { setDetail(null); return; }
    projectApi.get(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  return (
    <AdminLayout>
      <StudioSplit
        sidebarWidth={300}
        sidebar={
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border/60">
              <button type="button" onClick={() => setCreating(true)} className={`${btnGhost} w-full justify-center`}><Plus size={16} /> 新專案</button>
            </div>
            <SidebarSearch value={search} onChange={setSearch} placeholder="搜尋專案…" />
            <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
              <select value={flow ? `flow:${flow}` : stage} onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('flow:')) { setFlow(v.slice(5) as FlowStep); setStage('all'); }
                else { setFlow(null); setStage(v as Stage | 'all'); }
              }} className={`${selectCls} w-full`}>
                <option value="all">全部（不含封存）</option>
                <optgroup label="流程">
                  {FLOW_STEPS.map((s) => <option key={s.key} value={`flow:${s.key}`}>{s.label}</option>)}
                </optgroup>
                <optgroup label="階段">
                  {(Object.keys(STAGE_META) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto border-t border-border/60 mt-1">
              {loading ? <Empty text="載入中…" /> : projects.length === 0 ? <Empty text="沒有專案" /> : projects.map((p) => (
                <SidebarItem key={p.id} active={selectedId === p.id} onClick={() => router.push(STUDIO_ROUTES.project(p.id))}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate flex-1">{p.title}</span>
                    <StageBadge stage={p.stage} />
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                    {Object.entries(p.document_counts || {}).map(([pl, n]) => <span key={pl}>{PLATFORM_META[pl as Platform]?.short} {n}</span>)}
                    <span className="ml-auto">{relativeTime(p.updated_at)}</span>
                  </div>
                </SidebarItem>
              ))}
            </div>
          </div>
        }
      >
        {detail ? (
          <ProjectDetailView key={detail.id} project={detail} onChanged={() => { loadDetail(); loadList(); }} onDeleted={() => { router.push(STUDIO_ROUTES.projects); loadList(); }} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon={<FolderOpen size={48} />} title="選擇一個內容專案" description="或建立新專案，把同一主題的觀點、資料與各平台版本收在一起" />
          </div>
        )}
      </StudioSplit>

      {creating && <NewProjectDialog onClose={() => setCreating(false)} onCreated={(id) => { loadList(); router.push(STUDIO_ROUTES.project(id)); }} />}
    </AdminLayout>
  );
}

function ProjectDetailView({ project, onChanged, onDeleted }: { project: ProjectDetail; onChanged: () => void; onDeleted: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [thesis, setThesis] = useState(project.thesis || '');
  const [description, setDescription] = useState(project.description || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const [pickingCard, setPickingCard] = useState(false);
  const [newSource, setNewSource] = useState({ title: '', url: '', note: '' });

  const save = async () => {
    setSaving(true);
    try { await projectApi.update(project.id, { title, thesis, description }); setDirty(false); onChanged(); }
    catch (e: any) { alert(e.message || '儲存失敗'); }
    finally { setSaving(false); }
  };

  const setStage = async (s: Stage) => { await projectApi.setStage(project.id, s); onChanged(); };

  const remove = async () => {
    if (!confirm(`刪除專案「${project.title}」？底下的各平台文件與版本會一併刪除（綁定的部落格文章不會）。`)) return;
    await projectApi.delete(project.id);
    onDeleted();
  };

  const addSource = async () => {
    if (!newSource.title && !newSource.url && !newSource.note) return;
    await projectApi.createSource(project.id, newSource);
    setNewSource({ title: '', url: '', note: '' });
    onChanged();
  };

  const addCard = async (card: Card) => {
    await cardApi.addRef(card.id, 'project', project.id);
    setPickingCard(false);
    onChanged();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            className="w-full text-2xl font-semibold text-foreground outline-none bg-transparent placeholder:text-muted-foreground/50" placeholder="專案標題" />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StageSelect value={project.stage} onChange={setStage} />
            <TagChips targetType="project" targetId={project.id} tags={project.tags || []} onChange={onChanged} size="md" />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {dirty && <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving ? '儲存中…' : '儲存'}</button>}
          <button type="button" onClick={remove} className={btnDanger} title="刪除專案"><Trash2 size={14} /></button>
        </div>
      </div>

      <Section title="核心觀點">
        <textarea value={thesis} onChange={(e) => { setThesis(e.target.value); setDirty(true); }} rows={3}
          placeholder="這個主題想說的一句話是什麼？各平台版本都應該圍繞它。" className={`${inputCls} resize-y`} />
        <textarea value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} rows={2}
          placeholder="補充說明、目標讀者、切角（選填）" className={`${inputCls} resize-y mt-2`} />
      </Section>

      <Section title="各平台版本" extra={<button type="button" onClick={() => setAddingDoc(true)} className={`${btnGhost} text-xs py-1`}><Plus size={12} /> 新增版本</button>}>
        {project.documents.length === 0 ? <Empty text="還沒有任何版本。新增部落格、FB、IG、Threads、電子報或影片腳本。" /> : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {project.documents.map((d) => (
              <li key={d.id}>
                <Link href={STUDIO_ROUTES.workspace(d.id)} className="block rounded-lg border border-border p-3 hover:border-admin-accent-500 hover:bg-admin-accent-50/50 dark:bg-admin-accent-800/20 transition">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={d.platform} /><span className="text-xs">{d.language}</span>
                    <span className="text-sm font-medium text-foreground truncate flex-1">{d.title || '（無標題）'}</span>
                    <StageBadge stage={d.stage} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
                    <span>{relativeTime(d.updated_at)}</span>
                    {d.content_id && <span className="text-blue-500">已綁定文章</span>}
                    {d.published_url && <span className="truncate">{d.published_url}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="參考資料">
          {project.sources.length === 0 ? <Empty text="從收集箱「加入專案」，或在下方直接新增。" /> : (
            <ul className="space-y-2 mb-3">
              {project.sources.map((s) => (
                <li key={s.id} className="group text-sm border border-border/60 rounded-lg p-2">
                  <div className="flex items-start gap-2">
                    {s.file_url && <img src={s.file_url} alt="" className="w-10 h-10 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      {s.title && <p className="font-medium text-foreground truncate">{s.title}</p>}
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-admin-accent-600 dark:text-admin-accent-200 hover:underline break-all inline-flex items-center gap-1"><Link2 size={10} />{s.url}</a>}
                      {s.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{s.note}</p>}
                    </div>
                    <button type="button" onClick={async () => { await projectApi.deleteSource(s.id); onChanged(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"><X size={12} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5">
            <input value={newSource.title} onChange={(e) => setNewSource({ ...newSource, title: e.target.value })} placeholder="標題" className={`${inputCls} py-1.5`} />
            <input value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} placeholder="網址" className={`${inputCls} py-1.5`} />
            <textarea value={newSource.note} onChange={(e) => setNewSource({ ...newSource, note: e.target.value })} placeholder="筆記" rows={2} className={`${inputCls} py-1.5 resize-none`} />
            <button type="button" onClick={addSource} className={`${btnGhost} text-xs py-1`}><Plus size={12} /> 新增參考資料</button>
          </div>
        </Section>

        <Section title="知識卡片" extra={<button type="button" onClick={() => setPickingCard(true)} className={`${btnGhost} text-xs py-1`}><Plus size={12} /> 引用</button>}>
          {project.cards.length === 0 ? <Empty text="引用可重複使用的觀點、案例、研究資料、紫微概念。" /> : (
            <ul className="space-y-1.5">
              {project.cards.map((c) => (
                <li key={c.id} className="group border border-border/60 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <KindBadge kind={c.kind} />
                    <Link href={STUDIO_ROUTES.card(c.id)} className="text-sm font-medium text-foreground truncate flex-1 hover:text-admin-accent-600">{c.title}</Link>
                    <button type="button" onClick={async () => { await cardApi.removeRef(c.id, 'project', project.id); onChanged(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"><X size={12} /></button>
                  </div>
                  {c.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stripHtml(c.body, 140)}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {addingDoc && (
        <NewDocumentDialog projectId={project.id} projectTitle={project.title} existing={project.documents.map((d) => d.platform)}
          onClose={() => setAddingDoc(false)}
          onCreated={(id) => { setAddingDoc(false); router.push(STUDIO_ROUTES.workspace(id)); }} />
      )}
      {pickingCard && <CardPicker exclude={project.cards.map((c) => c.id)} onPick={addCard} onClose={() => setPickingCard(false)} />}
    </div>
  );
}

function NewDocumentDialog({ projectId, projectTitle, existing, onClose, onCreated }: {
  projectId: number; projectTitle: string; existing: Platform[]; onClose: () => void; onCreated: (id: number) => void;
}) {
  const [platform, setPlatform] = useState<Platform>('blog');
  const [language, setLanguage] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  useEffect(()=>{documentApi.options().then(o=>{setLanguages(o.languages);setLanguage(o.default_language);}).catch(()=>{});},[]);
  const [title, setTitle] = useState(projectTitle);
  const [mode, setMode] = useState<'new' | 'bind'>('new');
  const [articles, setArticles] = useState<Array<{ id: number; title: string; status: string; slug: string }>>([]);
  const [articleQ, setArticleQ] = useState('');
  const [contentId, setContentId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (platform !== 'blog' || mode !== 'bind') return;
    const t = setTimeout(() => {
      contentApi.getList({ search: articleQ || undefined, per_page: 20, status: '' })
        .then((r) => setArticles(r.contents.map((c: any) => ({ id: c.id, title: c.title, status: c.status, slug: c.slug }))))
        .catch(() => setArticles([]));
    }, 250);
    return () => clearTimeout(t);
  }, [platform, mode, articleQ]);

  const submit = async () => {
    setBusy(true);
    try {
      if (platform === 'blog' && mode === 'bind' && contentId) {
        const adopted = await documentApi.adopt(contentId); onCreated(adopted.id); return;
      }
      const res = await documentApi.create(projectId, {
        platform, title, language: language || undefined,
        content_id: platform === 'blog' && mode === 'bind' && contentId ? contentId : undefined,
      });
      onCreated(res.id);
    } catch (e: any) { alert(e.message || '建立失敗'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card text-card-foreground border border-border rounded-xl shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-foreground">新增作品</h3><label className="text-xs">原始語言 <select value={language} onChange={e=>setLanguage(e.target.value)} className="bg-card border rounded p-1">{languages.map(l=><option key={l}>{l}</option>)}</select></label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map((p) => (
            <button key={p} type="button" onClick={() => setPlatform(p)}
              className={`rounded-lg border px-3 py-2 text-sm text-left ${platform === p ? 'border-admin-accent-500 bg-admin-accent-50 dark:bg-admin-accent-800/30 text-admin-accent-800 dark:text-admin-accent-100' : 'border-border hover:border-border'}`}>
              <div className="font-medium">{PLATFORM_META[p].label}</div>
              {existing.includes(p) && <div className="text-[10px] text-muted-foreground">已有 {existing.filter((x) => x === p).length} 個</div>}
            </button>
          ))}
        </div>
        {platform === 'blog' && (
          <div className="flex gap-1 text-xs">
            <button type="button" onClick={() => setMode('new')} className={`px-2 py-1 rounded ${mode === 'new' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>建立新文章草稿</button>
            <button type="button" onClick={() => setMode('bind')} className={`px-2 py-1 rounded ${mode === 'bind' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>開啟／接管既有文章</button>
          </div>
        )}
        {platform === 'blog' && mode === 'bind' ? (
          <div>
            <input value={articleQ} onChange={(e) => setArticleQ(e.target.value)} placeholder="搜尋文章（保留原專案，未接管文章會建立專案）…" className={inputCls} />
            <ul className="mt-2 max-h-48 overflow-y-auto border border-border/60 rounded-lg divide-y divide-border/40">
              {articles.length === 0 && <li className="p-3 text-xs text-muted-foreground text-center">沒有文章</li>}
              {articles.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setContentId(a.id)} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${contentId === a.id ? 'bg-admin-accent-50 dark:bg-admin-accent-800/30' : 'hover:bg-muted'}`}>
                    <span className="truncate flex-1">{a.title}</span>
                    <span className="text-[11px] text-muted-foreground">{a.status}</span>
                    <ExternalLink size={11} className="text-muted-foreground/60" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="標題" className={inputCls} />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>取消</button>
          <button type="button" onClick={submit} disabled={busy || (platform === 'blog' && mode === 'bind' && !contentId)} className={btnPrimary}>建立並開始寫</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return <Suspense fallback={<div className="p-6">載入中...</div>}><ProjectsPageContent /></Suspense>;
}
