import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import JsonLd from '@/components/seo/JsonLd';
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
      <main className="min-h-screen pt-16">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}