'use client';

import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { HomepageSlide } from '@/types';
import ReactMarkdown from 'react-markdown';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

interface HeroCarouselProps {
  slides: HomepageSlide[];
  currentLanguage: string;
}

export default function HeroCarousel({ slides, currentLanguage }: HeroCarouselProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || slides.length === 0) {
    return null;
  }

  // 按 sort_order 排序
  const sortedSlides = [...slides].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="relative w-full h-full">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        spaceBetween={0}
        slidesPerView={1}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        speed={3000}
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        loop={sortedSlides.length > 1}
        className="h-full"
      >
        {sortedSlides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <div className="relative w-full h-full">
              {/* 背景圖片 */}
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${slide.image_url.startsWith('http') ? slide.image_url : `http://localhost:5000${slide.image_url}`})`,
                }}
              >
                {/* 漸層遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
              </div>

              {/* 文字內容 */}
              <div className="relative h-full flex items-center justify-center">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                  <div className="prose prose-lg prose-invert mx-auto">
                    <ReactMarkdown
                      components={{
                        // 自訂 Markdown 元素樣式
                        p: ({ children }) => (
                          <p className="text-xl md:text-2xl text-white mb-4 leading-relaxed">
                            {children}
                          </p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-white">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-purple-200">{children}</em>
                        ),
                        h1: ({ children }) => (
                          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xl md:text-2xl font-medium text-white mb-3">
                            {children}
                          </h3>
                        ),
                      }}
                    >
                      {slide.subtitles[currentLanguage] || slide.subtitles['zh-TW'] || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* 自訂導航按鈕樣式 */}
      <style jsx global>{`
        .swiper-pagination-bullet {
          background: white;
          opacity: 0.5;
          width: 8px;
          height: 8px;
        }

        .swiper-pagination-bullet-active {
          opacity: 1;
          background: white;
        }
      `}</style>
    </div>
  );
}
