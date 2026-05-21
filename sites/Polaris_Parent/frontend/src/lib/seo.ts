/**
 * 集中式 SEO / AEO 工具：所有結構化資料 (JSON-LD)、canonical、hreflang 都從這裡產生，
 * 確保 (public) 與 [locale] 兩套路由（以及未來任何頁面）使用「單一來源」、不再各寫各的。
 *
 * 多語言 URL 慣例：預設語言 (zh-TW) 不加前綴，其餘語言加 /{locale}。
 * 若日後要改成「所有語言都加前綴」，只需修改 localizedPath 一處。
 */
import type { Content, Product, Author } from '@/types';
import { getImageUrl } from '@/lib/utils';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = '親紫之間';
export const DEFAULT_LOCALE = 'zh-TW';
export const SUPPORTED_LOCALES = ['zh-TW', 'zh-CN', 'en', 'ja'] as const;

/**
 * 組織 (Organization) 基本資料 —— AI 用這些資訊建立「你是誰」的實體可信度。
 * ⚠️ 上線前請填入真實的 logo 與社群連結 (sameAs)，否則 publisher.logo 會 404。
 */
export const ORG = {
  name: SITE_NAME,
  legalName: '親紫之間',
  url: SITE_URL,
  // TODO: 放一張正式 logo 到 public/logo.png（建議方形 ≥112x112，或 600x600）
  logo: `${SITE_URL}/logo.png`,
  description: '透過紫微斗數與數據分析，幫助家長理解孩子的獨特之處',
  // TODO: 填入真實社群帳號，AI 會用這些連結確認實體身分
  sameAs: [
    // 'https://www.facebook.com/...',
    // 'https://www.instagram.com/...',
    // 'https://www.youtube.com/@...',
  ] as string[],
};

/** 相對路徑轉絕對網址（已是 http(s) 則原樣回傳）。 */
export function absoluteUrl(path = ''): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
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
  return locale === DEFAULT_LOCALE ? clean : `/${locale}${clean}`;
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
export function buildContentAlternates(post: Content, currentLocale: string = DEFAULT_LOCALE) {
  const selfUrl = absoluteUrl(localizedPath(currentLocale, `/posts/${post.slug}`));
  const languages: Record<string, string> = { [currentLocale]: selfUrl };

  for (const t of post.translations ?? []) {
    if (t?.language && t?.slug) {
      languages[t.language] = absoluteUrl(localizedPath(t.language, `/posts/${t.slug}`));
    }
  }
  // x-default 指向預設語言版本；若預設語言不存在則指向當前頁
  languages['x-default'] = languages[DEFAULT_LOCALE] ?? selfUrl;

  return { canonical: selfUrl, languages };
}

/** 全站組織結構化資料（含 logo、社群連結）。 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: ORG.name,
    legalName: ORG.legalName,
    url: ORG.url,
    logo: { '@type': 'ImageObject', url: ORG.logo },
    description: ORG.description,
    ...(ORG.sameAs.length ? { sameAs: ORG.sameAs } : {}),
  };
}

/** 全站 WebSite 結構化資料（含站內搜尋 SearchAction）。 */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: DEFAULT_LOCALE,
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/posts?search={search_term_string}`,
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
export function buildStaticPageAlternates(path: string, currentLocale: string = DEFAULT_LOCALE) {
  const languages: Record<string, string> = {};
  for (const loc of SUPPORTED_LOCALES) {
    languages[loc] = absoluteUrl(localizedPath(loc, path));
  }
  languages['x-default'] = absoluteUrl(localizedPath(DEFAULT_LOCALE, path));
  return { canonical: absoluteUrl(localizedPath(currentLocale, path)), languages };
}

/** 關於頁 (AboutPage) 結構化資料，主體 (mainEntity) 指向全站 Organization。 */
export function buildAboutPageJsonLd(opts: { title: string; description?: string; locale?: string }) {
  const locale = opts.locale || DEFAULT_LOCALE;
  const url = absoluteUrl(localizedPath(locale, '/about'));
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${url}#aboutpage`,
    url,
    name: opts.title,
    description: opts.description || undefined,
    inLanguage: locale,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': `${SITE_URL}/#organization` },
  };
}

