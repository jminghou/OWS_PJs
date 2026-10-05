import type { Metadata } from 'next';
import { ZiweiChartForm as ZiweiChartForm } from '@ows/ziwei-app';

export const metadata: Metadata = {
  title: '紫微斗數 線上排盤',
  description: '輸入出生時辰，立即排出可互動的十二宮命盤。',
  alternates: { canonical: '/ziwei' },
};

export default function ZiweiPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">紫微斗數 線上排盤</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          輸入出生時辰，立即排出可互動的十二宮命盤
        </p>
      </div>

      <ZiweiChartForm />
    </div>
  );
}
