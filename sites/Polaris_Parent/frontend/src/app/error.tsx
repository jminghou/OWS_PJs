'use client';

import { useEffect } from 'react';
import BrandButton from '@/components/ui/BrandButton';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  // 根層級錯誤頁不在 .public-site 裡，字體與底色要自己帶（docs/BRAND_GUIDELINES.md §3、§4）
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper font-body">
      <div className="px-4 text-center md:px-6">
        <h1 className="mb-4 font-latin text-[40px] font-extrabold leading-[1.25] text-blue-500 md:text-display">500</h1>
        <h2 className="mb-2 font-heading text-[22px] font-normal leading-[1.4] text-ink md:text-h3">
          發生錯誤
        </h2>
        <p className="mb-8 text-text [text-wrap:pretty]">
          很抱歉，系統發生了意外錯誤。請稍後再試。
        </p>
        <BrandButton variant="primary" onClick={reset}>
          重新載入
        </BrandButton>
      </div>
    </div>
  );
}
