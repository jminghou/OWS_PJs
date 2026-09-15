'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 後台首頁 = Studio 的「今天」（舊儀表板仍在「平台後台」群組）
    router.replace('/admin/studio/today');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">正在載入後台...</p>
      </div>
    </div>
  );
}
