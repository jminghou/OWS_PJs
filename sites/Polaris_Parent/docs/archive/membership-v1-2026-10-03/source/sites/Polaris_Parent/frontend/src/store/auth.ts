/**
 * 相容 shim —— 實作已移至 @ows/platform-api（P3）。
 *
 * 登入狀態是平台能力（authApi + session），不是站台專屬，
 * 所以住在共用套件裡；保留這個路徑是為了讓既有的 12 處 import 不必一次全改。
 */
export { useAuthStore } from '@ows/platform-api';
