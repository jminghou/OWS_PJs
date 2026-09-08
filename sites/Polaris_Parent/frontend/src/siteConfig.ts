/**
 * Polaris 的站台識別 —— 注入 @ows/site-kit。
 *
 * P4 之前這些值是 lib/seo.ts 裡的硬編常數（SITE_NAME = '親紫之間'、ORG = {...}），
 * 那正是 SEO 模組無法離開 Polaris 的唯一原因。現在 seo 的產生規則住在套件裡，
 * 站台識別住在這裡。
 *
 * **這個模組必須在任何讀取設定的程式之前被載入**，所以 app/layout.tsx
 * 在第一行 import 它（ES module 的 import 會先於本體求值）。
 */

import { configureSiteKit } from '@ows/site-kit/config';
import { getImageUrl, getGcsImageUrl } from '@/lib/utils';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SITE_NAME = '親紫之間';

configureSiteKit({
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  defaultLocale: 'zh-TW',
  supportedLocales: ['zh-TW', 'zh-CN', 'en', 'ja'],
  organization: {
    name: SITE_NAME,
    legalName: SITE_NAME,
    url: SITE_URL,
    // TODO: 放一張正式 logo 到 public/logo.png（建議方形 ≥112x112，或 600x600）
    logo: `${SITE_URL}/logo.png`,
    description: '透過紫微斗數與數據分析，幫助家長理解孩子的獨特之處',
    // TODO: 填入真實社群帳號，AI 會用這些連結確認實體身分
    sameAs: [],
  },
  // 圖片變體命名規則各站不同（Polaris 後綴、Claire 前綴），故由站台提供。
  getImageUrl,
  getGcsImageUrl,
});

export { SITE_URL, SITE_NAME };
