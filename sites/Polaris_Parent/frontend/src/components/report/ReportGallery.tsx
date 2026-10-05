'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReportBookCover from './ReportBookCover';
import type { ReportProduct } from '@/lib/report/catalog';

/** 商品頁圖庫：第一張是書封，其餘是內頁示意（尚無圖片時以佔位框呈現） */
export default function ReportGallery({ product }: { product: ReportProduct }) {
  const slides = ['cover', ...product.gallery];
  const [index, setIndex] = useState(0);
  const go = (d: number) => setIndex((i) => (i + d + slides.length) % slides.length);

  const render = (slide: string, size: 'sm' | 'lg') =>
    slide === 'cover' ? (
      <div className={size === 'lg' ? 'mx-auto w-3/5' : 'w-full'}>
        <ReportBookCover product={product} size={size === 'lg' ? 'md' : 'xs'} />
      </div>
    ) : (
      <div className={`flex aspect-[3/4] items-center justify-center rounded-md border border-dashed border-warm-300 bg-white text-center text-gray-400 ${
        size === 'lg' ? 'mx-auto w-3/5 text-sm' : 'w-full text-[10px] leading-tight'
      }`}>
        {slide}
      </div>
    );

  return (
    <div>
      <div className="relative flex aspect-square items-center rounded-banner bg-warm-100">
        <div className="w-full">{render(slides[index], 'lg')}</div>
        <button type="button" onClick={() => go(-1)} aria-label="上一張"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="下一張"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white">
          <ChevronRight className="h-5 w-5" />
        </button>
        <p className="absolute bottom-3 right-4 text-xs text-gray-500">{index + 1} / {slides.length}</p>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {slides.map((s, i) => (
          <button key={s} type="button" onClick={() => setIndex(i)} aria-label={`第 ${i + 1} 張`}
                  aria-current={i === index}
                  className={`rounded-md p-1.5 transition-colors ${i === index ? 'bg-brand-purple-100 ring-2 ring-brand-purple-500' : 'bg-warm-100 hover:bg-warm-200'}`}>
            {render(s, 'sm')}
          </button>
        ))}
      </div>
    </div>
  );
}
