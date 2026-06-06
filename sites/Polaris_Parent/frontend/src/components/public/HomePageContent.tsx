'use client';

import HeroSection from '@/components/public/HeroSection';
import LatestArticlesSection from '@/components/public/LatestArticlesSection';
import FeaturesGrid from '@/components/public/FeaturesGrid';
import ZiweiChartForm from '@/components/public/ZiweiChartForm';
import { Content, HomepageSettings } from '@/types';

interface HomePageContentProps {
  locale: string;
  content: {
    heroBrand: string;
    heroTitle: string;
    heroSubtitle: string;
    aboutBtn: string;
    bannerHeading: string;
    bannerDescription: string;
    featuredTitle: string;
    featuredDescription: string;
    viewMore: string;
    noContent: string;
    aboutTitle: string;
    aboutPhilosophy: string;
    aboutQuote: string;
    aboutMissionPoints: string[];
    learnMoreBtn: string;
    featuresTitle: string;
    featuresDescription: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
  };
  latestPosts: Content[];
  homepageSettings: HomepageSettings;
}

// Feature Icons
const ReportIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const ConsultIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
    />
  </svg>
);

const CourseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    />
  </svg>
);

export default function HomePageContent({
  locale,
  content,
  latestPosts,
  homepageSettings,
}: HomePageContentProps) {
  const basePath = locale === 'zh-TW' ? '' : `/${locale}`;

  // Prepare features data
  const features = [
    {
      icon: <ReportIcon className="w-7 h-7 text-brand-purple-600" />,
      title: content.feature1Title,
      description: content.feature1Desc,
      comingSoon: true,
    },
    {
      icon: <ConsultIcon className="w-7 h-7 text-brand-purple-600" />,
      title: content.feature2Title,
      description: content.feature2Desc,
      comingSoon: true,
    },
    {
      icon: <CourseIcon className="w-7 h-7 text-brand-purple-600" />,
      title: content.feature3Title,
      description: content.feature3Desc,
      comingSoon: true,
    },
  ];

  return (
    <>
      {/* 1. Hero Section - Full viewport（品牌眉標 + 描述性 H1） */}
      <HeroSection
        eyebrow={content.heroBrand}
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        buttonText={homepageSettings.button_text?.[locale] || content.aboutBtn}
        buttonLink={`${basePath}/about`}
        backgroundSlides={homepageSettings.slides}
        locale={locale}
        pauseOnHover={homepageSettings.pause_on_hover ?? true}
        lazyLoading={homepageSettings.lazy_loading ?? true}
      />

      {/* 2. 最新文章牆 - 最多 12 篇 + 查看更多 */}
      <LatestArticlesSection
        title={content.featuredTitle}
        description={content.featuredDescription}
        articles={latestPosts}
        viewMoreLink={`${basePath}/articles`}
        viewMoreText={content.viewMore}
        emptyMessage={content.noContent}
      />

      {/* 3. 商品 Section */}
      <FeaturesGrid
        title={content.featuresTitle}
        description={content.featuresDescription}
        features={features}
      />

      {/* 4. 線上排盤 Section（服務與產品 ↔ footer 之間）*/}
      <section id="ziwei" className="relative py-20 md:py-28 bg-white scroll-mt-14 overflow-hidden">
        {/* 有機點綴：柔和暖紫光暈，避免全是直角色塊 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-purple-100/50 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-warm-200/50 blur-3xl"
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-wide text-gray-900 mb-4">
              紫微斗數 線上排盤
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              輸入出生時辰，立即排出十二宮命盤，可下載 SVG / PNG
            </p>
          </div>
          <ZiweiChartForm />
        </div>
      </section>
    </>
  );
}
