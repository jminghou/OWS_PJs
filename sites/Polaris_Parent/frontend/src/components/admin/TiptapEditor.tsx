"use client";

/**
 * TiptapEditor - 重新匯出自共用套件
 *
 * 此編輯器已移至 packages/ui 套件以便跨專案共用
 * 原始程式碼位於: packages/ui/src/editor/TiptapEditor.tsx
 *
 * 使用相對路徑匯入，避免 npm workspace 設定問題
 */

export {
  TiptapEditor as default,
  TiptapEditor,
  type TiptapEditorProps,
  type EditorLabels
} from '../../../../../../packages/ui/src/editor/TiptapEditor';
