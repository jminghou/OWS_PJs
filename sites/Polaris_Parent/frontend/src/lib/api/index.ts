export { request, API_URL } from './client';
export type { FetchOptions } from './client';

export { authApi } from './auth';
export { contentApi, categoryApi, tagApi } from './content';
export { mediaApi, tagApi as mediaTagApi } from './media';
export {
  getOptimizedImageUrl,
  getThumbnailUrl,
  getSmallImageUrl,
  getMediumImageUrl,
  getLargeImageUrl,
  getOriginalImageUrl,
  hasResponsiveFormats,
  getAvailableFormats,
} from './imageUtils';
export type { ImageSize } from './imageUtils';
export { productApi } from './products';
export { orderApi, paymentMethodApi } from './orders';
export { i18nApi, homepageApi } from './settings';
export type { I18nSettings } from './settings';
export { userApi, submissionApi } from './users';
export { authorApi } from './authors';
export type { AuthorContentCard, AuthorDetailResponse } from './authors';
export { rbacApi } from './rbac';
export { astrologyApi } from './astrology';
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
} from './astrology';
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

// Default export for backwards compatibility
import { authApi } from './auth';
import { contentApi, categoryApi, tagApi } from './content';
import { mediaApi, tagApi as mediaTagApi } from './media';
import { productApi } from './products';
import { orderApi, paymentMethodApi } from './orders';
import { i18nApi, homepageApi } from './settings';
import { userApi, submissionApi } from './users';
import { authorApi } from './authors';
import { rbacApi } from './rbac';
import { astrologyApi } from './astrology';
import { membershipApi } from './membership';
import { adminCommerceApi } from './admin-commerce';

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
