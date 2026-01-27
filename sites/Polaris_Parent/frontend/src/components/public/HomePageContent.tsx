'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import PostCard from '@/components/public/PostCard';
import HeroCarousel from '@/components/public/HeroCarousel';
import { Content, HomepageSettings } from '@/types';

interface HomePageContentProps {
  locale: string;
  content: {
    heroTitle: string;
    description: string;
    aboutBtn: string;
    featuredTitle: string;
    featuredDescription: string;
    viewMore: string;
    noContent: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
  };
  featuredPosts: Content[];
  homepageSettings: HomepageSettings;
}

export default function HomePageContent({
  locale,
  content,
  featuredPosts,
  homepageSettings,
}: HomePageContentProps) {
  const basePath = locale === 'zh-TW' ? '' : `/${locale}`;

  return (
    <>
      {/* Hero Section with Carousel */}
      <section className="relative h-[400px] md:h-[600px] overflow-hidden">
        {homepageSettings.slides.length > 0 ? (
          <HeroCarousel slides={homepageSettings.slides} currentLanguage={locale} />
        ) : (
          // 備用靜態內容（當沒有設定幻燈片時）
          <div className="relative h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center px-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                {content.heroTitle}
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                {content.description}
              </p>
            </div>
          </div>
        )}

        {/* 固定標題和按鈕覆蓋層 */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="h-full flex flex-col items-center justify-between py-12">
            {/* 固定標題 */}
            <div className="text-center pointer-events-auto">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg mb-2">
                {content.heroTitle}
              </h1>
            </div>

            {/* 固定按鈕 */}
            <div className="pointer-events-auto">
              <Link
                href={`${basePath}/about`}
                className="inline-flex items-center px-8 py-4 bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform duration-200"
              >
                {homepageSettings.button_text?.[locale] || content.aboutBtn}
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Building Feature Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Left Content (1/3) */}
            <div className="w-full lg:w-1/3 space-y-6">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                專屬於您的<br />
                命盤報告
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                協助家長拿到孩子的『原廠命運規格書』，用理性的PM思維，實現有效溝通、天賦啟發、價值完成。
              </p>
              <div className="pt-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                  了解更多
                </Button>
              </div>
            </div>

            {/* Right Image Area (2/3) */}
            <div className="w-full lg:w-2/3">
              <div className="relative bg-slate-200 rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-[16/10] shadow-lg flex items-center justify-center group transition-transform hover:shadow-xl duration-300">
                {/* Placeholder background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300"></div>
                
                {/* Placeholder Icon/Text */}
                <div className="relative flex flex-col items-center p-8 text-center z-10">
                  <svg className="w-24 h-24 mb-4 text-slate-400 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xl font-medium text-slate-500">圖片展示區域</span>
                  <span className="text-sm mt-2 text-slate-400">(建議尺寸: 1200 x 800px)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {content.featuredTitle}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {content.featuredDescription}
            </p>
          </div>

          {featuredPosts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {featuredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              <div className="text-center">
                <Link
                  href={`${basePath}/articles`}
                  className="inline-flex items-center px-6 py-3 bg-brand-purple-100 hover:bg-brand-purple-200 text-brand-purple-800 font-medium rounded-lg transition-colors"
                >
                  {content.viewMore}
                  <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">{content.noContent}</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-8 shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{content.feature1Title}</h3>
              <p className="text-gray-600">{content.feature1Desc}</p>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{content.feature2Title}</h3>
              <p className="text-gray-600">{content.feature2Desc}</p>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{content.feature3Title}</h3>
              <p className="text-gray-600">{content.feature3Desc}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}



