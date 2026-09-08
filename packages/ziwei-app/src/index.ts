/**
 * @ows/ziwei-app —— 紫微斗數的站台層
 *
 * 這是**領域**套件，不是平台套件：要開紫微斗數網站的站台掛上它，
 * 不需要的站台完全不會碰到。它依賴 @ows/ziwei-chart（互動命盤渲染）與
 * @ows/platform-api（登入狀態、request），並假設後端掛了 astrology 擴充
 * （/api/v1/astrology/*）。
 *
 * 用法（站台頁面）：
 *     import { ZiweiChartForm, ZiweiHomeSection, StarfieldSection } from '@ows/ziwei-app';
 *     import { astrologyApi } from '@ows/ziwei-app/api';
 */
export { astrologyApi } from './api/astrology';
export type * from './api/astrology';
export * from './pendingChart';
export { default as ZiweiChartForm } from './components/ZiweiChartForm';
export { default as MemberChartForm } from './components/MemberChartForm';
export { default as ZiweiHomeSection } from './components/ZiweiHomeSection';
export * from './components/starfield';
