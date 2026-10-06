import type { Metadata } from 'next';
import { ZiweiChartForm as ZiweiChartForm } from '@ows/ziwei-app';

export const metadata: Metadata = {
  title: '紫微斗數 線上排盤',
  description: '輸入出生時辰，立即排出可互動的十二宮命盤。',
  alternates: { canonical: '/ziwei' },
};

export default function ZiweiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <div className="text-center mb-10">
        <h1 className="mb-4 font-heading text-[32px] font-normal text-ink [text-wrap:pretty] md:text-h1">
          紫微斗數 <span className="text-blue-500">線上排盤</span>
        </h1>
        <p className="mx-auto max-w-2xl text-[17px] text-text [text-wrap:pretty] md:text-lead">
          輸入出生時辰，立即排出可互動的十二宮命盤
        </p>
      </div>

      <ZiweiChartForm />
    </div>
  );
}
