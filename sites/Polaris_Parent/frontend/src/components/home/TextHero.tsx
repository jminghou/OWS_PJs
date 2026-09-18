import type { HeroIntroFields } from '@/types';
import { getImageUrl } from '@/lib/utils';
import SubscribeBlock from './SubscribeBlock';

interface TextHeroProps {
  locale: string;
  intro: HeroIntroFields & { image_url?: string };
}

/** 第一屏：用文字講清楚「我們是誰、幫誰、解決什麼」，唯一的行動是訂閱。 */
export default function TextHero({ locale, intro }: TextHeroProps) {
  const paragraphs = (intro.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section id="hero" className="scroll-mt-14">
      {intro.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getImageUrl(intro.image_url, 'medium')}
          alt=""
          width={96}
          height={96}
          className="mb-8 h-24 w-24 rounded-full object-cover"
        />
      )}
      {intro.eyebrow && (
        <p className="mb-4 text-sm font-medium tracking-widest text-brand-purple-700">{intro.eyebrow}</p>
      )}
      <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl md:leading-tight">
        {intro.headline}
      </h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-gray-700 md:text-xl md:leading-relaxed">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">{paragraph}</p>
        ))}
      </div>

      <div id="subscribe" className="mt-10 scroll-mt-20">
        {intro.newsletter_note && <p className="mb-4 text-base text-gray-700">{intro.newsletter_note}</p>}
        <SubscribeBlock locale={locale} source="home-hero" />
      </div>

      {intro.proof_line && <p className="mt-8 text-sm text-gray-500">{intro.proof_line}</p>}
    </section>
  );
}
