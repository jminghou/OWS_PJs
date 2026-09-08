/**
 * @ows/commerce —— 電商模組的前端（選用）
 *
 * 自 @ows/admin-app（商品後台頁面）與 @ows/platform-api（products / orders API client）
 * 抽出。站台要用電商時：
 *
 *   1. 後端 COMMERCE_ENABLED=true，多跑一條 migration 鏈（見 docs/MIGRATIONS.md）
 *   2. app/admin/products/page.tsx：`export { default } from '@ows/commerce/pages/products/index';`
 *   3. configureAdminApp({ extraNav: [commerceNav] })
 *
 * 不用電商的站台完全不會碰到它——沒有頁面、沒有選單、沒有 API client。
 * 型別（Product / Order / PaymentMethod…）仍由 @ows/ui/types 提供（凍結層），這裡轉出。
 */
export { productApi } from './api/products';
export { orderApi, paymentMethodApi } from './api/orders';
export { commerceNav } from './nav';
export { default as PriceManager } from './components/PriceManager';
export { default as ProductLanguageManager } from './components/ProductLanguageManager';
export type {
  Product, ProductAdmin, ProductListResponse, ProductAdminListResponse, ProductPrice,
  ProductPriceListResponse, ProductTranslation, ProductTranslationListResponse,
  Order, OrderItem, OrderListResponse, OrderCreateData, OrderCreateResponse,
  PaymentMethod, PaymentMethodListResponse,
} from '@ows/ui/types';
