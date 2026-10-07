'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { AdminSheet } from './AdminSheet';

export interface AdminActionItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** 有值時先跳 confirm(訊息) 再執行。 */
  confirm?: string;
  hidden?: boolean;
}

export interface AdminActionMenuProps {
  items: AdminActionItem[];
  /** 手機 ActionSheet 的標題（例如該列名稱）。 */
  title?: string;
  /** 觸發鈕的 aria-label。 */
  label?: string;
  /** 觸發鈕自訂內容（預設「⋯」）。 */
  trigger?: React.ReactNode;
  className?: string;
  /** 觸發鈕尺寸：sm 用在密集清單列（桌機 28px，手機仍保證 40px）。 */
  size?: 'sm' | 'md';
}

const MENU_W = 192;

/**
 * 「⋯」操作選單：取代 hover 才出現的列操作。桌機為下拉選單（fixed 定位，不會被
 * overflow-hidden 的側欄裁切），手機為底部 ActionSheet，觸控目標 ≥ 44px。
 */
export function AdminActionMenu({ items, title, label = '更多操作', trigger, className = '', size = 'md' }: AdminActionMenuProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);

  useLayoutEffect(() => {
    if (!open || isMobile || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? visible.length * 36 + 8;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    const left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8);
    setPos({ top, left });
  }, [open, isMobile, visible.length]);

  useEffect(() => {
    if (!open || isMobile) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  if (visible.length === 0) return null;

  const run = (item: AdminActionItem) => {
    if (item.disabled) return;
    setOpen(false);
    if (item.confirm && !window.confirm(item.confirm)) return;
    item.onClick();
  };

  const btnSize = size === 'sm' ? 'w-10 h-10 md:w-7 md:h-7' : 'w-11 h-11 md:w-8 md:h-8';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={`flex-shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${btnSize} ${className}`}
      >
        {trigger ?? <MoreHorizontal size={size === 'sm' ? 16 : 18} />}
      </button>

      {open && isMobile && (
        <AdminSheet open onClose={() => setOpen(false)} mobile="bottom" bare>
          <div onClick={(e) => e.stopPropagation()} className="pb-[env(safe-area-inset-bottom)]">
            {title && <div className="px-5 pt-2 pb-3 text-sm text-muted-foreground truncate border-b border-border">{title}</div>}
            <ul className="py-1">
              {visible.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => run(item)}
                    className={`w-full flex items-center gap-3 px-5 min-h-[52px] text-left text-[15px] disabled:opacity-40 active:bg-muted ${
                      item.danger ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {item.icon && <span className="flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 pt-1 pb-3 border-t border-border">
              <button type="button" onClick={() => setOpen(false)} className="w-full min-h-[48px] rounded-lg bg-muted text-[15px] font-medium">
                取消
              </button>
            </div>
          </div>
        </AdminSheet>
      )}

      {open && !isMobile && (
        <>
          <div
            className="fixed inset-0 z-[70]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_W }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[71] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1 text-sm"
          >
            {visible.map((item, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => run(item)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted disabled:opacity-40 ${
                  item.danger ? 'text-destructive' : ''
                }`}
              >
                {item.icon && <span className="flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
