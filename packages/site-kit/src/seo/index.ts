/**
 * 集中式 SEO / AEO 工具：所有結構化資料 (JSON-LD)、canonical、hreflang 都從這裡產生，
 * 確保 (public) 與 [locale] 兩套路由（以及未來任何頁面）使用「單一來源」、不再各寫各的。
 *
 * 多語言 URL 慣例：預設語言 (zh-TW) 不加前綴，其餘語言加 /{locale}。
 * 若日後要改成「所有語言都加前綴」，只需修改 localizedPath 一處。
 */
import type { Content, Product, Author } from '@ows/platform-api/types';
import { getSiteConfig, getImageUrl } from '../config';
import { parseContentBlocks, findSection } from '@ows/content-kit';
import { extractFaqFromMarkdown, extractHowToSteps } from '@ows/content-kit';

/**
 * 站台識別資料。
 *
 * 原本是硬編常數（SITE_NAME = '親紫之間'、ORG = {...}），那是 seo 模組
 * 無法離開 Polaris 的唯一原因。改成從 configureSiteKit 注入的設定讀取。
 *
 * 刻意用**函式**而非 const 匯出：設定是在站台 layout 載入時才注入的，
 * 若用 const，模組載入當下就會凍結成預設值（localhost / 'Site'），
 * 而且錯得很安靜 —— JSON-LD 照樣產生，只是網址全錯。
 */
export function siteUrl(): string {
  return getSiteConfig().siteUrl;
}

export function siteName(): string {
  return getSiteConfig().siteName;
}

export function defaultLocale(): string {
  return getSiteConfig().defaultLocale;
}

export function supportedLocales(): readonly string[] {
  return getSiteConfig().supportedLocales;
}

export function org() {
  const c = getSiteConfig();
  return {
    name: c.organization.name,
    legalName: c.organization.legalName ?? c.organization.name,
    url: c.organization.url,
    logo: c.organization.logo,
    description: c.organization.description,
    sameAs: c.organization.sameAs ?? [],
  };
}

/** 相對路徑轉絕對網址（已是 http(s) 則原樣回傳）。 */
export function absoluteUrl(path = ''): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 圖片路徑 → 絕對網址；無圖則回 undefined（JSON.stringify 會自動略過）。 */
export function absoluteImage(path?: string): string | undefined {
  if (!path) return undefined;
  const resolved = getImageUrl(path);
  if (!resolved || resolved === '/placeholder.jpg') return undefined;
  return absoluteUrl(resolved);
}

/** 依語言慣例組路徑：預設語言不加前綴，其餘語言加 /{locale}。 */
export function localizedPath(locale: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale() ? clean : `/${locale}${clean}`;
}

/** CJK 以字計、其他語言以詞計，估算字數（給 Article.wordCount 用）。 */
function estimateWordCount(markdown?: string): number | undefined {
  if (!markdown) return undefined;
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  const cjkMatches = text.match(/[一-鿿぀-ヿ가-힯]/g);
  const cjk = cjkMatches ? cjkMatches.length : 0;
  const nonCjk = text.replace(/[一-鿿぀-ヿ가-힯]/g, ' ').trim();
  const words = nonCjk ? nonCjk.split(/\s+/).filter(Boolean).length : 0;
  const total = cjk + words;
  return total > 0 ? total : undefined;
}

/**
 * 由 Content 的翻譯群組組出 canonical + hreflang。
 * canonical 一律「指向自己」；hreflang 列出所有實際存在的翻譯 + x-default。
 */
export function buildContentAlternates(post: Content, currentLocale: string = defaultLocale()) {
  const selfUrl = absoluteUrl(localizedPath(currentLocale, `/posts/${post.slug}`));
  const languages: Record<string, string> = { [currentLocale]: selfUrl };

  for (const t of post.translations ?? []) {
    if (t?.language && t?.slug) {
      languages[t.language] = absoluteUrl(localizedPath(t.language, `/posts/${t.slug}`));
    }
  }
  // x-default 指向預設語言版本；若預設語言不存在則指向當前頁
  languages['x-default'] = languages[defaultLocale()] ?? selfUrl;

  return { canonical: selfUrl, languages };
}

/** 全站組織結構化資料（含 logo、社群連結）。 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl()}/#organization`,
    name: org().name,
    legalName: org().legalName,
    url: org().url,
    logo: { '@type': 'ImageObject', url: org().logo },
    description: org().description,
    ...(org().sameAs.length ? { sameAs: org().sameAs } : {}),
  };
}

/** 全站 WebSite 結構化資料（含站內搜尋 SearchAction）。 */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl()}/#website`,
    name: siteName(),
    url: siteUrl(),
    inLanguage: defaultLocale(),
    publisher: { '@id': `${siteUrl()}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl()}/posts?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** 麵包屑結構化資料。items 路徑為相對路徑，會自動轉絕對網址。 */
export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/**
 * 靜態多語言頁（如 /about、/contact）的 canonical + hreflang。
 * 該頁在所有語言都存在，故列出全部支援語言 + x-default。
 */
export function buildStaticPageAlternates(path: string, currentLocale: string = defaultLocale()) {
  const languages: Record<string, string> = {};
  for (const loc of supportedLocales()) {
    languages[loc] = absoluteUrl(localizedPath(loc, path));
  }
  languages['x-default'] = absoluteUrl(localizedPath(defaultLocale(), path));
  return { canonical: absoluteUrl(localizedPath(currentLocale, path)), languages };
}

/** 關於頁 (AboutPage) 結構化資料，主體 (mainEntity) 指向全站 Organization。 */
export function buildAboutPageJsonLd(opts: { title: string; description?: string; locale?: string }) {
  const locale = opts.locale || defaultLocale();
  const url = absoluteUrl(localizedPath(locale, '/about'));
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${url}#aboutpage`,
    url,
    name: opts.title,
    description: opts.description || undefined,
    inLanguage: locale,
    isPartOf: { '@id': `${siteUrl()}/#website` },
    mainEntity: { '@id': `${siteUrl()}/#organization` },
  };
}

