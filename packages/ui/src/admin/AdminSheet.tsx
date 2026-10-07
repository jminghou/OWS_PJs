'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface AdminSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** 底部固定操作列（儲存／取消…），手機會貼齊 safe-area。 */
  footer?: React.ReactNode;
  /** 桌機最大寬度。 */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
  /** 手機呈現：full = 全螢幕（表單／選圖），bottom = 底部抽屜（選單、短內容）。 */
  mobile?: 'full' | 'bottom';
  /** 內容區不加 padding（自己排版時用）。 */
  bare?: boolean;
  /** 桌機固定高度（例如選圖器要撐滿），預設依內容。 */
  desktopHeight?: string;
  className?: string;
}

const SIZE: Record<NonNullable<AdminSheetProps['size']>, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
  '2xl': 'md:max-w-2xl',
  '4xl': 'md:max-w-4xl',
  '6xl': 'md:max-w-6xl',
};

/**
 * 響應式對話框：桌機置中 modal；手機全螢幕或底部抽屜。
 * 不用 portal —— 要留在 admin 外殼的 `.dark` 節點底下，深色 token 才會生效。
 */
export function AdminSheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  mobile = 'full',
  bare = false,
  desktopHeight,
  className = '',
}: AdminSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 焦點移入對話框（不搶已經在裡面的焦點）
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open]);

  if (!open) return null;

  const mobilePanel =
    mobile === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl'
      : 'inset-0 rounded-none';

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={desktopHeight ? ({ ['--sheet-h' as string]: desktopHeight } as React.CSSProperties) : undefined}
        className={[
          'absolute flex flex-col bg-card text-card-foreground shadow-xl outline-none',
          mobilePanel,
          // 桌機：置中 modal
          'md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[calc(100%-2rem)] md:rounded-xl md:max-h-[90dvh] md:border md:border-border',
          desktopHeight ? 'md:h-[var(--sheet-h)]' : '',
          SIZE[size],
          className,
        ].join(' ')}
      >
        {mobile === 'bottom' && (
          <div className="md:hidden flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {title !== undefined && (
          <div className="flex items-center gap-2 px-4 md:px-5 h-14 border-b border-border flex-shrink-0">
            <div className="flex-1 min-w-0 font-semibold truncate">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉"
              className="-mr-2 flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bare ? '' : 'p-4 md:p-5'}`}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 md:px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 border-t border-border flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
