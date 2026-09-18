import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';

/** Shared with the import round-trip check: headings, lists, quotes and tables. */
export function createArticleBaseExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
    TableKit.configure({ table: { resizable: false } }),
  ];
}
