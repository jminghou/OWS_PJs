import type { HeroIntroFields } from '@/types';
import { getImageUrl } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import { LogoMark } from '@/components/ui/BrandLogo';

interface TextHeroProps {
  intro: HeroIntroFields & { image_url?: string };
}

/**
 * 第一屏的文字：用幾句話講清楚「我們是誰、幫誰、解決什麼」。行動（排盤）緊接在下方。
 * 版面依 docs/BRAND_GUIDELINES.md §7.2：≥ md 兩欄、手機單欄圖在下；
 * 左欄 pink 狀態小標籤 → display 標題 → lead 段落；右欄圖片 rounded-[48px]、高 400px（手機 280px）。
 * 這裡刻意沒有按鈕組：首頁的第一個行動是下方的線上排盤（見 HomeLanding）。
 * 右欄一律保留：後台「首頁設定 → 首屏介紹」還沒放圖時顯示佔位面板，版面不會塌成單欄。
 */
export default function TextHero({ intro }: TextHeroProps) {
  const paragraphs = (intro.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section
      id="hero"
      className="grid scroll-mt-24 items-center gap-8 text-left md:grid-cols-2 md:gap-12"
    >
      <div className="min-w-0">
        {intro.eyebrow && (
          <Tag tone="status" className="mb-5">{intro.eyebrow}</Tag>
        )}
        <h1 className="font-heading text-[40px] font-normal leading-[1.25] text-ink [text-wrap:pretty] md:text-display">
          {intro.headline}
        </h1>
        <div className="mt-6 max-w-[460px] space-y-4 text-[17px] leading-[1.8] text-text md:text-lead">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line [text-wrap:pretty]">{paragraph}</p>
          ))}
        </div>
        {intro.proof_line && <p className="mt-8 text-caption text-muted">{intro.proof_line}</p>}
      </div>
      <div className="min-w-0" aria-hidden="true">
        {intro.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(intro.image_url, 'medium')}
            alt=""
            width={480}
            height={400}
            className="h-[280px] w-full rounded-[48px] object-cover md:h-[400px]"
          />
        ) : (
          <HeroImagePlaceholder />
        )}
      </div>
    </section>
  );
}

/** 首屏圖片的佔位面板：訪客看到的是安靜的品牌底；開發環境多一行提示告訴你去哪裡換圖。 */
function HeroImagePlaceholder() {
  return (
    <div className="flex h-[280px] w-full flex-col items-center justify-center gap-4 rounded-[48px] bg-blue-50 md:h-[400px]">
      <LogoMark width={160} alt="" />
      {process.env.NODE_ENV !== 'production' && (
        <p className="px-6 text-center text-caption text-blue-800">
          首屏圖片位置（建議 960×800，後台「首頁設定 → 首屏介紹」上傳）
        </p>
      )}
    </div>
  );
}
