// 此檔案為向後相容的重新導出，實際實作已拆分至 lib/api/ 目錄
export {
  default,
  request,
  API_URL,
  authApi,
  contentApi,
  categoryApi,
  tagApi,
  mediaApi,
  productApi,
  orderApi,
  paymentMethodApi,
  i18nApi,
  homepageApi,
  userApi,
  submissionApi,
  authorApi,
  rbacApi,
  astrologyApi,
  membershipApi,
  adminCommerceApi,
} from './api/index';

export type { FetchOptions, I18nSettings, AuthorContentCard, AuthorDetailResponse } from './api/index';
export type {
  ZiweiCalcRequest,
  ZiweiCalcResponse,
  ZiweiPlace,
  TimeType,
  GeoHierarchy,
} from './api/index';
export type {
  ExternalProduct,
  OrderSubmission,
  MemberReward,
  SavedArticle,
  CreateOrderSubmissionRequest,
  AdminOrderSubmission,
  CouponConfig,
} from './api/index';
