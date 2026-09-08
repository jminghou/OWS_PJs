/**
 * @ows/site-kit —— 公開站台工具組
 *
 * 抽的是**結構與邏輯**：JSON-LD / canonical / hreflang 的產生規則、
 * 文章卡片與列表區塊的資料流。站台識別（站名、組織、配色、導覽文案）
 * 一律注入，見 ./config.ts。
 *
 * 刻意留在站台的：PublicHeader、PublicFooter、HeroSection、AboutPreview、
 * HomePageContent —— 那幾個幾乎全是站台文案與版型，硬抽只會逼出一個
 * 還在猜的 config schema。等第三個站台真的開起來再談。
 */

export { configureSiteKit, getSiteConfig, getImageUrl, getGcsImageUrl } from './config';
export type { SiteKitConfig, OrganizationInfo } from './config';

export * from './seo';
export * from './relatedPosts';

export { default as JsonLd } from './components/JsonLd';
export { default as PostCard } from './components/PostCard';
export { default as LatestArticlesSection } from './components/LatestArticlesSection';
export { default as AuthorsSection } from './components/AuthorsSection';
export { default as HeroCarousel } from './components/HeroCarousel';
export { default as LanguageSwitcher } from './components/LanguageSwitcher';
export { default as ShareButtons } from './components/ShareButtons';
export { default as BannerSection } from './components/BannerSection';
export { default as FeaturesGrid } from './components/FeaturesGrid';
