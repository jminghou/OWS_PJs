import ZiweiQuickChart from '@ows/ziwei-app/components/ZiweiQuickChart';
import type { HomepageSettings } from '@/types';
import { getHomeLandingContent, resolveHeroIntro } from '@/i18n/homeLandingContent';
import SubscribeBlock from './SubscribeBlock';
import TestimonialWall from './TestimonialWall';
import TextHero from './TextHero';

interface HomeLandingProps {
  locale: string;
  homepageSettings: HomepageSettings;
}

// 文字欄寬；命盤與回饋牆需要更寬的版面，各自設定
const TEXT_COLUMN = 'mx-auto max-w-[680px]';

/**
 * 文字型首頁。第一個行動是線上排盤（直接在首頁滾輪選生日、命盤出現在下方），不是導流按鈕。
 * 順序：文字 Hero → 滾輪排盤＋命盤結果 → 使用者回饋牆（Senja）→ 訂閱電子報（全頁只出現一次）。
 */
export default function HomeLanding({ locale, homepageSettings }: HomeLandingProps) {
  const content = getHomeLandingContent(locale);
  const intro = resolveHeroIntro(locale, homepageSettings.hero_intro);
  const senjaWidgetId = process.env.NEXT_PUBLIC_SENJA_WIDGET_ID;
  // 沒設定 widget 時正式環境不留空區塊；開發環境顯示預留位置方便看版面
  const showWall = Boolean(senjaWidgetId) || process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-warm-50">
      <div className="space-y-16 px-5 py-16 md:space-y-24 md:py-24">
        <div className={TEXT_COLUMN}>
          <TextHero intro={intro} />
        </div>

        <section id="ziwei" aria-labelledby="home-ziwei-heading" className="scroll-mt-20 !mt-12 md:!mt-16">
          <div className={TEXT_COLUMN}>
            <h2 id="home-ziwei-heading" className="text-2xl font-bold text-gray-900">{content.ziweiHeading}</h2>
            <p className="mb-6 mt-3 text-lg leading-relaxed text-gray-700">{content.ziweiBody}</p>
          </div>
          <ZiweiQuickChart />
        </section>

        {showWall && (
          <div className="mx-auto max-w-5xl">
            <TestimonialWall widgetId={senjaWidgetId} heading={content.testimonialsHeading} />
          </div>
        )}

        <section id="subscribe" aria-labelledby="home-subscribe-heading" className={`${TEXT_COLUMN} scroll-mt-20`}>
          <hr className="mb-16 border-warm-200 md:mb-24" />
          <h2 id="home-subscribe-heading" className="text-2xl font-bold text-gray-900">{content.subscribeHeading}</h2>
          {intro.newsletter_note && <p className="mb-6 mt-3 text-lg leading-relaxed text-gray-700">{intro.newsletter_note}</p>}
          <SubscribeBlock locale={locale} source="home" />
        </section>
      </div>
    </div>
  );
}
