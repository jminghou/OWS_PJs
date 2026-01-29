'use client';

import HeroCarousel from './HeroCarousel';
import { HomepageSlide } from '@/types';

interface HeroSectionProps {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  backgroundSlides: HomepageSlide[];
  locale: string;
}

export default function HeroSection({
  title,
  subtitle,
  buttonText,
  buttonLink,
  backgroundSlides,
  locale,
}: HeroSectionProps) {
  const handleScrollToSection = () => {
    const element = document.getElementById('banner');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero" className="relative h-[calc(100vh-64px)] min-h-[500px] md:min-h-[640px] overflow-hidden">
      {/* Background - HeroCarousel for slides */}
      {backgroundSlides.length > 0 ? (
        <div className="absolute inset-0">
          <HeroCarousel slides={backgroundSlides} currentLanguage={locale} />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple-600 to-brand-purple-800" />
      )}

      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30 z-[1]" />

      {/* Content overlay - centered vertically and horizontally */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <div className="text-center pointer-events-auto px-4">
          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center drop-shadow-lg mb-4">
            {title}
          </h1>

          {/* Horizontal rule decoration */}
          <div className="relative my-6">
            <hr className="w-24 border-t-2 border-white/50 mx-auto" />
          </div>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-white/90 text-center max-w-2xl mx-auto mb-8">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Button at bottom - standard rounded button (NOT circular) */}
      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={handleScrollToSection}
          className="inline-flex items-center px-8 py-4 bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          {buttonText}
          <svg
            className="ml-2 h-5 w-5"
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
      </div>
    </section>
  );
}
