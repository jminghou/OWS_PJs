'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/ui/BrandLogo';

// 多語言內容
const footerContent: Record<string, {
  siteName: string;
  slogan: string;
  explore: string;
  info: string;
  home: string;
  reports: string;
  articles: string;
  newsletter: string;
  about: string;
  contact: string;
  privacy: string;
  rights: string;
}> = {
  'zh-TW': {
    siteName: '親紫之間', slogan: '以紫微斗數為線索，陪你重新讀懂他。', explore: '探索', info: '關於',
    home: '首頁', reports: '購買報告', articles: '親紫專欄', newsletter: '電子報',
    about: '關於我們', contact: '聯絡我們', privacy: '隱私權政策', rights: '版權所有',
  },
  'zh-CN': {
    siteName: '亲紫之间', slogan: '以紫微斗数为线索，陪你重新读懂他。', explore: '探索', info: '关于',
    home: '首页', reports: '购买报告', articles: '亲紫专栏', newsletter: '电子报',
    about: '关于我们', contact: '联系我们', privacy: '隐私政策', rights: '版权所有',
  },
  'en': {
    siteName: 'Qin Zi Blog', slogan: 'Using Zi Wei Dou Shu as a clue to understand your child anew.', explore: 'Explore', info: 'About',
    home: 'Home', reports: 'Buy a Report', articles: 'Articles', newsletter: 'Newsletter',
    about: 'About', contact: 'Contact', privacy: 'Privacy Policy', rights: 'All rights reserved',
  },
  'ja': {
    siteName: '親紫の間', slogan: '紫微斗数を手がかりに、もう一度あの子を読み解く。', explore: '探す', info: '私たちについて',
    home: 'ホーム', reports: 'レポートを購入', articles: '記事', newsletter: 'ニュースレター',
    about: '私たちについて', contact: 'お問い合わせ', privacy: 'プライバシーポリシー', rights: '全著作権所有',
  },
};

const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

const LINK = 'rounded-full transition-colors duration-150 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100/40';

export default function PublicFooter() {
  const pathname = usePathname();

  // 從路徑獲取當前語言
  const pathLocale = pathname.split('/')[1];
  const currentLocale = locales.includes(pathLocale) ? pathLocale : 'zh-TW';
  const content = footerContent[currentLocale] || footerContent['zh-TW'];
  const basePath = currentLocale === 'zh-TW' ? '' : `/${currentLocale}`;

  const columns = [
    {
      title: content.explore,
      links: [
        { href: basePath || '/', label: content.home },
        // 客製報告目前只有中文頁面（/report）
        { href: '/report', label: content.reports },
        { href: `${basePath}/articles`, label: content.articles },
        { href: `${basePath}/newsletter`, label: content.newsletter },
      ],
    },
    {
      title: content.info,
      links: [
        { href: `${basePath}/about`, label: content.about },
        { href: `${basePath}/contact`, label: content.contact },
        { href: `${basePath}/privacy`, label: content.privacy },
      ],
    },
  ];

  return (
    <footer className="bg-ink py-10 text-[#D5D7E0]">
      <div className="mx-auto max-w-content px-4 md:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* 墨底可用全彩 Logo（品牌規範 §2.2）；字標反白 */}
          <div className="max-w-xs">
            <Link href={basePath || '/'} className="inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100/40">
              <LogoMark tone="brand" width={58} alt="" />
              <span className="font-heading text-[19px] tracking-[.06em] text-white">{content.siteName}</span>
            </Link>
            <p className="mt-4 text-small">{content.slogan}</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-8 sm:gap-x-16">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="mb-3 text-small font-bold text-white">{col.title}</p>
                <ul className="flex flex-col gap-2 text-small">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 font-latin text-[12px] text-[#A9ADBD]">
          © {new Date().getFullYear()} {content.siteName}. {content.rights}
        </p>
      </div>
    </footer>
  );
}