/** 文章清單 (ItemList) 結構化資料，用於首頁文章牆等內容集合。空清單回 null。 */
export function buildItemListJsonLd(
  posts: Array<Pick<Content, 'slug' | 'title'>>,
  locale: string = defaultLocale(),
) {
  if (!posts.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: posts.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(localizedPath(locale, `/posts/${p.slug}`)),
      name: p.title,
    })),
  };
}

/** 作者頁路徑（slug 優先，否則 username）。 */
export function authorPath(author: Pick<Author, 'slug' | 'username'>): string {
  return `/authors/${author.slug || author.username}`;
}

/** 作者的 schema.org Person 節點（不含 @context，可內嵌於 Article 或獨立輸出）。 */
function authorPersonNode(author?: Author) {
  if (!author) return { '@id': `${siteUrl()}/#organization` };
  const sameAs = author.social_links
    ? (Object.values(author.social_links).filter(Boolean) as string[])
    : [];
  const url = absoluteUrl(authorPath(author));
  return {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: author.name || author.username,
    url,
    jobTitle: author.title || undefined,
    description: author.bio || undefined,
    image: absoluteImage(author.avatar),
    knowsAbout: author.expertise?.length ? author.expertise : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

/** 作者頁用的完整 Person 結構化資料（E-E-A-T）。 */
export function buildPersonJsonLd(author: Author) {
  const url = absoluteUrl(authorPath(author));
  return {
    '@context': 'https://schema.org',
    ...authorPersonNode(author),
    mainEntityOfPage: { '@type': 'ProfilePage', '@id': url },
    worksFor: { '@id': `${siteUrl()}/#organization` },
  };
}

/** 文章 (Article) 結構化資料。 */
export function buildArticleJsonLd(post: Content, locale: string = defaultLocale()) {
  const url = absoluteUrl(localizedPath(locale, `/posts/${post.slug}`));
  const image = absoluteImage(post.featured_image);
  const keywords = post.tags?.map((t) => t.name).filter(Boolean).join(', ') || undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: (post.title || '').slice(0, 110),
    description: post.summary || post.meta_description || undefined,
    image: image ? [image] : undefined,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: locale,
    isAccessibleForFree: true,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    articleSection: post.category?.name || undefined,
    keywords,
    wordCount: estimateWordCount(post.content),
    author: authorPersonNode(post.author),
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl()}/#organization`,
      name: org().name,
      logo: { '@type': 'ImageObject', url: org().logo },
    },
  };
}

/** 產品 (Product) 結構化資料。沒有真實評價資料時不輸出 aggregateRating（避免造假被懲罰）。 */
export function buildProductJsonLd(product: Product, locale: string = defaultLocale()) {
  const url = absoluteUrl(localizedPath(locale, `/products/${product.product_id}`));
  const image = absoluteImage(product.image || product.detail_content?.featured_image);
  const currency = product.currency || 'TWD';
  const availability =
    product.stock_status === 'out_of_stock'
      ? 'https://schema.org/OutOfStock'
      : product.stock_status === 'pre_order'
        ? 'https://schema.org/PreOrder'
        : 'https://schema.org/InStock';

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.short_description || undefined,
    image: image ? [image] : undefined,
    url,
    sku: product.product_id,
    category: product.category?.slug || undefined,
    brand: { '@type': 'Brand', name: siteName() },
    offers: {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: currency,
      availability,
      seller: { '@id': `${siteUrl()}/#organization` },
    },
  };
}



/** FAQPage 結構化資料。文章沒有可辨識的 FAQ 區塊時回 null（不輸出空 schema）。 */
// 轉出給既有引用者（公開頁）；同時本檔的 buildFaqJsonLd / buildHowToJsonLd 也要用。
export { extractFaqFromMarkdown, extractHowToSteps } from '@ows/content-kit';

export function buildFaqJsonLd(post: Content): object | null {
  const faqs = extractFaqFromMarkdown(post.content);
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}



/** HowTo 結構化資料。需至少 2 個步驟才輸出（否則回 null）。 */
export function buildHowToJsonLd(post: Content): object | null {
  const { name, steps } = extractHowToSteps(post.content);
  if (steps.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: name || post.title,
    step: steps.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: text.length > 70 ? `${text.slice(0, 70)}…` : text,
      text,
    })),
  };
}
