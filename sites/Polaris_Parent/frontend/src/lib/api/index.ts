/**
 * Polaris 的 API barrel —— 平台能力 + 本站領域能力的組裝點。
 *
 * 平台部分（內容、媒體、商品、訂單、設定、使用者、RBAC、會員身分）住在
 * @ows/platform-api，對應 core/backend_engine 的 REST 契約，第三個站台直接複用。
 *
 * 領域部分（紫微排盤、會員商業循環）留在本站 lib/api 下，不進共用套件。
 *
 * 這個檔案是**唯一**允許同時引用兩層的地方 —— 它就是組裝層，
 * 等同 app/ 下的頁面。平台模組本身不得反向依賴領域模組
 * （由 scripts/check_layering.py 稽核）。
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

// ── 領域層（本站專屬）─────────────────────────────────────────────────────
export { astrologyApi } from '@ows/ziwei-app/api/astrology';
export type {
  ZiweiCalcRequest,
  ZiweiCalcResponse,
  ZiweiPlace,
  TimeType,
  GeoHierarchy,
  SaveAndRegisterRequest,
  SaveAndRegisterResponse,
  SaveMyChartRequest,
  ChartBirth,
  RegisterChartPayload,
  MyChart,
  MyPerson,
  MyFavorite,
  StarKind,
  VoidState,
  StarEnergyStep,
  StarEnergyCounterfactual,
  StarEnergyCard,
  StarEnergyPayload,
  RelationCode,
  ReadingContributor,
  ReadingFieldSource,
  PalaceReading,
  PalaceReadingsPayload,
} from '@ows/ziwei-app/api/astrology';

export { membershipApi } from './membership';
export type {
  ExternalProduct,
  OrderSubmission,
  MemberReward,
  SavedArticle,
  CreateOrderSubmissionRequest,
} from './membership';

export { adminCommerceApi } from './admin-commerce';
export type { AdminOrderSubmission, CouponConfig } from './admin-commerce';

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
import { astrologyApi } from '@ows/ziwei-app/api/astrology';
import { membershipApi } from './membership';
import { adminCommerceApi } from './admin-commerce';
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
  astrology: astrologyApi,
  membership: membershipApi,
  adminCommerce: adminCommerceApi,
};

export default api;
