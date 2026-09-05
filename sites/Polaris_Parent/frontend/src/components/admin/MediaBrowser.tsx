/**
 * 相容 shim —— 不是實作，實作在 @/components/platform/admin/MediaBrowser。
 *
 * 為什麼需要這個檔案：
 * packages/ui/src/editor/TiptapEditor.tsx 直接 import '@/components/admin/MediaBrowser'，
 * 也就是**共用套件反向依賴站台原始碼**，隱含要求每個消費站台都在這個確切路徑
 * 提供一個檔案。P1 把元件分成 platform/ 與 domain/ 之後，Polaris 的實際路徑
 * 變成 platform/admin/MediaBrowser，這個 shim 用來維持 packages/ui 的隱含契約。
 *
 * 為什麼不直接修 packages/ui：
 * Claire_Project 依賴 packages/ui/src/editor/TiptapEditor（見 docs/FROZEN_CONTRACT.md），
 * 該套件的 export 面與行為在模組化期間凍結。
 *
 * 移除條件（P3，抽 packages/admin-app 時）：
 * 把 TiptapEditor 的 MediaBrowser 與 getImageUrl/getGcsImageUrl 改為注入
 * （prop 或 context），共用套件就不再需要知道站台的目錄長相 —— 這個 shim
 * 與 packages/ui 對 '@/lib/utils' 的反向依賴可以一起消失。
 */
export { default } from '@/components/platform/admin/MediaBrowser';
export * from '@/components/platform/admin/MediaBrowser';
