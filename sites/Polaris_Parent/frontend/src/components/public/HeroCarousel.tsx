'use client';

import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { HomepageSlide } from '@/types';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

interface HeroCarouselProps {
  slides: HomepageSlide[];
  currentLanguage: string;
  onSlideChange?: (slideIndex: number) => void;
}

export default function HeroCarousel({ slides, currentLanguage, onSlideChange }: HeroCarouselProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 初始化時通知第一張幻燈片
    if (onSlideChange) {
      onSlideChange(0);
    }
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
        onSlideChange={(swiper) => {
          if (onSlideChange) {
            // 使用 realIndex 來處理 loop 模式下的真實索引
            onSlideChange(swiper.realIndex);
          }
        }}
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

              {/* 副標題已移至 HeroSection 顯示 */}
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
