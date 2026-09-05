'use client';

import ZiweiChartForm from '@/components/domain/ziwei/ZiweiChartForm';

/**
 * 首頁的「線上排盤」區塊（服務與產品 ↔ footer 之間）。
 *
 * P1 之前這段直接寫在 HomePageContent 裡，等於平台元件內建了紫微領域知識。
 * 現在由頁面把它當成 domainSection 傳進去，HomePageContent 就能乾淨地
 * 抽進 packages/site-kit 供第三個站台共用。
 */
export default function ZiweiHomeSection() {
  return (
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
            輸入出生時辰，立即排出可互動的十二宮命盤
          </p>
        </div>
        <ZiweiChartForm />
      </div>
    </section>
  );
}
