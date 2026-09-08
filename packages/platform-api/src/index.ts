/**
 * @ows/platform-api —— OWS 平台 API client
 *
 * 對應 core/backend_engine 提供的 REST 契約：內容、分類、標籤、作者、媒體庫、
 * 商品、訂單、設定、使用者、RBAC、會員身分。**與任何領域無關** ——
 * 紫微斗數（排盤、命盤）、會員商業循環等站台功能，留在各自站台的 lib/api 下。
 *
 * 這是模組化的關鍵接縫：後端 core 改一次 API，所有站台前端跟著改一次。
 * 端點路徑與 core 的實際路由由 scripts/check_api_contract.py 在 CI 比對。
 *
 * 用法：
 *     import { contentApi, authApi } from '@ows/platform-api';
 *     import { request } from '@ows/platform-api/client';   // 站台領域模組自行組裝請求用
 */

export { request, API_URL, RequestError, configurePlatformApi } from './client';
export type { FetchOptions } from './client';

export { authApi } from './auth';
export type { LoginResponse, RegisterPayload, RegisterResponse } from './auth';

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

export { useAuthStore } from './authStore';

export * from './strapi';
export * from './types';
