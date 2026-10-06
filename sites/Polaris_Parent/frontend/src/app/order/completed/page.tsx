'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import BrandButton from '@/components/ui/BrandButton';

export default function OrderCompletedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

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
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-success-bg p-4">
            <CheckCircle2 className="h-16 w-16 text-success" strokeWidth={2} aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-2 font-heading text-[26px] font-normal text-ink md:text-h2">
          付款成功！
        </h1>

        {/* Message */}
        <p className="mb-6 text-text">
          感謝您的購買，您的訂單已成功建立並完成付款。
        </p>

        {/* Details */}
        <div className="mb-6 rounded-inner bg-tint p-4">
          <p className="mb-2 text-sm text-text">
            我們已收到您的付款，相關服務資訊將透過電子郵件發送給您。
          </p>
          <p className="text-sm text-text">
            如有任何問題，請隨時聯繫我們的客服團隊。
          </p>
        </div>

        {/* Auto redirect notice */}
        <p className="mb-6 text-caption text-muted">
          <span className="font-latin">{countdown}</span> 秒後自動返回產品頁面...
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <BrandButton variant="primary" onClick={() => router.push('/report')} className="w-full">
            返回產品頁面
          </BrandButton>
          <BrandButton variant="soft" onClick={() => router.push('/admin/dashboard')} className="w-full">
            前往會員中心
          </BrandButton>
        </div>
      </div>
    </div>
  );
}
