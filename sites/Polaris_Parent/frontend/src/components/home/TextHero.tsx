import type { HeroIntroFields } from '@/types';
import { getImageUrl } from '@/lib/utils';

interface TextHeroProps {
  intro: HeroIntroFields & { image_url?: string };
}

/** 第一屏的文字：用幾句話講清楚「我們是誰、幫誰、解決什麼」。行動（排盤）緊接在下方。 */
export default function TextHero({ intro }: TextHeroProps) {
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
      {intro.proof_line && <p className="mt-8 text-sm text-gray-500">{intro.proof_line}</p>}
    </section>
  );
}
