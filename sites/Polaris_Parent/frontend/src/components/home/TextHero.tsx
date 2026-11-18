import type { HeroIntroFields } from '@/types';
import type { ReactNode } from 'react';
import { getImageUrl } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import { LogoMark } from '@/components/ui/BrandLogo';

interface TextHeroProps {
  intro: HeroIntroFields & { image_url?: string };
  children?: ReactNode;
}

/**
 * 文案與圖片並列，生辰表單接在下方並橫跨內容寬度。
 * 手機隱藏裝飾圖，命盤結果由 children 橫跨完整網格寬度。
 */
export default function TextHero({ intro, children }: TextHeroProps) {
  const paragraphs = (intro.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section
      id="hero"
      className="grid scroll-mt-24 items-start gap-x-16 gap-y-8 text-left lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
    >
      <div className="min-w-0">
        {intro.eyebrow && (
          <Tag tone="status" className="mb-6">{intro.eyebrow}</Tag>
        )}
        <h1 style={{ textWrap: 'balance' }} className="font-heading text-[32px] font-normal leading-[1.3] text-ink md:text-h1">
          {intro.headline === '從紫微斗數開始，找到理解他的方式' ? <>從紫微斗數開始，<br />找到理解他的方式</> : intro.headline}
        </h1>
        <div className="mt-6 max-w-prose space-y-4 text-base leading-[1.85] text-text md:text-[17px]">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line [text-wrap:pretty]">{paragraph
              .replace('？面對事情時', '？\n面對事情時')
              .replace('為線索，陪你', '為線索，\n陪你')
              .replace('特質，帶著', '特質，\n帶著')}</p>
          ))}
        </div>
        {intro.proof_line && <p className="mt-8 text-caption text-muted">{intro.proof_line}</p>}
      </div>
      <div className="hidden min-w-0 self-center lg:col-start-2 lg:row-start-1 lg:block" aria-hidden="true">
        {intro.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(intro.image_url, 'medium')}
            alt=""
            width={480}
            height={400}
            className="h-[320px] w-full rounded-card object-cover"
          />
        ) : (
          <HeroImagePlaceholder />
        )}
      </div>
      {children}
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
