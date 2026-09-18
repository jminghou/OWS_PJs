'use client';

/**
 * 文章編輯器的延遲載入入口。
 *
 * 實作在 ./TiptapEditorImpl（Tiptap + ProseMirror + 語法上色 + 媒體庫），是後台最重的一包。
 * 這裡用 next/dynamic 把它切成獨立 chunk，只有真的把編輯器畫到畫面上時才下載；
 * 儀表板、列表、設定等不編輯內文的後台頁面不必背它。
 * 對外路徑不變：`@ows/admin-app/components/TiptapEditor` 的 default / 具名匯出與 props 都和以前一樣。
 * ssr: false —— 編輯器本來就 immediatelyRender: false，伺服器端不會畫出內容，關掉省一次無用的 SSR。
 */
import dynamic from 'next/dynamic';

export type { TiptapEditorProps, EditorLabels } from './TiptapEditorImpl';

const TiptapEditor = dynamic(() => import('./TiptapEditorImpl'), {
  ssr: false,
  loading: () => <div className="min-h-[200px] animate-pulse rounded-md bg-gray-100" aria-busy="true" />,
});

export { TiptapEditor };
export default TiptapEditor;
