import Link from 'next/link';
import { getPrivacyContent, PRIVACY_UPDATED_ISO } from '@/i18n/privacyContent';
import { localePath } from '@/i18n/newsletterContent';

/** 隱私權政策頁主體；預設語系與 [locale] 路由共用。 */
export default function PrivacyPolicy({ locale }: { locale: string }) {
  const content = getPrivacyContent(locale);
  return (
    <article className="mx-auto max-w-[680px] px-5 py-16 md:py-24">
      <h1 className="text-4xl font-bold leading-tight text-gray-900">{content.title}</h1>
      <p className="mt-3 text-sm text-gray-500">
        <time dateTime={PRIVACY_UPDATED_ISO}>{content.updated}</time>
      </p>
      <p className="mt-8 text-lg leading-relaxed text-gray-700">{content.intro}</p>

      {content.sections.map((section) => (
        <section key={section.heading} className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">{section.heading}</h2>
          <div className="mt-4 space-y-4 text-lg leading-relaxed text-gray-700">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-8">
        <Link href={localePath(locale, '/contact')} className="font-medium text-brand-purple-700 underline-offset-4 hover:underline">
          {content.contactLinkText} →
        </Link>
      </p>
    </article>
  );
}
