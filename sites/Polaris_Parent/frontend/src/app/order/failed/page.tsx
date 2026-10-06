'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';

export default function OrderFailedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // 倒數計時後自動導向產品頁面
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/report');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    // 本頁不在公開站 layout 內：自己掛 public-site，套用暖白底、字體與品牌色
    <div className="public-site flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card bg-white p-6 text-center md:p-8">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-error-bg p-4">
            <XCircle className="h-16 w-16 text-error" strokeWidth={2} aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-2 font-heading text-[26px] font-normal text-ink md:text-h2">
          付款失敗
        </h1>

        {/* Message */}
        <p className="mb-6 text-text">
          很抱歉，您的付款未能完成。
        </p>

        {/* Details */}
        <div className="mb-6 rounded-inner bg-tint p-4">
          <p className="mb-3 text-sm text-text">
            可能的原因：
          </p>
          <ul className="list-inside list-disc space-y-2 text-left text-sm text-text">
            <li>付款資訊有誤</li>
            <li>信用卡餘額不足</li>
            <li>銀行拒絕此筆交易</li>
            <li>網路連線中斷</li>
          </ul>
        </div>

        <Alert tone="info" className="mb-6 text-left">
          您的訂單尚未建立，不會產生任何費用。請重新選購並再次嘗試付款。
        </Alert>

        {/* Auto redirect notice */}
        <p className="mb-6 text-caption text-muted">
          <span className="font-latin">{countdown}</span> 秒後自動返回產品頁面...
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <BrandButton variant="primary" onClick={() => router.push('/report')} className="w-full">
            重新選購
          </BrandButton>
          <BrandButton variant="soft" onClick={() => router.push('/')} className="w-full">
            返回首頁
          </BrandButton>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-caption text-muted">
          如果問題持續發生，請聯繫客服：<span className="font-latin">support@example.com</span>
        </p>
      </div>
    </div>
  );
}
