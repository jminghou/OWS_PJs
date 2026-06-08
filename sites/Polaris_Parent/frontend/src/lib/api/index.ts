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
  ChartBirth,
  MyChart,
  MyPerson,
  MyFavorite,
} from './astrology';

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
};

export default api;
