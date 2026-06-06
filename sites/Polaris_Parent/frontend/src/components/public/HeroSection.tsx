'use client';

import { useState } from 'react';
import HeroCarousel from './HeroCarousel';
import { HomepageSlide } from '@/types';

interface HeroSectionProps {
  eyebrow?: string; // 品牌小字眉標（顯示在描述性 H1 上方）
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  backgroundSlides: HomepageSlide[];
  locale: string;
  pauseOnHover?: boolean;  // Feature 7
  lazyLoading?: boolean;   // Feature 9
}

export default function HeroSection({
  eyebrow,
  title,
  subtitle,
  buttonText,
  buttonLink,
  backgroundSlides,
  locale,
  pauseOnHover = true,
  lazyLoading = true,
}: HeroSectionProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // 獲取當前幻燈片（按 sort_order 排序後）
  const sortedSlides = [...backgroundSlides].sort((a, b) => a.sort_order - b.sort_order);
  const currentSlide = sortedSlides[currentSlideIndex];

  // Feature 6: per-slide title override (fallback to global title prop)
  const displayTitle =
    currentSlide?.titles?.[locale] ||
    currentSlide?.titles?.['zh-TW'] ||
    title;

  // Subtitle: per-slide (fallback to global subtitle prop)
  const slideSubtitle =
    currentSlide?.subtitles?.[locale] ||
    currentSlide?.subtitles?.['zh-TW'] ||
    '';
  const displaySubtitle = slideSubtitle || subtitle;

  // Feature 1: per-slide CTA link (fallback to global scroll behavior)
  const hasCtaUrl = !!currentSlide?.cta_url;
  const ctaText =
    currentSlide?.cta_text?.[locale] ||
    currentSlide?.cta_text?.['zh-TW'] ||
    buttonText;
  const ctaUrl = currentSlide?.cta_url || buttonLink;
  const ctaNewTab = currentSlide?.cta_new_tab || false;

  const handleScrollToSection = () => {
    const element = document.getElementById('articles');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero" className="relative h-[350px] overflow-hidden">
      {/* Background - HeroCarousel for slides */}
      {backgroundSlides.length > 0 ? (
        <div className="absolute inset-0">
          <HeroCarousel
            slides={backgroundSlides}
            currentLanguage={locale}
            onSlideChange={setCurrentSlideIndex}
            pauseOnHover={pauseOnHover}
            lazyLoading={lazyLoading}
          />
        </div>
      ) : (
        <>
          {/* 暖紫漸層：紫為品牌核心，收尾帶暖金，破除冷感 */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-purple-700 via-brand-purple-500 to-warm-400" />
          {/* 只壓暗底部、保留上方通透，文字仍清晰 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent z-[1]" />
        </>
      )}

      {/* Content overlay - centered vertically and horizontally（含 CTA，統一置中、間距用 margin 控制）*/}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <div className="text-center pointer-events-auto px-4">
          {/* 品牌眉標（小字，在描述性 H1 上方） */}
          {eyebrow && (
            <p className="text-sm md:text-base font-medium tracking-widest text-white/80 mb-2 drop-shadow">
              {eyebrow}
            </p>
          )}
          {/* 描述性主標 H1（縮小一階 + 收緊行高） */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-wide leading-snug text-white text-center drop-shadow-md mb-2">
            {displayTitle}
          </h1>

          {/* Horizontal rule decoration — 暖金細線（縮短、拉近與副標距離） */}
          <div className="relative my-3">
            <hr className="w-16 border-t-2 border-warm-300/70 mx-auto" />
          </div>

          {/* Subtitle - 支援富文本 HTML（字級縮小） */}
          <div
            className="text-sm md:text-base text-white/90 text-center max-w-2xl mx-auto prose prose-invert prose-p:text-white/90 prose-p:my-1 prose-strong:text-white prose-em:text-purple-200"
            dangerouslySetInnerHTML={{ __html: displaySubtitle }}
          />

          {/* Feature 1: CTA button（移入流內、尺寸縮小、與上方拉開間距） */}
          <div className="mt-7">
            {hasCtaUrl ? (
              // Per-slide CTA: navigate to the slide's link
              <a
                href={ctaUrl}
                target={ctaNewTab ? '_blank' : '_self'}
                rel={ctaNewTab ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center px-6 py-2.5 text-sm bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-banner transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {ctaText}
              </a>
            ) : (
              // Global fallback: scroll to #banner section
              <button
                onClick={handleScrollToSection}
                className="inline-flex items-center px-6 py-2.5 text-sm bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-banner transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {ctaText}
                <svg
                  className="ml-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
