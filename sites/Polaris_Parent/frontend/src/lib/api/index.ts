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

// Default export for backwards compatibility
import { authApi } from './auth';
import { contentApi, categoryApi, tagApi } from './content';
import { mediaApi, tagApi as mediaTagApi } from './media';
import { productApi } from './products';
import { orderApi, paymentMethodApi } from './orders';
import { i18nApi, homepageApi } from './settings';
import { userApi, submissionApi } from './users';

const api = {
  auth: authApi,
  content: contentApi,
  category: categoryApi,
  tag: tagApi,
  submission: submissionApi,
  user: userApi,
  media: mediaApi,
  mediaTag: mediaTagApi,
  i18n: i18nApi,
  homepage: homepageApi,
  order: orderApi,
  product: productApi,
  paymentMethod: paymentMethodApi,
};

export default api;
