import type { HeroIntroFields } from '@/types';
import { getImageUrl } from '@/lib/utils';

interface TextHeroProps {
  intro: HeroIntroFields & { image_url?: string };
}

/** 第一屏的文字：用幾句話講清楚「我們是誰、幫誰、解決什麼」。行動（排盤）緊接在下方。 */
export default function TextHero({ intro }: TextHeroProps) {
  const paragraphs = (intro.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section id="hero" className="grid scroll-mt-14 items-start gap-8 text-left lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
      <div className="min-w-0 max-w-[680px]">
        {intro.eyebrow && (
          <p className="mb-4 text-sm font-medium tracking-widest text-brand-purple-700">{intro.eyebrow}</p>
        )}
        <h1 className="text-[28px] font-bold leading-snug tracking-tight text-gray-900 md:text-[32px]">
          {intro.headline}
        </h1>
        <div className="mt-6 space-y-4 text-[15px] leading-7 text-gray-700 md:text-base md:leading-7">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
        {intro.proof_line && <p className="mt-8 text-sm text-gray-500">{intro.proof_line}</p>}
      </div>
      <div className={intro.image_url ? 'lg:pt-10' : 'hidden lg:block'} aria-hidden="true">
        {intro.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(intro.image_url, 'medium')}
            alt=""
            width={480}
            height={480}
            className="h-auto w-full max-w-[480px] rounded-banner object-contain"
          />
        )}
      </div>
    </section>
  );
}
