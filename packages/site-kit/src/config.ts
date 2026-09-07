/**
 * 站台設定注入點（公開站台側）。
 *
 * ## 這裡放什麼、不放什麼
 *
 * site-kit 抽的是**結構與邏輯**，不是版型：
 *   - JSON-LD 的組裝規則、hreflang / canonical 的多語言 URL 慣例、
 *     文章卡片的資料流 —— 這些每個站台都一樣，抽出來。
 *   - 站名、組織資料、配色、導覽列文案 —— 這些每個站台都不一樣，注入。
 *
 * 刻意**沒有**抽走 PublicHeader / PublicFooter / HeroSection / AboutPreview：
 * 那幾個檔案裡幾乎全是站台文案與版型（PublicFooter 有 8 處品牌字串），
 * 抽出來只會逼出一個我現在還在猜的 config schema。第三個站台真的開起來，
 * 才知道那層該長什麼樣 —— 在那之前少抽比抽錯好。
 */

export interface OrganizationInfo {
  name: string;
  legalName?: string;
  url: string;
  logo: string;
  description?: string;
  /** 社群連結；搜尋引擎與 AI 用它確認實體身分。 */
  sameAs?: string[];
}

export interface SiteKitConfig {
  /** 站台正式網址（無尾斜線）。 */
  siteUrl: string;
  siteName: string;
  /** 預設語言不加 URL 前綴，其餘語言加 /{locale}。 */
  defaultLocale: string;
  supportedLocales: readonly string[];
  organization: OrganizationInfo;
  /**
   * 把後端回傳的圖片路徑轉成可顯示的 URL。
   * 與 admin-app 同樣的理由：變體檔名規則各站不同，套件不能自己猜。
   */
  getImageUrl: (imagePath?: string, variant?: string) => string;

  /** 同上，但處理已經是 GCS 絕對網址的情況。 */
  getGcsImageUrl: (imagePath: string, variant?: string) => string;
}

const DEFAULT_SITE_URL = 'http://localhost:3000';

const DEFAULT_CONFIG: SiteKitConfig = {
  siteUrl: DEFAULT_SITE_URL,
  siteName: 'Site',
  defaultLocale: 'zh-TW',
  supportedLocales: ['zh-TW'],
  organization: {
    name: 'Site',
    url: DEFAULT_SITE_URL,
    logo: `${DEFAULT_SITE_URL}/logo.png`,
  },
  getImageUrl: (imagePath?: string) => imagePath || '/placeholder.jpg',
  getGcsImageUrl: (imagePath: string) => imagePath || '/placeholder.jpg',
};

let config: SiteKitConfig = DEFAULT_CONFIG;

/** 站台在 root layout（或任何最早被載入的模組）呼叫一次。 */
export function configureSiteKit(options: Partial<SiteKitConfig>): void {
  config = {
    ...config,
    ...options,
    siteUrl: (options.siteUrl ?? config.siteUrl).replace(/\/$/, ''),
  };
}

export function getSiteConfig(): SiteKitConfig {
  return config;
}

export function getImageUrl(imagePath?: string, variant?: string): string {
  return config.getImageUrl(imagePath, variant);
}

export function getGcsImageUrl(imagePath: string, variant?: string): string {
  return config.getGcsImageUrl(imagePath, variant);
}
