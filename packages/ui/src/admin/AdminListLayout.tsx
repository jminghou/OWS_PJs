'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, PanelLeft, X } from 'lucide-react';

export interface AdminListLayoutProps {
  sidebar?: React.ReactNode;
  /** md 以上的側欄寬度（px）。手機不使用。 */
  sidebarWidth?: number;
  children: React.ReactNode;
  className?: string;
  /**
   * 手機（< md）顯示哪一邊：
   * - 'list'：側欄（清單）佔滿畫面
   * - 'detail'：主區佔滿畫面，頂部有返回列
   * 不傳時手機顯示主區，側欄收成可開關的抽屜（適合「區塊導覽」型側欄）。
   */
  mobileView?: 'list' | 'detail';
  /** 手機詳情頁的「返回」動作（通常是清掉選取）。有傳才顯示返回鈕。 */
  onMobileBack?: () => void;
  /** 手機頂部列的標題。 */
  mobileTitle?: React.ReactNode;
  /** 手機頂部列右側的額外動作。 */
  mobileActions?: React.ReactNode;
  /** 抽屜模式下開啟側欄的按鈕文字。 */
  mobileListLabel?: string;
  /** 這個值改變時自動關閉抽屜（例如傳目前選取的 id／區塊）。 */
  closeDrawerOn?: unknown;
}

/**
 * 左清單＋右內容。md 以上維持左右兩欄；手機改成一次只看一邊（清單 → 詳情 → 返回），
 * 或把側欄收成抽屜，避免固定寬度的側欄把表單擠到只剩幾十 px。
 */
export function AdminListLayout({
  sidebar,
  sidebarWidth = 224,
  children,
  className = '',
  mobileView,
  onMobileBack,
  mobileTitle,
  mobileActions,
  mobileListLabel = '清單',
  closeDrawerOn,
}: AdminListLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [closeDrawerOn]);

  if (!sidebar) {
    return <div className={`p-4 md:p-6 ${className}`}>{children}</div>;
  }

  const drawerMode = mobileView === undefined;
  const showListOnMobile = mobileView === 'list';
  const showMobileBar = drawerMode || (mobileView === 'detail' && (onMobileBack || mobileTitle || mobileActions));

  return (
    <div
      className={`relative flex h-full min-h-0 ${className}`}
      style={{ ['--admin-sidebar-w' as string]: `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* 側欄：md 以上固定寬度；手機只有 list 模式才佔滿 */}
      <div
        className={`${showListOnMobile ? 'flex w-full' : 'hidden'} md:flex md:w-[min(var(--admin-sidebar-w),40%)] lg:w-[var(--admin-sidebar-w)] flex-col flex-shrink-0 min-h-0 overflow-y-auto bg-card border-r border-border`}
      >
        {sidebar}
      </div>

      {/* 主區 */}
      <div className={`${showListOnMobile ? 'hidden md:flex' : 'flex'} flex-1 min-w-0 flex-col min-h-0`}>
        {showMobileBar && (
          <div className="md:hidden flex items-center gap-1 h-12 px-2 border-b border-border bg-card flex-shrink-0">
            {drawerMode ? (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 h-10 px-2 rounded-md text-sm text-foreground hover:bg-muted"
              >
                <PanelLeft size={18} />
                {mobileListLabel}
              </button>
            ) : onMobileBack ? (
              <button
                type="button"
                onClick={onMobileBack}
                className="flex items-center h-10 pl-1 pr-2 rounded-md text-sm text-foreground hover:bg-muted"
              >
                <ChevronLeft size={20} />
                返回
              </button>
            ) : null}
            <div className="flex-1 min-w-0 truncate text-sm font-medium text-center">{mobileTitle}</div>
            <div className="flex items-center gap-1 min-w-[4.5rem] justify-end">{mobileActions}</div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>

      {/* 手機抽屜 */}
      {drawerMode && drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs flex flex-col bg-card border-r border-border shadow-xl">
            <div className="flex items-center justify-between h-12 pl-4 pr-1 border-b border-border flex-shrink-0">
              <span className="text-sm font-medium">{mobileListLabel}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="關閉"
                className="flex items-center justify-center w-11 h-11 text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">{sidebar}</div>
          </div>
        </div>
      )}
    </div>
  );
}
