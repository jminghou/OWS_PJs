import { Metadata } from 'next';
import { Suspense } from 'react';
import ColumnPage from '@/app/(public)/articles/column/ColumnPage';
import { ColumnPageSkeleton } from '@/app/(public)/articles/column/ColumnGrid';
import { getColumnProfile } from '@/lib/columnProfile';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '親紫之間 - 親紫專欄',
  description: '瀏覽親紫專欄文章，理解孩子的獨特之處',
};

export default async function PostsPage() {
  const profile = await getColumnProfile('zh-TW');
  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <Suspense fallback={<ColumnPageSkeleton />}>
        <ColumnPage profile={profile} locale="zh-TW" />
      </Suspense>
    </div>
  );
}
