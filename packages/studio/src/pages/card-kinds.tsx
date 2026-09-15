'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@ows/admin-app';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { cardApi } from '../api';
import type { Card } from '../types';
import { STUDIO_ROUTES } from '../constants';
import {
  DEFAULT_CARD_KINDS, KIND_COLOR_CLASSES, PALETTE, cardKindApi, setCardKindsCache,
} from '../cardKinds';
import type { CardKindColor, CardKindDef, CardKindsResponse } from '../cardKinds';
import { PageHeader, Pill, Section, StudioPage, btnDanger, btnGhost, btnPrimary, inputCls, relativeTime, stripHtml } from '../components/ui';

const COLORS: CardKindColor[] = PALETTE;

function slugify(label: string): string {
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return ascii || `kind_${Date.now().toString(36)}`;
}

export default function CardKindsPage() {
  const [kinds, setKinds] = useState<CardKindDef[]>([]);
  const [orphans, setOrphans] = useState<CardKindsResponse['orphans']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [colorOpen, setColorOpen] = useState<number | null>(null);   // 哪一列的調色盤展開

  // ---- 現有卡片（批次刪除／改類型）----
  const [cards, setCards] = useState<Card[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<string>('all');
  const [cardSearch, setCardSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [targetKind, setTargetKind] = useState('');
  const loadCards = useCallback(() => {
    setCardsLoading(true);
    cardApi.list({ status: 'all', per_page: 200, kind: filterKind === 'all' ? undefined : filterKind, search: cardSearch || undefined })
      .then((r) => setCards(r.cards)).catch(() => setCards([])).finally(() => setCardsLoading(false));
    setSelected([]);
  }, [filterKind, cardSearch]);
  useEffect(() => { const t = setTimeout(loadCards, 200); return () => clearTimeout(t); }, [loadCards]);

  const refreshUsage = () => cardKindApi.get().then((r) => {
    setKinds((ks) => ks.map((k) => ({ ...k, usage: r.kinds.find((x) => x.key === k.key)?.usage ?? 0 })));
    setOrphans(r.orphans);
  }).catch(() => {});

  const deleteSelected = async () => {
    if (!selected.length || !confirm(`刪除 ${selected.length} 張卡片？引用關係會一併移除，無法復原。`)) return;
    await cardApi.batch(selected, 'delete');
    loadCards(); refreshUsage();
  };
  const moveSelected = async () => {
    if (!selected.length || !targetKind) return;
    await cardApi.batch(selected, 'set_kind', targetKind);
    loadCards(); refreshUsage();
  };
  const toggleAll = () => setSelected(selected.length === cards.length ? [] : cards.map((c) => c.id));

  const apply = (r: CardKindsResponse) => {
    setKinds(r.kinds); setOrphans(r.orphans); setCardKindsCache(r.kinds); setDirty(false); setError(null);
  };

  useEffect(() => {
    cardKindApi.get().then(apply).catch((e) => setError(e.message || '載入失敗')).finally(() => setLoading(false));
  }, []);

  const update = (idx: number, patch: Partial<CardKindDef>) => {
    setKinds((ks) => ks.map((k, i) => (i === idx ? { ...k, ...patch } : k)));
    setDirty(true);
  };
  const move = (idx: number, dir: -1 | 1) => {
    setKinds((ks) => {
      const next = [...ks];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return ks;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setDirty(true);
  };
  const remove = (idx: number) => {
    const k = kinds[idx];
    if (k.usage) { alert(`「${k.label}」還有 ${k.usage} 張卡片在用，不能刪除。可以改成停用，或先把那些卡片改成別的類型。`); return; }
    if (!confirm(`刪除類型「${k.label}」？`)) return;
    setKinds((ks) => ks.filter((_, i) => i !== idx));
    setDirty(true);
  };
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    let key = slugify(label);
    let n = 1;
    while (kinds.some((k) => k.key === key)) key = `${slugify(label)}_${n++}`;
    setKinds((ks) => [...ks, { key, label, color: COLORS[ks.length % (COLORS.length - 1)], active: true, usage: 0 }]);
    setNewLabel('');
    setDirty(true);
  };
  const restoreOrphan = (o: { key: string; usage: number }) => {
    setKinds((ks) => [...ks, { key: o.key, label: o.key, color: 'gray', active: true, usage: o.usage }]);
    setOrphans((os) => os.filter((x) => x.key !== o.key));
    setDirty(true);
  };
  const resetDefaults = () => {
    if (!confirm('回復成預設五種類型？既有卡片不受影響，仍有卡片在用的自訂類型會被保留。')) return;
    const keep = kinds.filter((k) => k.usage && !DEFAULT_CARD_KINDS.some((d) => d.key === k.key));
    setKinds([...DEFAULT_CARD_KINDS.map((d) => ({ ...d, usage: kinds.find((k) => k.key === d.key)?.usage ?? 0 })), ...keep]);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await cardKindApi.save(kinds.map(({ key, label, color, active }) => ({ key, label, color, active })));
      apply(r);
    } catch (e: any) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <StudioPage width="narrow">
        <PageHeader
          title="卡片類型"
          description="知識卡片的分類方式。停用的類型不會出現在選單裡，但既有卡片保留原類型。"
          actions={
            <>
              <Link href={STUDIO_ROUTES.cards} className={btnGhost}>回知識卡片</Link>
              <button type="button" onClick={save} disabled={!dirty || saving} className={btnPrimary}>{saving ? '儲存中…' : '儲存'}</button>
            </>
          }
        />
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <Section title={`類型（${kinds.length}）`} extra={<button type="button" onClick={resetDefaults} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><RotateCcw size={12} /> 回復預設</button>}>
          {loading ? <p className="text-sm text-muted-foreground py-4 text-center">載入中…</p> : (
            <ul className="divide-y divide-border/60">
              {kinds.map((k, idx) => (
                <li key={k.key} className={`flex items-center gap-3 py-2 ${k.active ? '' : 'opacity-60'}`}>
                  <div className="flex flex-col -my-1">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={12} /></button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === kinds.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={12} /></button>
                  </div>

                  {/* 徽章 = 顏色按鈕：點開小調色盤 */}
                  <div className="relative">
                    <button type="button" onClick={() => setColorOpen(colorOpen === idx ? null : idx)} title="更改顏色"
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium min-w-[5rem] justify-center ring-1 ring-inset ring-black/5 hover:ring-foreground/30 ${KIND_COLOR_CLASSES[k.color]?.badge}`}>
                      {k.label || '　'}
                    </button>
                    {colorOpen === idx && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setColorOpen(null)} />
                        {/* absolute 元素的寬度會被父層（徽章）的寬度限制住而把色點壓在一起，所以明確給 max-content */}
                        <div className="absolute z-40 top-full mt-2 left-0 rounded-md border border-border bg-popover shadow-lg" style={{ padding: 18, width: 'max-content' }}>
                          <div className="grid grid-cols-4" style={{ gap: 16 }}>
                            {COLORS.map((c) => (
                              <button key={c} type="button" onClick={() => { update(idx, { color: c }); setColorOpen(null); }} title={c}
                                style={{ width: 22, height: 22 }}
                                className={`rounded-full flex-shrink-0 ${KIND_COLOR_CLASSES[c].swatch} ${k.color === c ? 'ring-2 ring-offset-2 ring-foreground/60' : 'opacity-90 hover:opacity-100'}`} />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <input value={k.label} onChange={(e) => update(idx, { label: e.target.value })} className={`${inputCls} py-1 flex-1 min-w-0`} placeholder="名稱" />

                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap" title="停用後不出現在選單，既有卡片保留">
                    <input type="checkbox" checked={k.active} onChange={(e) => update(idx, { active: e.target.checked })} className="rounded border-border" /> 啟用
                  </label>
                  <button type="button" onClick={() => setFilterKind(k.key)} className="text-xs text-muted-foreground hover:text-foreground hover:underline w-12 text-right tabular-nums whitespace-nowrap" title="在下方列出這個類型的卡片">{k.usage ?? 0} 張</button>
                  <button type="button" onClick={() => remove(idx)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="刪除"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/60">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="新類型名稱，例如：金句" className={inputCls}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button type="button" onClick={add} disabled={!newLabel.trim()} className={`${btnGhost} whitespace-nowrap`}><Plus size={14} /> 新增</button>
          </div>
        </Section>

        {orphans.length > 0 && (
          <Section title="已移除但仍有卡片在用的類型" className="mt-4">
            <ul className="space-y-1">
              {orphans.map((o) => (
                <li key={o.key} className="flex items-center gap-2 text-sm">
                  <code className="text-xs">{o.key}</code>
                  <span className="text-muted-foreground text-xs">{o.usage} 張</span>
                  <button type="button" onClick={() => restoreOrphan(o)} className="ml-auto text-xs text-admin-accent-600 hover:underline">補回清單</button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="mt-3 text-xs text-muted-foreground">點左側徽章可換顏色；名稱隨時可改；上下箭頭調整選單順序。</p>

        <Section title={`現有卡片（${cards.length}）`} className="mt-6"
          extra={<input value={cardSearch} onChange={(e) => setCardSearch(e.target.value)} placeholder="搜尋卡片…" className={`${inputCls} py-1 w-44`} />}>
          <div className="flex flex-wrap gap-1 text-xs mb-3">
            <Pill active={filterKind === 'all'} onClick={() => setFilterKind('all')}>全部</Pill>
            {kinds.map((k) => <Pill key={k.key} active={filterKind === k.key} onClick={() => setFilterKind(k.key)}>{k.label}{k.active ? '' : '（停用）'}</Pill>)}
            {orphans.map((o) => <Pill key={o.key} active={filterKind === o.key} onClick={() => setFilterKind(o.key)}>{o.key}（已移除）</Pill>)}
          </div>

          {cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-border/60 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={selected.length === cards.length} onChange={toggleAll} className="rounded border-border" /> 全選
              </label>
              <span className="text-muted-foreground">已選 {selected.length}</span>
              <button type="button" onClick={deleteSelected} disabled={!selected.length} className={`${btnDanger} px-2 py-1 text-xs`}><Trash2 size={12} /> 刪除選取</button>
              <span className="ml-auto inline-flex items-center gap-1">
                <select value={targetKind} onChange={(e) => setTargetKind(e.target.value)} className="text-xs border border-border rounded-md px-2 py-1 bg-card">
                  <option value="">改成類型…</option>
                  {kinds.filter((k) => k.active).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <button type="button" onClick={moveSelected} disabled={!selected.length || !targetKind} className={`${btnGhost} px-2 py-1 text-xs`}>套用</button>
              </span>
            </div>
          )}

          {cardsLoading ? <p className="text-sm text-muted-foreground py-4 text-center">載入中…</p>
            : cards.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">沒有卡片</p> : (
            <ul className="divide-y divide-border/60">
              {cards.map((c) => {
                const meta = kinds.find((k) => k.key === c.kind);
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} className="rounded border-border" />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${KIND_COLOR_CLASSES[meta?.color || 'gray'].badge}`}>{meta?.label || c.kind}</span>
                    <div className="flex-1 min-w-0">
                      <Link href={STUDIO_ROUTES.card(c.id)} className="text-sm font-medium hover:text-admin-accent-600 truncate block">{c.title}</Link>
                      {c.body && <p className="text-xs text-muted-foreground truncate">{stripHtml(c.body, 100)}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{c.status === 'archived' ? '封存 · ' : ''}引用 {c.ref_count ?? 0} · {relativeTime(c.updated_at)}</span>
                    <button type="button" onClick={async () => { if (confirm(`刪除「${c.title}」？`)) { await cardApi.delete(c.id); loadCards(); refreshUsage(); } }} className={`${btnDanger} px-1.5 py-1`} title="刪除"><Trash2 size={13} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </StudioPage>
    </AdminLayout>
  );
}
