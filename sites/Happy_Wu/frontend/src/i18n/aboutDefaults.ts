import type { HomepageSettings } from '@/types';
import { localeContent } from '@/i18n/homePageData';

type About = NonNullable<HomepageSettings['about_section']>[string];

/** The same initial content is shown in both the editor and the public template. */
export const aboutDefaults: Record<string, About> = Object.fromEntries(
  Object.entries(localeContent).map(([locale, content]) => {
    const zh = locale === 'zh-TW' || locale === 'zh-CN';
    return [locale, {
      eyebrow: 'THE PERSON BEHIND THE WORDS',
      title: zh ? '嗨，我是 Happy Wu。' : content.aboutTitle,
      philosophy: zh ? '這裡是「職場媽媽崩潰啥？」。聊聊工作與育兒，也留下一些生活裡的小小觀察。' : content.aboutPhilosophy,
      description: zh ? '不急著給每個問題一個標準答案。只想把真實的日子寫下來，讓忙碌中的我們，找到一點共鳴與喘息。' : content.bannerDescription,
      quote: zh ? '今天已經很努力了，\n偶爾崩潰一下，也沒關係。' : content.aboutQuote,
      mission_points: [],
      image_url: '',
      image_caption: 'Take a breath.\nMake some room\nfor yourself.',
      button_text: zh ? '多認識我一點' : content.learnMoreBtn,
      button_url: `${locale === 'zh-TW' ? '' : `/${locale}`}/about`,
    }];
  })
);

export function resolveAbout(settings: HomepageSettings, locale: string): About {
  return { ...(aboutDefaults[locale] || aboutDefaults['zh-TW']), ...settings.about_section?.[locale] };
}

export function safeAboutLink(url?: string): string {
  const value = url?.trim() || '';
  return /^(\/(?!\/)|#|https?:\/\/)/i.test(value) ? value : '';
}
