import { getNewsletterContent } from '@/i18n/newsletterContent';
import SubscribeBlock from './SubscribeBlock';

/** 「電子報」頁主體（導覽列入口）；預設語系與 [locale] 路由共用。 */
export default function NewsletterLanding({ locale }: { locale: string }) {
  const { page } = getNewsletterContent(locale);
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-warm-50">
      <div className="mx-auto max-w-[680px] px-5 py-16 md:py-24">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl">{page.title}</h1>
        <p className="mb-8 mt-6 text-lg leading-relaxed text-gray-700 md:text-xl">{page.intro}</p>
        <SubscribeBlock locale={locale} source="newsletter-page" />
      </div>
    </div>
  );
}
