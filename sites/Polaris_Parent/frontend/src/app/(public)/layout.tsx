import PublicHeader from '@/components/platform/public/PublicHeader';
import PublicFooter from '@/components/platform/public/PublicFooter';
import JsonLd from '@/components/platform/seo/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 全站實體資料：讓 AI 把所有內容歸屬到一個可信的組織/網站 */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <PublicHeader />
      <main className="min-h-screen pt-14">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}