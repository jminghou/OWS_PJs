'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 多語言內容
const footerContent: Record<string, {
  siteName: string;
  description: string;
  quickLinks: string;
  home: string;
  articles: string;
  about: string;
  contact: string;
  contactInfo: string;
  privacy: string;
  terms: string;
  copyright: string;
}> = {
  'zh-TW': {
    siteName: '親紫之間',
    description: '透過紫微斗數與數據分析，幫助家長理解孩子的獨特之處，成為孩子身後那張「穩定之弓」。',
    quickLinks: '快速連結',
    home: '首頁',
    articles: '親紫專欄',
    about: '關於我們',
    contact: '聯絡我們',
    contactInfo: '聯絡資訊',
    privacy: '隱私政策',
    terms: '使用條款',
    copyright: '© 2024 親紫之間. 版權所有。',
  },
  'zh-CN': {
    siteName: '亲紫之间',
    description: '通过紫微斗数与数据分析，帮助家长理解孩子的独特之处，成为孩子身后那张「稳定之弓」。',
    quickLinks: '快速链接',
    home: '首页',
    articles: '亲紫专栏',
    about: '关于我们',
    contact: '联系我们',
    contactInfo: '联系信息',
    privacy: '隐私政策',
    terms: '使用条款',
    copyright: '© 2024 亲紫之间. 版权所有。',
  },
  'en': {
    siteName: 'Qin Zi Blog',
    description: 'Through Zi Wei Dou Shu and data analysis, help parents understand the uniqueness of their children and become the "stable bow" behind them.',
    quickLinks: 'Quick Links',
    home: 'Home',
    articles: 'Articles',
    about: 'About Us',
    contact: 'Contact',
    contactInfo: 'Contact Info',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    copyright: '© 2024 Qin Zi Blog. All rights reserved.',
  },
  'ja': {
    siteName: '親紫の間',
    description: '紫微斗数とデータ分析を通じて、親が子供のユニークさを理解し、子供の背後にある「安定した弓」になるのを助けます。',
    quickLinks: 'クイックリンク',
    home: 'ホーム',
    articles: '記事',
    about: '私たちについて',
    contact: 'お問い合わせ',
    contactInfo: '連絡先情報',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    copyright: '© 2024 親紫の間. 全著作権所有。',
  },
};

const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

export default function PublicFooter() {
  const pathname = usePathname();

  // 從路徑獲取當前語言
  const getCurrentLocale = () => {
    const pathLocale = pathname.split('/')[1];
    if (locales.includes(pathLocale)) {
      return pathLocale;
    }
    return 'zh-TW';
  };

  const currentLocale = getCurrentLocale();
  const content = footerContent[currentLocale] || footerContent['zh-TW'];
  const basePath = currentLocale === 'zh-TW' ? '' : `/${currentLocale}`;

  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">{content.siteName}</h3>
            <p className="text-gray-300 leading-relaxed max-w-md">
              {content.description}
            </p>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-4">{content.quickLinks}</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href={basePath || '/'}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {content.home}
                </Link>
              </li>
              <li>
                <Link
                  href={`${basePath}/articles`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {content.articles}
                </Link>
              </li>
              <li>
                <Link
                  href={`${basePath}/about`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {content.about}
                </Link>
              </li>
              {/* <li>
                <Link
                  href={`${basePath}/contact`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {content.contact}
                </Link>
              </li> */}
            </ul>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-4">{content.contactInfo}</h4>
            <ul className="space-y-2">
              <li className="text-gray-300">
                Email: contact@example.com
              </li>
              <li>
                <Link
                  href={`${basePath}/privacy`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {content.privacy}
                </Link>
              </li>
              <li>
                <Link
                  href={`${basePath}/terms`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {content.terms}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-300 text-sm">
              {content.copyright}
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a
                href="https://github.com"
                className="text-gray-300 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                className="text-gray-300 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
