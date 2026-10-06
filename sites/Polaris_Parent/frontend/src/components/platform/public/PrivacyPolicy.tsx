import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { brandButton } from '@/components/ui/BrandButton';
import { getPrivacyContent, PRIVACY_UPDATED_ISO } from '@/i18n/privacyContent';
import { localePath } from '@/i18n/newsletterContent';

/** 隱私權政策頁主體；預設語系與 [locale] 路由共用。內文寬度 max-w-prose（docs/BRAND_GUIDELINES.md §4.2）。 */
export default function PrivacyPolicy({ locale }: { locale: string }) {
  const content = getPrivacyContent(locale);
  return (
    <div className="bg-paper">
      <article className="mx-auto max-w-prose px-4 py-16 md:px-6 md:py-24">
        <h1 className="font-heading text-[32px] font-normal leading-[1.3] text-ink [text-wrap:pretty] md:text-h1">
          {content.title}
        </h1>
        <p className="mt-3 text-caption text-muted">
          <time dateTime={PRIVACY_UPDATED_ISO}>{content.updated}</time>
        </p>
        <p className="mt-8 text-[17px] leading-[1.8] text-text [text-wrap:pretty] md:text-lead">{content.intro}</p>

        {content.sections.map((section) => (
          <section key={section.heading} className="mt-12">
            <h2 className="font-heading text-[22px] font-normal leading-[1.4] text-ink [text-wrap:pretty] md:text-h3">
              {section.heading}
            </h2>
            <div className="mt-6 space-y-4 text-text">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="[text-wrap:pretty]">{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-12">
          <Link href={localePath(locale, '/contact')} className={brandButton({ variant: 'link' })}>
            {content.contactLinkText}
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        </p>
      </article>
    </div>
  );
}
