'use client';

import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { HomepageSlide } from '@/types';
import { getImageUrl } from '@/lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

interface HeroCarouselProps {
  slides: HomepageSlide[];
  currentLanguage: string;
  onSlideChange?: (slideIndex: number) => void;
  pauseOnHover?: boolean;  // Feature 7
  lazyLoading?: boolean;   // Feature 9
}

// ─── YouTube URL → video ID helper ───────────────────────────────────────────
function extractYoutubeId(url: string): string {
  return url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';
}

// ─── Per-slide media renderer ─────────────────────────────────────────────────
function SlideMedia({
  slide,
  isFirst,
  lazyLoading,
}: {
  slide: HomepageSlide;
  isFirst: boolean;
  lazyLoading: boolean;
}) {
  const mediaType = slide.media_type || 'image';
  const focalPoint = slide.focal_point || 'center center';
  const overlayOpacity = ((slide.overlay_opacity ?? 40) / 100).toFixed(2);
  const overlayStyle = { backgroundColor: `rgba(0,0,0,${overlayOpacity})` };

  // Feature 3a: YouTube background video
  if (mediaType === 'youtube' && slide.video_url) {
    const vid = extractYoutubeId(slide.video_url);
    const embedSrc = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1`;
    return (
      <div className="absolute inset-0 overflow-hidden">
        <iframe
          src={embedSrc}
          allow="autoplay; encrypted-media"
          title={slide.alt_text || 'background video'}
          className="absolute pointer-events-none"
          style={{
            width: '300%',
            height: '300%',
            top: '-100%',
            left: '-100%',
          }}
        />
        {/* Feature 5: per-slide overlay */}
        <div className="absolute inset-0" style={overlayStyle} />
      </div>
    );
  }

  // Feature 3b: MP4 direct video
  if (mediaType === 'video' && slide.video_url) {
    const src = slide.video_url.startsWith('http')
      ? slide.video_url
      : `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}${slide.video_url}`;
    return (
      <div className="absolute inset-0 overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: focalPoint }}
          autoPlay
          muted
          loop
          playsInline
          src={src}
        />
        {/* Feature 5: per-slide overlay */}
        <div className="absolute inset-0" style={overlayStyle} />
      </div>
    );
  }

  // Feature 10: Responsive image with srcset (replaces CSS background-image)
  // Feature 4: object-position from focal point
  // Feature 9: lazy loading for non-first slides
  const rawUrl = getImageUrl(slide.image_url);
  const mediumUrl = getImageUrl(slide.image_url, 'medium');

  return (
    <div className="absolute inset-0">
      <img
        src={rawUrl}
        srcSet={`${mediumUrl} 1280w, ${rawUrl} 1920w`}
        sizes="100vw"
        alt={slide.alt_text || ''}
        loading={!isFirst && lazyLoading ? 'lazy' : 'eager'}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: focalPoint }}
        onError={(e) => {
          const t = e.target as HTMLImageElement;
          // If medium variant fails, fall back to original
          if (t.src !== rawUrl) {
            t.src = rawUrl;
          }
        }}
      />
      {/* Feature 5: per-slide overlay opacity */}
      <div className="absolute inset-0" style={overlayStyle} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HeroCarousel({
  slides,
  currentLanguage,
  onSlideChange,
  pauseOnHover = true,
  lazyLoading = true,
}: HeroCarouselProps) {
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
          delay: 6000,                     // global default
          disableOnInteraction: false,
          pauseOnMouseEnter: pauseOnHover,  // Feature 7: hover pause
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
        {sortedSlides.map((slide, index) => (
          // Feature 2: per-slide autoplay delay via data-swiper-autoplay attribute
          <SwiperSlide
            key={slide.id}
            {...(slide.autoplay_delay ? { 'data-swiper-autoplay': slide.autoplay_delay } : {})}
          >
            <div className="relative w-full h-full">
              <SlideMedia
                slide={slide}
                isFirst={index === 0}
                lazyLoading={lazyLoading}
              />
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
