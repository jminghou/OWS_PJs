import Link from 'next/link';
import type { Content, HomepageSettings } from '@/types';
import { getHomeLandingContent, resolveHeroIntro } from '@/i18n/homeLandingContent';
import { localePath } from '@/i18n/newsletterContent';
import ArticleTextList from './ArticleTextList';
import SubscribeBlock from './SubscribeBlock';
import TextHero from './TextHero';

interface HomeLandingProps {
  locale: string;
  homepageSettings: HomepageSettings;
  articles: Content[];
}

/**
 * 文字型首頁：單欄、大留白、全頁只有一個主要行動（訂閱電子報）。
 * 順序：文字 Hero＋訂閱 → 精選文章清單 → 線上排盤入口 → 結尾再一次訂閱。
 */
export default function HomeLanding({ locale, homepageSettings, articles }: HomeLandingProps) {
  const content = getHomeLandingContent(locale);
  const intro = resolveHeroIntro(locale, homepageSettings.hero_intro);

  return (
    <div className="bg-warm-50">
      <div className="mx-auto max-w-[680px] space-y-16 px-5 py-16 md:space-y-24 md:py-24">
        <TextHero locale={locale} intro={intro} />

        <hr className="border-warm-200" />

        <ArticleTextList
          locale={locale}
          articles={articles}
          heading={content.articlesHeading}
          viewAllText={content.articlesViewAll}
          emptyText={content.articlesEmpty}
        />

        <hr className="border-warm-200" />

        <section id="ziwei" aria-labelledby="home-ziwei-heading" className="scroll-mt-20">
          <h2 id="home-ziwei-heading" className="text-2xl font-bold text-gray-900">{content.ziweiHeading}</h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-700">{content.ziweiBody}</p>
          <p className="mt-6">
            <Link
              href={localePath(locale, '/ziwei')}
              className="inline-flex rounded-banner border border-brand-purple-700 px-6 py-3 text-base font-medium text-brand-purple-700 transition-colors hover:bg-brand-purple-50"
            >
              {content.ziweiButton}
            </Link>
          </p>
        </section>

        <hr className="border-warm-200" />

        <section aria-labelledby="home-closing-heading">
          <h2 id="home-closing-heading" className="text-2xl font-bold text-gray-900">{content.closingHeading}</h2>
          <p className="mb-6 mt-4 text-lg leading-relaxed text-gray-700">{content.closingBody}</p>
          <SubscribeBlock locale={locale} source="home-footer" />
        </section>
      </div>
    </div>
  );
}
