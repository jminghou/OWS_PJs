'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cardApi } from '../api';
import { useActiveCardKinds } from '../cardKinds';
import type { Card, CardKind } from '../types';
import { KindBadge, inputCls, stripHtml } from './ui';

interface Props {
  exclude?: number[];
  onPick: (card: Card) => void;
  onClose: () => void;
}

/** 搜尋並挑選一張知識卡片（引用到專案／文件，或關聯到另一張卡片）。 */
export function CardPicker({ exclude = [], onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<CardKind | 'all'>('all');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const kinds = useActiveCardKinds();

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      cardApi.list({ search: q || undefined, kind: kind === 'all' ? undefined : kind, per_page: 30 })
        .then((r) => setCards(r.cards.filter((c) => !exclude.includes(c.id))))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, kind, exclude]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card text-card-foreground border border-border rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-border/60 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋知識卡片…" className={`${inputCls} pl-8`}
              onKeyDown={(e) => e.key === 'Escape' && onClose()} />
          </div>
          <div className="flex gap-1 text-xs flex-wrap">
            <button type="button" onClick={() => setKind('all')} className={`px-2 py-0.5 rounded ${kind === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>全部</button>
            {kinds.map((k) => (
              <button key={k.key} type="button" onClick={() => setKind(k.key)} className={`px-2 py-0.5 rounded ${kind === k.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {loading && cards.length === 0 && <li className="p-4 text-sm text-muted-foreground text-center">載入中…</li>}
          {!loading && cards.length === 0 && <li className="p-4 text-sm text-muted-foreground text-center">沒有符合的卡片</li>}
          {cards.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)} className="w-full text-left px-4 py-2.5 hover:bg-muted">
                <div className="flex items-center gap-2">
                  <KindBadge kind={c.kind} />
                  <span className="text-sm font-medium text-foreground truncate">{c.title}</span>
                </div>
                {c.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{stripHtml(c.body, 120)}</p>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
