import { Metadata } from 'next';
import { Suspense } from 'react';
import ColumnPage from './column/ColumnPage';
import { ColumnPageSkeleton } from './column/ColumnGrid';
import { getColumnProfile } from '@/lib/columnProfile';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '親紫專欄 - 親紫之間',
  description: '專業的親子教養文章，發掘孩子天賦，理解星性特質',
};

export default async function ArticlesPage() {
  const profile = await getColumnProfile('zh-TW');
  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <Suspense fallback={<ColumnPageSkeleton />}>
        <ColumnPage profile={profile} locale="zh-TW" />
      </Suspense>
    </div>
  );
}
