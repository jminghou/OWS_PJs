'use client';

/**
 * 會員中心「我的家」的新會員引導：還沒有報告也沒有命盤時顯示。
 * 說明一份報告怎麼來（三步驟）、給一個免費入口（線上排盤），以及外部平台買過的認領入口。
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { brandButton } from '@/components/ui/BrandButton';
import ReportBookCover from '@/components/report/ReportBookCover';
import { REPORT_PRODUCT } from '@/lib/report/catalog';
import { REPORT_LEAD_DAYS } from './orderModel';

const STEPS = [
  { title: '填寫孩子的生辰', body: '約 3 分鐘，填好出生日期與時間，先看看他的命盤。' },
  { title: '老師撰寫', body: `付款後約 ${REPORT_LEAD_DAYS} 個工作天，逐章寫成一份只屬於他的報告。` },
  { title: '收到專屬報告', body: '完成會寄信通知你，回到這裡就能打開來讀，也能印成精裝書。' },
];

export default function Welcome() {
  return (
    <section className="rounded-card bg-white p-6 md:p-10">
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
        <div className="w-40 shrink-0 md:w-48">
          <ReportBookCover product={REPORT_PRODUCT} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[22px] font-normal text-ink md:text-h3">歡迎來到親紫之間</h2>
          <p className="mt-2 text-text [text-wrap:pretty]">
            這裡會放著你和家人的命盤、報告與書。從一份報告開始，重新認識你的孩子。
          </p>
          <ol className="mt-6 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 font-latin text-sm font-medium text-blue-700">{i + 1}</span>
                <div>
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 text-sm text-text">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/report" className={brandButton({ variant: 'primary', size: 'M' })}>看客製報告</Link>
            <Link href="/ziwei" className={brandButton({ variant: 'soft', size: 'M' })}>先免費看孩子的命盤</Link>
          </div>
          <p className="mt-6 text-sm text-text">
            在小紅書、Etsy、Pinkoi 向我們訂過報告？
            <Link href="/account/claim" className="ml-1 inline-flex items-center gap-0.5 text-blue-700 underline-offset-2 hover:underline">
              用認領碼接到這個帳號<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
