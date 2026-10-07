'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReportBookCover from './ReportBookCover';
import type { ReportProduct } from '@/lib/report/catalog';
import { getImageUrl } from '@/lib/utils';

type Slide = { kind: 'cover' } | { kind: 'image'; src: string } | { kind: 'placeholder'; label: string };

// 圖庫左右切換鈕：白色圓鈕，點擊範圍 44px
const arrowCls =
  'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-sm ' +
  'transition-shadow duration-150 ease-out hover:shadow-md active:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

/** 商品頁圖庫：第一張是書封，其餘是後台上傳的內頁圖；還沒上傳時以佔位框呈現 */
export default function ReportGallery({ product }: { product: ReportProduct }) {
  const pages: Slide[] = product.galleryImages?.length
    ? product.galleryImages.map((src) => ({ kind: 'image' as const, src }))
    : product.gallery.map((label) => ({ kind: 'placeholder' as const, label }));
  const slides: Slide[] = [{ kind: 'cover' }, ...pages];
  const [index, setIndex] = useState(0);
  const go = (d: number) => setIndex((i) => (i + d + slides.length) % slides.length);

  const render = (slide: Slide, size: 'sm' | 'lg') =>
    slide.kind === 'cover' ? (
      <div className={size === 'lg' ? 'mx-auto w-[70%]' : 'w-full'}>
        <ReportBookCover product={product} size={size === 'lg' ? 'md' : 'xs'} />
      </div>
    ) : slide.kind === 'image' ? (
      <div className={`relative aspect-square overflow-hidden rounded-sm2 bg-white shadow-sm ${size === 'lg' ? 'mx-auto w-[70%]' : 'w-full'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getImageUrl(slide.src, size === 'lg' ? 'medium' : 'small')}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    ) : (
      <div className={`flex aspect-square items-center justify-center rounded-sm2 border-[1.5px] border-dashed border-line-strong bg-white text-center text-muted ${
        size === 'lg' ? 'mx-auto w-[70%] text-sm' : 'w-full overflow-hidden px-0.5 text-[10px] leading-tight'
      }`}>
        {slide.label}
      </div>
    );

  return (
    <div>
      <div className="relative flex aspect-square items-center rounded-card bg-tint">
        <div className="w-full">{render(slides[index], 'lg')}</div>
        <button type="button" onClick={() => go(-1)} aria-label="上一張"
                className={`left-3 ${arrowCls}`}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="下一張"
                className={`right-3 ${arrowCls}`}>
          <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
        <p className="absolute bottom-3 right-4 font-latin text-caption text-muted">{index + 1} / {slides.length}</p>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {slides.map((s, i) => (
          <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`第 ${i + 1} 張`}
                  aria-current={i === index}
                  className={`rounded-sm2 p-1.5 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:brightness-95 ${i === index ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-tint hover:bg-line'}`}>
            {render(s, 'sm')}
          </button>
        ))}
      </div>
    </div>
  );
}
