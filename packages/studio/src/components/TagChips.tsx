'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { tagApi } from '../api';
import type { StudioTag, TagTargetType } from '../types';

interface Props {
  targetType: TagTargetType;
  targetId: number;
  tags: StudioTag[];
  onChange?: (tags: StudioTag[]) => void;
  size?: 'sm' | 'md';
}

/** 扁平標籤晶片：點 + 輸入名稱（Enter 建立或選既有），點 × 移除。整組覆寫走 /tags/assign。 */
export function TagChips({ targetType, targetId, tags, onChange, size = 'sm' }: Props) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [all, setAll] = useState<StudioTag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    tagApi.list().then((r) => setAll(r.tags)).catch(() => {});
    inputRef.current?.focus();
  }, [editing]);

  const commit = async (names: string[], keepIds: number[]) => {
    const res = await tagApi.assign(targetType, targetId, { tag_ids: keepIds, names });
    onChange?.(res.tags);
  };

  const add = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (tags.some((t) => t.name === clean)) { setInput(''); return; }
    await commit([clean], tags.map((t) => t.id));
    setInput('');
  };

  const remove = async (id: number) => {
    await commit([], tags.filter((t) => t.id !== id).map((t) => t.id));
  };

  const suggestions = input
    ? all.filter((t) => t.name.toLowerCase().includes(input.toLowerCase()) && !tags.some((x) => x.id === t.id)).slice(0, 6)
    : [];

  const chip = size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t.id} className={`inline-flex items-center gap-1 rounded-md bg-muted text-foreground/80 ${chip}`}>
          #{t.name}
          {onChange && (
            <button type="button" onClick={() => remove(t.id)} className="text-muted-foreground hover:text-foreground" title="移除">
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {onChange && (
        editing ? (
          <div className="relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); add(input); }
                if (e.key === 'Escape') { setEditing(false); setInput(''); }
              }}
              onBlur={() => setTimeout(() => setEditing(false), 150)}
              placeholder="標籤名稱"
              className={`border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-admin-accent-500 ${chip} w-28`}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 bg-card border border-border rounded-md shadow-md py-1 min-w-[8rem]">
                {suggestions.map((s) => (
                  <button
                    key={s.id} type="button"
                    onMouseDown={(e) => { e.preventDefault(); add(s.name); }}
                    className="block w-full text-left px-2 py-1 text-xs text-foreground/80 hover:bg-muted"
                  >
                    #{s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button" onClick={() => setEditing(true)}
            className={`inline-flex items-center gap-0.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 ${chip}`}
          >
            <Plus size={10} /> 標籤
          </button>
        )
      )}
    </div>
  );
}
