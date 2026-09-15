'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@ows/admin-app';
import { Archive, BookOpen, Link2, Plus, Settings, Trash2, X } from 'lucide-react';
import { cardApi } from '../api';
import { STUDIO_ROUTES } from '../constants';
import { useActiveCardKinds, useCardKinds } from '../cardKinds';
import type { Card, CardKind } from '../types';
import { CardPicker } from '../components/CardPicker';
import { TagChips } from '../components/TagChips';
import { Empty, EmptyState, KindBadge, Pill, PlatformBadge, Section, SidebarItem, SidebarSearch, StudioSplit, btnDanger, btnGhost, btnPrimary, inputCls, relativeTime, selectCls } from '../components/ui';

function CardsPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('id') ? Number(params.get('id')) : null;
  const isNew = params.get('new') === '1';

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<CardKind | 'all'>('all');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [detail, setDetail] = useState<Card | null>(null);
  const activeKinds = useActiveCardKinds();

  const loadList = useCallback(() => {
    setLoading(true);
    cardApi.list({ kind, status, search: search || undefined, per_page: 100 }).then((r) => setCards(r.cards)).finally(() => setLoading(false));
  }, [kind, status, search]);
  useEffect(() => { const t = setTimeout(loadList, 200); return () => clearTimeout(t); }, [loadList]);

  const loadDetail = useCallback(() => {
    if (!selectedId) { setDetail(null); return; }
    cardApi.get(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  return (
    <AdminLayout>
      <StudioSplit
        sidebarWidth={300}
        sidebar={
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border/60">
              <button type="button" onClick={() => router.push(`${STUDIO_ROUTES.cards}?new=1`)} className={`${btnGhost} w-full justify-center ${isNew ? 'bg-admin-accent-600 text-white' : ''}`}><Plus size={16} /> 新卡片</button>
            </div>
            <SidebarSearch value={search} onChange={setSearch} placeholder="搜尋卡片…" />
            <div className="flex flex-wrap gap-1 px-3 pt-2 pb-1 text-xs">
              <Pill active={kind === 'all'} onClick={() => setKind('all')}>全部</Pill>
              {activeKinds.map((k) => (
                <Pill key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Pill>
              ))}
            </div>
            <div className="flex items-center gap-3 px-3 pb-2 text-xs">
              <button type="button" onClick={() => setStatus(status === 'active' ? 'archived' : 'active')}
                className={`inline-flex items-center gap-1 ${status === 'archived' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                <Archive size={13} /> {status === 'active' ? '看封存' : '回使用中'}
              </button>
              <Link href={STUDIO_ROUTES.cardKinds} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" title="管理卡片類型與批次整理卡片">
                <Settings size={13} /> 管理類型
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto border-t border-border/60 mt-1">
              {loading ? <Empty text="載入中…" /> : cards.length === 0 ? <Empty text="沒有卡片" /> : cards.map((c) => (
                <SidebarItem key={c.id} active={selectedId === c.id} onClick={() => router.push(STUDIO_ROUTES.card(c.id))}>
                  <div className="flex items-center gap-2">
                    <KindBadge kind={c.kind} />
                    <span className="text-sm font-medium text-foreground truncate flex-1">{c.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
                    <span>引用 {c.ref_count ?? 0}</span>
                    <span className="ml-auto">{relativeTime(c.updated_at)}</span>
                  </div>
                </SidebarItem>
              ))}
            </div>
          </div>
        }
      >
        {isNew ? (
          <CardForm key="new" onSaved={(c) => { loadList(); router.push(STUDIO_ROUTES.card(c.id)); }} />
        ) : detail ? (
          <CardForm key={detail.id} card={detail} onSaved={() => { loadList(); loadDetail(); }} onDeleted={() => { router.push(STUDIO_ROUTES.cards); loadList(); }} onChanged={loadDetail} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon={<BookOpen size={48} />} title="選擇或建立知識卡片" description="觀點、案例、研究資料、紫微概念、品牌原則 —— 可被多篇內容重複引用" />
          </div>
        )}
      </StudioSplit>
    </AdminLayout>
  );
}

function CardForm({ card, onSaved, onDeleted, onChanged }: { card?: Card; onSaved: (c: Card) => void; onDeleted?: () => void; onChanged?: () => void }) {
  const allKinds = useCardKinds();
  const activeKinds = allKinds.filter((k) => k.active);
  const [form, setForm] = useState({
    title: card?.title || '', kind: (card?.kind || activeKinds[0]?.key || 'viewpoint') as CardKind, body: card?.body || '',
    source_url: card?.source_url || '', source_note: card?.source_note || '',
  });
  const [dirty, setDirty] = useState(!card);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const set = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    if (!form.title.trim()) { alert('請輸入標題'); return; }
    setSaving(true);
    try {
      if (card) { const r = await cardApi.update(card.id, form); setDirty(false); onSaved(r.card); }
      else { const r = await cardApi.create(form); onSaved(r.card); }
    } catch (e: any) { alert(e.message || '儲存失敗'); }
    finally { setSaving(false); }
  };

  const toggleArchive = async () => {
    if (!card) return;
    await cardApi.update(card.id, { status: card.status === 'active' ? 'archived' : 'active' });
    onChanged?.();
  };
  const remove = async () => {
    if (!card || !confirm(`刪除卡片「${card.title}」？引用關係會一併移除。`)) return;
    await cardApi.delete(card.id);
    onDeleted?.();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="卡片標題" autoFocus={!card}
            className="w-full text-2xl font-semibold text-foreground outline-none bg-transparent placeholder:text-muted-foreground/50" />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select value={form.kind} onChange={(e) => set({ kind: e.target.value as CardKind })} className={selectCls}>
              {activeKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              {card && !activeKinds.some((k) => k.key === card.kind) && (
                <option value={card.kind}>{allKinds.find((k) => k.key === card.kind)?.label || card.kind}（已停用）</option>
              )}
            </select>
            {card && <TagChips targetType="card" targetId={card.id} tags={card.tags || []} onChange={onChanged} size="md" />}
            {card?.status === 'archived' && <span className="text-xs text-muted-foreground">已封存</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(dirty || !card) && <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving ? '儲存中…' : card ? '儲存' : '建立'}</button>}
          {card && <button type="button" onClick={toggleArchive} className={btnGhost}>{card.status === 'active' ? '封存' : '取消封存'}</button>}
          {card && <button type="button" onClick={remove} className={btnDanger} title="刪除"><Trash2 size={14} /></button>}
        </div>
      </div>

      <textarea value={form.body} onChange={(e) => set({ body: e.target.value })} rows={10}
        placeholder="內容：把這個觀點／案例／資料寫成可以直接拿去用的一段話。" className={`${inputCls} resize-y leading-relaxed`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input value={form.source_url} onChange={(e) => set({ source_url: e.target.value })} placeholder="來源網址" className={inputCls} />
        <input value={form.source_note} onChange={(e) => set({ source_note: e.target.value })} placeholder="來源備註（書名、頁碼、訪談…）" className={inputCls} />
      </div>

      {card && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title={`引用情況 (${card.refs?.length ?? 0})`}>
            {!card.refs?.length ? <Empty text="尚未被任何專案或文件引用。" /> : (
              <ul className="space-y-1">
                {card.refs.map((r) => (
                  <li key={r.id}>
                    <Link href={r.target_type === 'project' ? STUDIO_ROUTES.project(r.target_id) : STUDIO_ROUTES.workspace(r.target_id)}
                      className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted">
                      {r.target_type === 'document' && r.platform ? <PlatformBadge platform={r.platform} /> : <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">專案</span>}
                      <span className="truncate text-foreground">{r.title || '（無標題）'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={`關聯卡片 (${card.related_cards?.length ?? 0})`} extra={<button type="button" onClick={() => setLinking(true)} className={`${btnGhost} text-xs py-1`}><Link2 size={12} /> 關聯</button>}>
            {!card.related_cards?.length ? <Empty text="把相關的卡片連起來，寫作時更容易一起調用。" /> : (
              <ul className="space-y-1">
                {card.related_cards.map((c) => (
                  <li key={c.id} className="group flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted">
                    <KindBadge kind={c.kind} />
                    <Link href={STUDIO_ROUTES.card(c.id)} className="truncate flex-1 text-foreground hover:text-admin-accent-600">{c.title}</Link>
                    <button type="button" onClick={async () => { await cardApi.unlink(card.id, c.id); onChanged?.(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><X size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {linking && card && (
        <CardPicker exclude={[card.id, ...(card.related_cards || []).map((c) => c.id)]} onClose={() => setLinking(false)}
          onPick={async (c) => { await cardApi.link(card.id, c.id); setLinking(false); onChanged?.(); }} />
      )}
    </div>
  );
}

export default function CardsPage() {
  return <Suspense fallback={<div className="p-6">載入中...</div>}><CardsPageContent /></Suspense>;
}
