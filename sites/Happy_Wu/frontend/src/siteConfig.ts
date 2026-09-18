/**
 * Happy_Wu 的站台識別 —— 注入 @ows/site-kit。
 *
 * 必須在任何讀取設定的程式之前載入，所以 app/layout.tsx 第一行 import 它。
 */

import { configureSiteKit } from '@ows/site-kit/config';
import { getImageUrl, getGcsImageUrl } from '@/lib/utils';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010').replace(/\/$/, '');
const SITE_NAME = '職場媽媽崩潰啥？';

configureSiteKit({
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  defaultLocale: 'zh-TW',
  supportedLocales: ['zh-TW', 'zh-CN', 'en', 'ja'],
  organization: {
    name: SITE_NAME,
    url: SITE_URL,
    // TODO: 放一張正式 logo 到 public/logo.png（建議方形 ≥112x112，或 600x600）
    logo: `${SITE_URL}/logo.png`,
    description: '職場媽媽崩潰啥？ 的個人專欄：分享生活、觀察與想法。',
    sameAs: [],
  },
  getImageUrl,
  getGcsImageUrl,
});

export { SITE_URL, SITE_NAME };
