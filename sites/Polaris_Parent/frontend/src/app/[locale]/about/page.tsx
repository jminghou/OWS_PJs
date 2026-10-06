import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { JsonLd } from '@ows/site-kit';
import { AuthorsSection as AuthorsSection } from '@ows/site-kit';
import { buildAboutPageJsonLd, buildStaticPageAlternates } from '@ows/site-kit';
import { authorApi } from '@/lib/api';
import type { Author } from '@/types';
import { brandButton } from '@/components/ui/BrandButton';

// 從 i18n 訊息檔案載入翻譯
import zhTW from '@/i18n/messages/zh-TW.json';
import zhCN from '@/i18n/messages/zh-CN.json';
import en from '@/i18n/messages/en.json';
import ja from '@/i18n/messages/ja.json';

// 多語言訊息對應
const messages: Record<string, typeof zhTW> = {
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  'en': en,
  'ja': ja,
};

// 版面（docs/BRAND_GUIDELINES.md §5）：白卡片放在暖白底上、無邊框；區塊標題 h2 字級
const CONTAINER = 'mx-auto max-w-4xl px-4 md:px-6';
const CARD = 'rounded-card bg-white p-6 md:p-8';
const H2 = 'mb-6 font-heading text-[26px] font-normal leading-[1.35] text-ink [text-wrap:pretty] md:text-h2';

// ISR：關於頁很少變動，但作者資料需偶爾刷新
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

async function getAuthors(): Promise<Author[]> {
  try {
    const { authors } = await authorApi.getList();
    return authors;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale]?.aboutPage || messages['zh-TW'].aboutPage;
  return {
    title: t.title,
    description: t.description,
    alternates: buildStaticPageAlternates('/about', locale),
  };
}

export default async function LocaleAboutPage({ params }: PageProps) {
  const { locale } = await params;
  const t = messages[locale]?.aboutPage || messages['zh-TW'].aboutPage;
  const basePath = locale === 'zh-TW' ? '' : `/${locale}`;
  const authors = await getAuthors();

  return (
    <div className="bg-paper">
      <JsonLd data={buildAboutPageJsonLd({ title: t.title, description: t.description, locale })} />
      <div className={`${CONTAINER} py-16 md:py-24`}>
        {/* 個人故事區塊：h1 ＋ lead（docs/BRAND_GUIDELINES.md §7.3） */}
        <section className="mb-16">
          <h1 className="mb-8 text-center font-heading text-[32px] font-normal leading-[1.3] text-ink [text-wrap:pretty] md:text-h1">
            {t.aboutMe}
          </h1>
          <div className={CARD}>
            <p className="text-[17px] leading-[1.8] text-text [text-wrap:pretty] md:text-lead">
              {t.story}
            </p>
          </div>
        </section>

        {/* 品牌故事區塊：引言用 blockquote 樣式（§4.3、§7.3） */}
        <section className="mb-16">
          <h2 className={H2}>
            {t.siteOriginTitle}
          </h2>
          <div className={CARD}>
            <blockquote className="mb-6 rounded-inner bg-blue-50 px-6 py-5 text-blue-800">
              <p className="mb-2 font-heading text-[18px] leading-[1.45] [text-wrap:pretty] md:text-h4">
                {t.quote}
              </p>
              <p className="text-right text-small">
                {t.quoteAuthor}
              </p>
            </blockquote>
            <p className="text-text [text-wrap:pretty]">
              {t.siteOrigin}
            </p>
          </div>
        </section>

        {/* 品牌理念區塊 */}
        <section className="mb-16">
          <h2 className={H2}>
            {t.missionTitle}
          </h2>
          <div className={CARD}>
            <p className="text-text [text-wrap:pretty]">
              {t.mission}
            </p>
          </div>
        </section>

        {/* 作者區塊（E-E-A-T） */}
        <AuthorsSection authors={authors} locale={locale} />
      </div>

      {/* 品牌使命區塊：交替底色 tint（§7.1） */}
      <section className="bg-tint py-16 md:py-24">
        <div className={`${CONTAINER} text-center`}>
          <h2 className={H2}>
            {t.exploreTitle}
          </h2>
          <p className="mx-auto mb-8 max-w-prose whitespace-pre-line text-text [text-wrap:pretty]">
            {t.exploreDescription}
          </p>
          <div className="flex justify-center">
            <Link href={`${basePath}/contact`} className={brandButton({ variant: 'primary', size: 'L' })}>
              {t.contactBtn}
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
