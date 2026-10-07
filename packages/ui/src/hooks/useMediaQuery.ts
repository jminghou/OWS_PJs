'use client';

import { useEffect, useState } from 'react';

/**
 * 訂閱 CSS media query。SSR 與首次 render 一律回 `false`（= 桌機假設），
 * 掛載後才讀真實值，避免 hydration 不一致。版面切換請優先用 Tailwind 斷點，
 * 這個 hook 只給「非得用 JS 決定」的地方（例如 Sheet vs Popover、面板預設開關）。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 手機版型（< Tailwind md = 768px）。 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767.98px)');
}

/** 小於 Tailwind lg（1024px）：手機＋平板直式。 */
export function useIsBelowLg(): boolean {
  return useMediaQuery('(max-width: 1023.98px)');
}

/** 觸控為主、無 hover 的裝置。 */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)');
}
