'use client';

import HeroSection from '@/components/public/HeroSection';
import BannerSection from '@/components/public/BannerSection';
import ArticleCarousel from '@/components/public/ArticleCarousel';
import AboutPreview from '@/components/public/AboutPreview';
import FeaturesGrid from '@/components/public/FeaturesGrid';
import { Content, HomepageSettings } from '@/types';
import { getImageUrl } from '@/lib/utils';

interface HomePageContentProps {
  locale: string;
  content: {
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
  featuredPosts: Content[];
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
  featuredPosts,
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
      {/* 1. Hero Section - Full viewport */}
      <HeroSection
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        buttonText={homepageSettings.button_text?.[locale] || content.aboutBtn}
        buttonLink={`${basePath}/about`}
        backgroundSlides={homepageSettings.slides}
        locale={locale}
        pauseOnHover={homepageSettings.pause_on_hover ?? true}
        lazyLoading={homepageSettings.lazy_loading ?? true}
      />

      {/* 2. About Preview Section */}
      <AboutPreview
        title={homepageSettings.about_section?.[locale]?.title || content.aboutTitle}
        philosophy={homepageSettings.about_section?.[locale]?.philosophy || content.aboutPhilosophy}
        quote={homepageSettings.about_section?.[locale]?.quote || content.aboutQuote}
        missionPoints={homepageSettings.about_section?.[locale]?.mission_points || content.aboutMissionPoints}
        learnMoreText={content.learnMoreBtn}
        learnMoreLink={`${basePath}/about`}
        imageUrl={homepageSettings.about_section?.[locale]?.image_url ? getImageUrl(homepageSettings.about_section[locale].image_url) : undefined}
      />

      {/* 3. Carousel Section - Horizontal scroll articles */}
      <ArticleCarousel
        title={content.featuredTitle}
        description={content.featuredDescription}
        articles={featuredPosts}
        viewMoreLink={`${basePath}/articles`}
        viewMoreText={content.viewMore}
        emptyMessage={content.noContent}
      />

      {/* 4. Banner Section - Text only */}
      <BannerSection
        heading={content.bannerHeading}
        description={content.bannerDescription}
      />

      {/* 5. Features Section - Product placeholders */}
      <FeaturesGrid
        title={content.featuresTitle}
        description={content.featuresDescription}
        features={features}
      />
    </>
  );
}
