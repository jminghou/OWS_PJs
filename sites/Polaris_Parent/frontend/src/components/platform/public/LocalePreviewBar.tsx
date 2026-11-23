'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { defaultLocale, isLocale, localeNames } from '@/i18n/config';
import { FLAG_COOKIE } from '@/lib/i18n/localePreview';

// 只有持語言預覽通行證的人看得到這條：提示目前語言是否公開、提供離開預覽。
// 切換語言用頁首的語言選單（持通行證時也會列出編輯中的語言）。
// 判斷用的是「非 httpOnly」的旗標 cookie，它只決定要不要顯示，不是權限：真正的通行證在 httpOnly cookie，由 middleware 驗證。

function hasFlag() {
  return document.cookie.split('; ').some((c) => c.startsWith(`${FLAG_COOKIE}=`));
}

export default function LocalePreviewBar() {
  const pathname = usePathname() || '/';
  const [active, setActive] = useState(false);
  const [publicLocales, setPublicLocales] = useState<string[]>([defaultLocale]);

  useEffect(() => {
    if (!hasFlag()) return;
    setActive(true);
    fetch('/api/v1/settings/i18n')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s?.public_languages && setPublicLocales(s.public_languages))
      .catch(() => {});
  }, []);

  if (!active) return null;

  const first = pathname.split('/')[1];
  const current = isLocale(first) ? first : defaultLocale;
  const hidden = !publicLocales.includes(current);

  return (
    <div role="status" className="bg-amber-100 text-amber-950 text-sm border-b border-amber-300">
      <div className="mx-auto max-w-6xl px-4 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="whitespace-nowrap">語言預覽模式</strong>
        <span className="text-amber-900">
          {localeNames[current]}：{hidden ? '尚未公開，一般訪客看不到這一頁。' : '已公開。'}可用頁首的語言選單切換語言。
        </span>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/locale-preview/exit" className="ml-auto underline whitespace-nowrap">離開預覽</a>
      </div>
    </div>
  );
}
