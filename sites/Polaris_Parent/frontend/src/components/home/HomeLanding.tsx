import ZiweiQuickChart from '@ows/ziwei-app/components/ZiweiQuickChart';
import type { HomepageSettings } from '@/types';
import { resolveHeroIntro } from '@/i18n/homeLandingContent';
import SubscribeBlock from './SubscribeBlock';
import TestimonialWall from './TestimonialWall';
import TextHero from './TextHero';

interface HomeLandingProps {
  locale: string;
  homepageSettings: HomepageSettings;
}

// 內容最大寬度 1200px，左右留白 16px（手機）/ 24px（docs/BRAND_GUIDELINES.md §5.4）
const CONTAINER = 'mx-auto w-full max-w-content px-4 md:px-6';
// 區塊上下間距 64px（手機）/ 96px（§5.2）
const SECTION_Y = 'py-16 md:py-24';
// 文字區塊置中；命盤與回饋牆使用較寬版面。
const TEXT_COLUMN = 'mx-auto w-full max-w-[680px]';
const SECTION_HEADING = 'font-heading text-[26px] font-normal leading-[1.35] text-ink [text-wrap:pretty] md:text-h2';

/**
 * 文字型首頁。第一個行動是線上排盤（直接在首頁滾輪選生日、命盤出現在下方），不是導流按鈕。
 * 順序：文字 Hero → 滾輪排盤＋命盤結果 → 使用者回饋牆（Senja）→ 訂閱電子報（全頁只出現一次）。
 * 區塊底色依 §7.1 交替：Hero（paper）→ 排盤（tint，命盤是白卡）→ 回饋牆（surface）→ 電子報（paper＋pink-50 電子報卡）。
 */
export default function HomeLanding({ locale, homepageSettings }: HomeLandingProps) {
  // 首屏與各區塊標題都可在後台「首頁設定」覆寫，留空退回站台預設
  const intro = resolveHeroIntro(locale, homepageSettings.hero_intro);
  const senjaWidgetId = process.env.NEXT_PUBLIC_SENJA_WIDGET_ID;
  // 沒設定 widget 時正式環境不留空區塊；開發環境顯示預留位置方便看版面
  const showWall = Boolean(senjaWidgetId) || process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper text-left">
      <div className={`${CONTAINER} ${SECTION_Y}`}>
        <TextHero intro={intro} />
      </div>

      <section id="ziwei" aria-labelledby="home-ziwei-heading" className={`scroll-mt-24 bg-tint ${SECTION_Y}`}>
        <div className={CONTAINER}>
          <div className={TEXT_COLUMN}>
            <h2 id="home-ziwei-heading" className={SECTION_HEADING}>{intro.ziwei_heading}</h2>
            <p className="mb-8 mt-4 text-text [text-wrap:pretty]">{intro.ziwei_body}</p>
          </div>
          <ZiweiQuickChart />
        </div>
      </section>

      {showWall && (
        <div className={`bg-white ${SECTION_Y}`}>
          <div className={CONTAINER}>
            <div className="mx-auto max-w-5xl">
              <TestimonialWall widgetId={senjaWidgetId} heading={intro.testimonials_heading || ''} />
            </div>
          </div>
        </div>
      )}

      <section id="subscribe" aria-labelledby="home-subscribe-heading" className={`scroll-mt-24 bg-paper ${SECTION_Y}`}>
        <div className={CONTAINER}>
          {/* 電子報卡（§6.5）：pink-50 淡底、標題 heading 24px、膠囊輸入框＋accent 按鈕 */}
          <div className={`${TEXT_COLUMN} rounded-card bg-pink-50 p-7`}>
            <h2 id="home-subscribe-heading" className="font-heading text-[24px] font-normal leading-[1.4] text-ink [text-wrap:pretty]">
              {intro.subscribe_heading}
            </h2>
            {intro.newsletter_note && <p className="mt-3 text-text [text-wrap:pretty]">{intro.newsletter_note}</p>}
            <div className="mt-6">
              <SubscribeBlock locale={locale} source="home" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
