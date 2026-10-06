import { getNewsletterContent } from '@/i18n/newsletterContent';
import SubscribeBlock from './SubscribeBlock';

/**
 * 「電子報」頁主體（導覽列入口）；預設語系與 [locale] 路由共用。
 * 版面依 docs/BRAND_GUIDELINES.md §7.3：Hero 變體，左 h1＋說明、右電子報卡（§6.5，pink-50 淡底）。
 */
export default function NewsletterLanding({ locale }: { locale: string }) {
  const { page } = getNewsletterContent(locale);
  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <section className="mx-auto grid max-w-content items-center gap-8 px-4 py-16 md:grid-cols-2 md:gap-12 md:px-6 md:py-24">
        <div className="min-w-0">
          <h1 className="font-heading text-[32px] font-normal leading-[1.3] text-ink [text-wrap:pretty] md:text-h1">{page.title}</h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-[1.8] text-text [text-wrap:pretty] md:text-lead">{page.intro}</p>
        </div>
        <div className="min-w-0 rounded-card bg-pink-50 p-7">
          <SubscribeBlock locale={locale} source="newsletter-page" />
        </div>
      </section>
    </div>
  );
}
