/**
 * @ows/newsletter —— 電子報訂閱名單（選用）
 *
 * 站台要用時：
 *   1. 後端 NEWSLETTER_ENABLED=true，多跑一條 migration 鏈（packages/newsletter/migrations）
 *   2. 公開頁放 <SubscribeForm>；文案由站台以 labels 注入，這個套件不含任何站台文案
 *   3. app/[locale]/newsletter/{confirm,unsubscribe}/page.tsx 用 <TokenAction> 處理信裡的連結
 *      （一定要放在帶語系前綴的路徑下：信裡的連結帶 ?token=，無前綴路徑會被語系導向丟掉 query）
 *   4. app/admin/newsletter/page.tsx：`export { default } from '@ows/newsletter/pages/subscribers';`
 *      並把 newsletterNav 掛進 configureAdminApp 的 navGroups / extraNav
 *
 * 範圍只到收名單：不發電子報。發報用後台匯出的 CSV 到外部工具寄，CSV 每列帶退訂連結。
 */
export { newsletterNav } from './nav';
export { newsletterApi } from './api';
export type { SubscribeInput } from './api';
export { default as SubscribeForm } from './components/SubscribeForm';
export type { SubscribeFormLabels } from './components/SubscribeForm';
export { default as TokenAction } from './components/TokenAction';
export type { TokenActionLabels } from './components/TokenAction';
export type * from './types';
