import PublicHeader from '@/components/platform/public/PublicHeader';
import PublicFooter from '@/components/platform/public/PublicFooter';
import { JsonLd } from '@ows/site-kit';
import { organizationJsonLd, websiteJsonLd } from '@ows/site-kit';

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
      <main className="hw-public-main min-h-screen">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}