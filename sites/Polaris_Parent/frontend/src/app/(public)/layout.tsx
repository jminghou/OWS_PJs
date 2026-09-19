import PublicHeader from '@/components/platform/public/PublicHeader';
import PublicFooter from '@/components/platform/public/PublicFooter';
// 子路徑匯入：從 barrel 匯入會連帶把 HeroCarousel（與 Swiper 的 CSS）拉進每一頁
import JsonLd from '@ows/site-kit/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@ows/site-kit/seo';

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