import { Metadata } from 'next';
import Link from 'next/link';

// 從 i18n 訊息檔案載入翻譯（預設使用繁體中文）
import zhTW from '@/i18n/messages/zh-TW.json';

const t = zhTW.aboutPage;

export const metadata: Metadata = {
  title: t.title,
  description: t.description,
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="prose prose-lg max-w-none">
        {/* 個人故事區塊 */}
        <section className="mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
            {t.aboutMe}
          </h1>
          <div className="bg-warm-50 rounded-lg p-8 mb-8">
            <p className="text-lg leading-relaxed text-gray-700">
              {t.story}
            </p>
          </div>
        </section>

        {/* 品牌故事區塊 */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {t.siteOriginTitle}
          </h2>
          <div className="bg-brand-purple-50 rounded-lg p-8 mb-6">
            <div className="border-l-4 border-brand-purple-500 pl-6 italic text-brand-purple-700 text-xl mb-6">
              <p className="mb-2">
                {t.quote}
              </p>
              <p className="text-sm text-right text-gray-500">
                {t.quoteAuthor}
              </p>
            </div>
            <p className="text-lg leading-relaxed text-gray-700">
              {t.siteOrigin}
            </p>
          </div>
        </section>

        {/* 品牌理念區塊 */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {t.missionTitle}
          </h2>
          <div className="bg-gray-50 rounded-lg p-8">
            <p className="text-lg leading-relaxed text-gray-700">
              {t.mission}
            </p>
          </div>
        </section>

        {/* 品牌使命區塊 */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {t.exploreTitle}
          </h2>
          <p className="text-lg text-gray-600 mb-8 whitespace-pre-line">
            {t.exploreDescription}
          </p>
          <div className="flex justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              {t.contactBtn}
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
