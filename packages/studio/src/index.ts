/**
 * @ows/studio —— 個人內容與知識管理（選用）
 *
 * 站台要用時：
 *   1. 後端 STUDIO_ENABLED=true，多跑一條 migration 鏈（packages/studio/migrations）
 *   2. app/admin/studio/<page>/page.tsx：`export { default } from '@ows/studio/pages/<page>';`
 *   3. configureAdminApp({ shell: 'labeled', navGroups: [...studioNavGroups, …], globalSearch: <StudioSearchBar />, quickAction: <QuickCollectButton /> })
 *      （rail 外殼則 extraNav: [...studioNav], globalSearch: <StudioSearchButton />）
 *
 * 不用的站台完全不會碰到它——沒有頁面、沒有選單、沒有 API client。
 */
export { studioNav, studioNavGroups } from './nav';
export { studioApi, todayApi, projectApi, documentApi, cardApi, inboxApi, tagApi, publishingApi, searchApi } from './api';
export { StudioSearchButton, StudioSearchBar, GlobalSearch } from './components/GlobalSearch';
export { QuickCollectButton, QuickCollectDialog } from './components/QuickCollect';
export { InboxBadge } from './components/InboxBadge';
export { STAGES, STAGE_META, PLATFORMS, PLATFORM_META, CARD_KINDS, CARD_KIND_META, FLOW_STEPS, STUDIO_ROUTES } from './constants';
export type { FlowStep } from './constants';
export { useCardKinds, useActiveCardKinds, cardKindApi, KIND_COLOR_CLASSES } from './cardKinds';
export type { CardKindDef, CardKindColor } from './cardKinds';
export type * from './types';
