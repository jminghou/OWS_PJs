/**
 * @ows/content-kit —— 文章內容的純函式解析
 *
 * 無框架、無站台知識、無 API 呼叫。後台編輯器（@ows/admin-app 的 AEO 助手）
 * 與公開頁的文章渲染共用同一份實作 —— 這正是「目錄在編輯器預覽和正式頁面
 * 長得不一樣」這類 bug 的來源，一份實作才不會漂移。
 */
export * from './contentBlocks';
export * from './articleContent';
export * from './markdownExtract';
