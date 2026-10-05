'use client';

/**
 * labeled 外殼：頂列（產品名／搜尋／快速動作／主題／使用者）＋ 240px 文字標籤分組側欄。
 *
 * 只用 token 類別（bg-background / bg-card / border-border / text-muted-foreground …），
 * 深色模式 = 根節點加 `dark` class，globals.css 的 .dark 會把整組 HSL 變數換掉。
 * 不動 Tailwind 的 darkMode 設定，公開站完全不受影響。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@ows/platform-api';
import { getAdminConfig, getHomePath } from '../config';
import type { AdminNavGroup } from '../config';
import { PLATFORM_NAV } from '../platformNav';
import { isNavActive, useVisibleGroups } from './useVisibleNav';

type Theme = 'light' | 'dark';
const THEME_KEY = 'ows-admin-theme';

/** 選單項目沒提供圖示時的通用圖示（與 rail 外殼相同），避免文字沒對齊。 */
function GenericNavIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}
const COLLAPSED_KEY = 'ows-admin-nav-collapsed';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function AdminLabeledShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { siteName, productName, extraNav = [], navGroups, globalSearch, quickAction } = getAdminConfig();

  const groups: AdminNavGroup[] = navGroups ?? [
    { items: PLATFORM_NAV },
    ...(extraNav.length ? [{ items: extraNav }] : []),
  ];
  const visible = useVisibleGroups(groups);

  const [theme, setTheme] = useState<Theme>('light');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  // 初始狀態放在 effect 讀，避免 SSR/CSR 不一致
  useEffect(() => {
    setTheme(readJson<Theme>(THEME_KEY, 'light'));
    setCollapsed(readJson<Record<string, boolean>>(COLLAPSED_KEY, {}));
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { window.localStorage.setItem(THEME_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const groupKey = (g: AdminNavGroup, idx: number) => g.label || `g${idx}`;
  const isCollapsed = (g: AdminNavGroup, idx: number) => {
    const k = groupKey(g, idx);
    return k in collapsed ? collapsed[k] : !!g.defaultCollapsed;
  };
  const toggleGroup = (g: AdminNavGroup, idx: number) => {
    const k = groupKey(g, idx);
    const next = { ...collapsed, [k]: !isCollapsed(g, idx) };
    setCollapsed(next);
    try { window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  const sidebar = (
    <nav className="flex-1 overflow-y-auto px-3 py-3">
      {visible.map((g, idx) => {
        const activeInside = g.items.some((i) => isNavActive(pathname, i.href));
        const closed = g.collapsible && isCollapsed(g, idx) && !activeInside;
        return (
          <div key={groupKey(g, idx)} className="mb-4">
            {g.label && (
              g.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(g, idx)}
                  className="w-full flex items-center gap-1 px-2 mb-1 text-[11px] font-medium tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <svg className={`w-3 h-3 transition-transform ${closed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                  {g.label}
                </button>
              ) : (
                <div className="px-2 mb-1 text-[11px] font-medium tracking-wide text-muted-foreground">{g.label}</div>
              )
            )}
            {!closed && (
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-admin-accent-100 text-admin-accent-800 font-medium dark:bg-admin-accent-800/40 dark:text-admin-accent-100'
                            : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <span className={`flex-shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px] ${active ? '' : 'text-muted-foreground'}`}>
                          {item.icon ?? <GenericNavIcon />}
                        </span>
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && <span className="flex-shrink-0 text-xs text-muted-foreground">{item.badge}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={theme === 'dark' ? 'dark' : ''} data-theme={theme}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* 頂列 */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-card flex-shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-1.5 -ml-1 rounded-md text-muted-foreground hover:bg-muted"
            aria-label="開啟選單"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href={getHomePath()} className="text-[15px] font-semibold tracking-tight whitespace-nowrap">
            {productName || siteName}
          </Link>
          <div className="flex-1 flex justify-center px-2 min-w-0">
            {globalSearch && <div className="w-full max-w-[560px]">{globalSearch}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {quickAction}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title={theme === 'dark' ? '切換淺色' : '切換深色'}
            >
              {theme === 'dark' ? (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenu((o) => !o)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium"
                title={`${user?.username} (${user?.role})`}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1 text-sm">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="font-medium truncate">{user?.username}</div>
                      <div className="text-xs text-muted-foreground">{user?.role}</div>
                    </div>
                    <button type="button" onClick={handleLogout} className="w-full text-left px-3 py-2 hover:bg-muted">登出</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* 桌面側欄 */}
          <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-border bg-card">
            {sidebar}
          </aside>

          {/* 行動抽屜 */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
              <aside className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col shadow-xl">
                <div className="flex items-center justify-between h-14 px-4 border-b border-border">
                  <span className="font-semibold">{productName || siteName}</span>
                  <button type="button" onClick={() => setDrawerOpen(false)} className="p-1 text-muted-foreground" aria-label="關閉">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {sidebar}
              </aside>
            </div>
          )}

          <main className="flex-1 min-w-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