/** 作者頁路徑（slug 優先，否則 username）。 */
export function authorPath(author: Pick<Author, 'slug' | 'username'>): string {
  return `/authors/${author.slug || author.username}`;
}

/** 作者的 schema.org Person 節點（不含 @context，可內嵌於 Article 或獨立輸出）。 */
function authorPersonNode(author?: Author) {
  if (!author) return { '@id': `${SITE_URL}/#organization` };
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
    worksFor: { '@id': `${SITE_URL}/#organization` },
  };
}

/** 文章 (Article) 結構化資料。 */
export function buildArticleJsonLd(post: Content, locale: string = DEFAULT_LOCALE) {
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
      '@id': `${SITE_URL}/#organization`,
      name: ORG.name,
      logo: { '@type': 'ImageObject', url: ORG.logo },
    },
  };
}

/** 產品 (Product) 結構化資料。沒有真實評價資料時不輸出 aggregateRating（避免造假被懲罰）。 */
export function buildProductJsonLd(product: Product, locale: string = DEFAULT_LOCALE) {
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
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: currency,
      availability,
      seller: { '@id': `${SITE_URL}/#organization` },
    },
  };
}

/**
 * FAQ 區塊標題的關鍵字（多語言）。文章內文用一個標題（如 ## 常見問題）開啟 FAQ 區塊，
 * 區塊內每個「更深一層的標題」即為一個問題，其後文字為答案，直到下一個問題或區塊結束。
 */
const FAQ_SECTION_KEYWORDS =
  /(常見問題|常見問答|常见问题|常见问答|FAQ|Q\s*&\s*A|Q＆A|よくある(ご)?質問|자주\s*묻는\s*질문)/i;

/** 把一段 Markdown 轉成乾淨純文字（給 FAQ 答案用，schema 的 answer 以純文字最穩定）。 */
function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // code block
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> 文字
    .replace(/^\s{0,3}>\s?/gm, '') // blockquote
    .replace(/^\s*[-*+]\s+/gm, '') // 無序清單符號
    .replace(/^\s*\d+\.\s+/gm, '') // 有序清單符號
    .replace(/[*_~]/g, '') // 粗體/斜體/刪除線符號
    .replace(/\s+/g, ' ')
    .trim();
}

/** 從文章 Markdown 抽取「常見問題」區塊的問答對。找不到則回空陣列。 */
export function extractFaqFromMarkdown(markdown?: string): Array<{ question: string; answer: string }> {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);

  // 1. 找 FAQ 區塊標題（標題文字含 FAQ 關鍵字）
  let start = -1;
  let sectionLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const hm = lines[i].match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (hm && FAQ_SECTION_KEYWORDS.test(hm[2])) {
      start = i;
      sectionLevel = hm[1].length;
      break;
    }
  }
  if (start === -1) return [];

  // 2. 區塊結束於下一個「同級或更高層」的標題
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const hm = lines[i].match(/^(#{1,6})\s+/);
    if (hm && hm[1].length <= sectionLevel) {
      end = i;
      break;
    }
  }

  // 3. 區塊內，比 sectionLevel 更深的標題即為問題
  const faqs: Array<{ question: string; answer: string }> = [];
  let question: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (question) {
      const answer = markdownToPlainText(buffer.join('\n'));
      if (answer) faqs.push({ question, answer });
    }
    question = null;
    buffer = [];
  };
  for (let i = start + 1; i < end; i++) {
    const hm = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (hm && hm[1].length > sectionLevel) {
      flush();
      question = markdownToPlainText(hm[2]);
    } else if (question) {
      buffer.push(lines[i]);
    }
  }
  flush();

  return faqs;
}

/** FAQPage 結構化資料。文章沒有可辨識的 FAQ 區塊時回 null（不輸出空 schema）。 */
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
