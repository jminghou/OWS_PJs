import { redirect } from 'next/navigation';

/** 舊網址：單頁表單已改為 /report/create 填寫精靈，保留 ?variant= 預選版本 */
export default async function ReportCustomizePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  redirect(variant === 'digital' || variant === 'physical' ? `/report/create?variant=${variant}` : '/report/create');
}
