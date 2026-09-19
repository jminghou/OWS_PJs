// highlight.js 的 exports map 沒替 lib/languages/* 子路徑附型別，這裡補上。
declare module 'highlight.js/lib/languages/*' {
  import type { LanguageFn } from 'highlight.js';
  const language: LanguageFn;
  export default language;
}
