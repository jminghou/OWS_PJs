/**
 * Happy_Wu 的 API barrel —— 平台能力 + 選用套件的組裝點。
 *
 * 平台部分（內容、媒體、設定、使用者、RBAC、會員身分）住在 @ows/platform-api，
 * 電商（商品／訂單／付款方式）住在 @ows/commerce。本站沒有任何領域擴充，
 * 也不掛排盤；日後有站台專屬 API 時加在下方「領域層」區塊。
 */

// ── 平台層（@ows/platform-api）────────────────────────────────────────────
export {
  request,
  API_URL,
  RequestError,
  configurePlatformApi,
  authApi,
  contentApi,
  categoryApi,
  tagApi,
  mediaApi,
  mediaTagApi,
  getOptimizedImageUrl,
  getThumbnailUrl,
  getSmallImageUrl,
  getMediumImageUrl,
  getLargeImageUrl,
  getOriginalImageUrl,
  hasResponsiveFormats,
  getAvailableFormats,
  i18nApi,
  homepageApi,
  userApi,
  submissionApi,
  authorApi,
  rbacApi,
} from '@ows/platform-api';

// 電商（選用套件）
export { productApi, orderApi, paymentMethodApi } from '@ows/commerce';

export type {
  FetchOptions,
  ImageSize,
  I18nSettings,
  AuthorContentCard,
  AuthorDetailResponse,
  LoginResponse,
  RegisterResponse,
} from '@ows/platform-api';

// ── 領域層（本站專屬）—— 目前無 ──────────────────────────────────────────

// ── 預設匯出（向後相容）────────────────────────────────────────────────────
import {
  authApi,
  contentApi,
  categoryApi,
  tagApi,
  mediaApi,
  mediaTagApi,
  i18nApi,
  homepageApi,
  userApi,
  submissionApi,
  authorApi,
  rbacApi,
} from '@ows/platform-api';
import { productApi, orderApi, paymentMethodApi } from '@ows/commerce';

const api = {
  auth: authApi,
  content: contentApi,
  category: categoryApi,
  tag: tagApi,
  submission: submissionApi,
  user: userApi,
  author: authorApi,
  media: mediaApi,
  mediaTag: mediaTagApi,
  i18n: i18nApi,
  homepage: homepageApi,
  order: orderApi,
  product: productApi,
  paymentMethod: paymentMethodApi,
  rbac: rbacApi,
};

export default api;
