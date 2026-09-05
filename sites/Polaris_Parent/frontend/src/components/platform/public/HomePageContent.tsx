'use client';

import HeroSection from '@/components/platform/public/HeroSection';
import LatestArticlesSection from '@/components/platform/public/LatestArticlesSection';
import FeaturesGrid from '@/components/platform/public/FeaturesGrid';
import { Content, HomepageSettings } from '@/types';

interface HomePageContentProps {
  /**
   * 首頁末段的站台專屬區塊（在「服務與產品」與 footer 之間）。
   *
   * 這裡刻意做成 slot 而非寫死內容：HomePageContent 是平台元件，未來會抽進
   * packages/site-kit 供所有站台共用，不該知道紫微斗數的存在。領域區塊由
   * 頁面組裝後傳進來 —— 見 app/(public)/page.tsx。
   */
  domainSection?: React.ReactNode;
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
  domainSection,
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

      {domainSection}
    </>
  );
}
