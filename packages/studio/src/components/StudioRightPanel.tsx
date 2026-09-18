'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ExternalLink, History, Link2, Plus, Sparkles, X } from 'lucide-react';
import { cardApi } from '../api';
import { STUDIO_ROUTES } from '../constants';
import type { Card, Document } from '../types';
import { CardPicker } from './CardPicker';
import { VersionHistory } from './VersionHistory';
import { KindBadge, PlatformBadge, StageBadge, btnGhost, stripHtml } from './ui';

type Tab = 'cards' | 'brand' | 'related' | 'history';

interface Props {
  document: Document;
  siblings: Document[];
  current: { title: string; body: string };
  onRestored: (doc: Document) => void;
  onInsertCard?: (card: Card) => void;
  historyKey?: number;
  onClose: () => void;
  beforeAction?: () => Promise<void>;
  onSettings?: () => void;
}

const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: 'cards', label: '知識卡片', icon: <BookOpen size={13} /> },
  { key: 'brand', label: '品牌原則', icon: <Sparkles size={13} /> },
  { key: 'related', label: '相關內容', icon: <Link2 size={13} /> },
  { key: 'history', label: '歷史版本', icon: <History size={13} /> },
];

export function StudioRightPanel({ document, siblings, current, onRestored, onInsertCard, historyKey, onClose, beforeAction, onSettings }: Props) {
  const [tab, setTab] = useState<Tab>('cards');
  const [cards, setCards] = useState<Card[]>([]);
  const [projectCards, setProjectCards] = useState<Card[]>([]);
  const [brand, setBrand] = useState<Card[]>([]);
  const [picking, setPicking] = useState(false);

  const loadCards = useCallback(() => {
    cardApi.refsFor('document', document.id).then((r) => setCards(r.cards)).catch(() => {});
    cardApi.refsFor('project', document.project_id).then((r) => setProjectCards(r.cards)).catch(() => {});
  }, [document.id, document.project_id]);

  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => {
    if (tab === 'brand' && brand.length === 0) {
      cardApi.list({ kind: 'brand_principle', per_page: 50 }).then((r) => setBrand(r.cards)).catch(() => {});
    }
  }, [tab, brand.length]);

  const addRef = async (card: Card) => {
    await cardApi.addRef(card.id, 'document', document.id);
    setPicking(false);
    loadCards();
  };
  const removeRef = async (card: Card) => {
    await cardApi.removeRef(card.id, 'document', document.id);
    loadCards();
  };

  const inherited = projectCards.filter((c) => !cards.some((x) => x.id === c.id));

  const CardItem = ({ card, removable }: { card: Card; removable?: boolean }) => (
    <li className="group rounded-lg border border-border/60 bg-card px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <KindBadge kind={card.kind} />
        <Link href={STUDIO_ROUTES.card(card.id)} className="text-xs font-medium text-foreground truncate flex-1 hover:text-admin-accent-600">{card.title}</Link>
        {onInsertCard && (
          <button type="button" onClick={() => onInsertCard(card)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5" title="插入摘要到編輯器">
            <Plus size={12} />
          </button>
        )}
        {removable && (
          <button type="button" onClick={() => removeRef(card)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5" title="取消引用">
            <X size={12} />
          </button>
        )}
      </div>
      {card.body && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">{stripHtml(card.body, 160)}</p>}
    </li>
  );

  return (
    <aside className="w-[320px] flex-shrink-0 border-l border-border bg-muted/60 flex flex-col h-full">
      <div className="flex items-center border-b border-border bg-card px-1">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} title={t.label}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium border-b-2 transition ${tab === t.key ? 'border-admin-accent-600 text-admin-accent-700 dark:text-admin-accent-200' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.icon}<span className="hidden xl:inline">{t.label}</span>
          </button>
        ))}
        <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground" title="收合右欄"><X size={14} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'cards' && (
          <div className="space-y-3">
            <button type="button" onClick={() => setPicking(true)} className={`${btnGhost} w-full justify-center text-xs py-1.5`}>
              <Plus size={12} /> 引用卡片
            </button>
            {cards.length === 0 && inherited.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">尚未引用任何卡片。</p>
            )}
            {cards.length > 0 && (
              <ul className="space-y-1.5">{cards.map((c) => <CardItem key={c.id} card={c} removable />)}</ul>
            )}
            {inherited.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">專案層級引用</p>
                <ul className="space-y-1.5">{inherited.map((c) => <CardItem key={c.id} card={c} />)}</ul>
              </div>
            )}
          </div>
        )}

        {tab === 'brand' && (
          brand.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-4">還沒有品牌原則卡片。到「知識卡片」建立 kind 為品牌原則的卡片。</p>
            : <ul className="space-y-1.5">{brand.map((c) => <CardItem key={c.id} card={c} />)}</ul>
        )}

        {tab === 'related' && (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">同專案的其他版本</p>
              {siblings.length === 0 ? <p className="text-xs text-muted-foreground">沒有其他版本</p> : (
                <ul className="space-y-1">
                  {siblings.map((d) => (
                    <li key={d.id}>
                      <Link href={STUDIO_ROUTES.workspace(d.id)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs hover:bg-card border border-transparent hover:border-border">
                        <PlatformBadge platform={d.platform} />
                        <span className="truncate flex-1 text-foreground">{d.title || '（無標題）'}</span>
                        <StageBadge stage={d.stage} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {document.content && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">綁定的文章</p>
                <button onClick={onSettings} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs bg-card border border-border hover:border-admin-accent-500">
                  <ExternalLink size={12} className="text-muted-foreground" />
                  <span className="truncate flex-1">{document.content.title}</span>
                  <span className="text-muted-foreground">{document.content.status}</span>
                </button>
              </div>
            )}
            <div>
              <Link href={STUDIO_ROUTES.project(document.project_id)} className="text-xs text-admin-accent-600 dark:text-admin-accent-200 hover:underline">← 回到專案「{document.project?.title}」</Link>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <VersionHistory documentId={document.id} current={current} onRestored={onRestored} refreshKey={historyKey} beforeAction={beforeAction} />
        )}
      </div>

      {picking && <CardPicker exclude={cards.map((c) => c.id)} onPick={addRef} onClose={() => setPicking(false)} />}
    </aside>
  );
}
