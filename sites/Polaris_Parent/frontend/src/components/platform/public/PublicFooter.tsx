'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 多語言內容
const footerContent: Record<string, {
  siteName: string;
  articles: string;
  about: string;
  contact: string;
  privacy: string;
  rights: string;
}> = {
  'zh-TW': { siteName: '親紫之間', articles: '親紫專欄', about: '關於我們', contact: '聯絡我們', privacy: '隱私權政策', rights: '版權所有' },
  'zh-CN': { siteName: '亲紫之间', articles: '亲紫专栏', about: '关于我们', contact: '联系我们', privacy: '隐私政策', rights: '版权所有' },
  'en': { siteName: 'Qin Zi Blog', articles: 'Articles', about: 'About', contact: 'Contact', privacy: 'Privacy Policy', rights: 'All rights reserved' },
  'ja': { siteName: '親紫の間', articles: '記事', about: '私たちについて', contact: 'お問い合わせ', privacy: 'プライバシーポリシー', rights: '全著作権所有' },
};

const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

export default function PublicFooter() {
  const pathname = usePathname();

  // 從路徑獲取當前語言
  const pathLocale = pathname.split('/')[1];
  const currentLocale = locales.includes(pathLocale) ? pathLocale : 'zh-TW';
  const content = footerContent[currentLocale] || footerContent['zh-TW'];
  const basePath = currentLocale === 'zh-TW' ? '' : `/${currentLocale}`;

  const links = [
    { href: `${basePath}/articles`, label: content.articles },
    { href: `${basePath}/about`, label: content.about },
    { href: `${basePath}/contact`, label: content.contact },
    { href: `${basePath}/privacy`, label: content.privacy },
  ];

  return (
    <footer className="border-t border-warm-200 bg-warm-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {content.siteName}. {content.rights}
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-brand-purple-700 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
