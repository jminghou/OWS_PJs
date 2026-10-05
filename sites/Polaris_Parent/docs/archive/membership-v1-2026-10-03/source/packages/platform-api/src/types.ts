/**
 * 平台資料型別。
 *
 * 目前轉出自 `@ows/ui/types` —— 這些型別（User、Content、Product、Order…）
 * 描述的是 core/backend_engine 的資料模型，本來就不該住在一個 UI 套件裡。
 *
 * 為什麼還沒搬過來：Claire_Project 依賴 `packages/ui/src/types`
 * （見 docs/FROZEN_CONTRACT.md B 節），該套件在模組化期間凍結。
 *
 * 這個檔案的作用是把那份耦合收斂成**單一一個點**：套件內部一律
 * `import ... from './types'`，將來要把型別真正搬進來（或搬到 packages/types），
 * 只要改這一個檔案。
 *
 * 移除條件：Claire 遷移到 @ows/platform-api 之後（P6 之後的獨立決策）。
 */
export * from '@ows/ui/types';
