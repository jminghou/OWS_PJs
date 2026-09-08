/**
 * Markdown 內容擷取 —— 從文章正文解析出 FAQ 與 HowTo 步驟。
 *
 * P3 之前這兩個函式住在 Polaris 的 lib/seo.ts，跟一堆帶站台品牌的 JSON-LD
 * 建構器（SITE_NAME、ORG…）混在一起。它們本身是純解析、無任何站台知識，
 * 後台的 AEO 助手與公開頁的結構化資料都要用，所以獨立出來。
 *
 * 帶品牌的 JSON-LD 部分留在站台，P4 抽 site-kit 時再處理（需要設定注入）。
 */

import { findSection, parseContentBlocks } from './contentBlocks';

/**
 * FAQ 區塊標題的關鍵字（多語言）。文章內文用一個標題（如 ## 常見問題）開啟 FAQ 區塊，
 * 區塊內每個「更深一層的標題」即為一個問題，其後文字為答案，直到下一個問題或區塊結束。
 */
const FAQ_SECTION_KEYWORDS =
  /(常見問題|常見問答|常见问题|常见问答|FAQ|Q\s*&\s*A|Q＆A|よくある(ご)?質問|자주\s*묻는\s*질문)/i;
/**
 * 「步驟」區塊的標題關鍵字。區塊內的「有序清單項目」(1. 2. 3.) 即為步驟。
 */
const HOWTO_SECTION_KEYWORDS =
  /(操作步驟|步驟教學|教學步驟|操作方式|做法步驟|步驟|做法|怎麼做|如何操作|How\s*-?\s*To|手順|방법)/i;


/** 從文章內容（HTML 或 Markdown）抽取「常見問題」區塊的問答對。找不到則回空陣列。 */
export function extractFaqFromMarkdown(content?: string): Array<{ question: string; answer: string }> {
  if (!content) return [];
  const blocks = parseContentBlocks(content);
  const section = findSection(blocks, FAQ_SECTION_KEYWORDS, content.length);
  if (!section) return [];

  // 區塊內：比 FAQ 標題更深一層的標題＝問題；其後的段落/清單＝答案
  const faqs: Array<{ question: string; answer: string }> = [];
  let question: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (question) {
      const answer = buffer.join(' ').replace(/\s+/g, ' ').trim();
      if (answer) faqs.push({ question, answer });
    }
    question = null;
    buffer = [];
  };
  for (const b of section.inner) {
    if (b.kind === 'heading' && b.level > section.level) {
      flush();
      question = b.text;
    } else if (question && (b.kind === 'p' || b.kind === 'li')) {
      buffer.push(b.text);
    }
  }
  flush();

  return faqs;
}

/** 從文章內容（HTML 或 Markdown）抽取「步驟」區塊的有序清單作為步驟。 */
export function extractHowToSteps(content?: string): { name?: string; steps: string[] } {
  if (!content) return { steps: [] };
  const blocks = parseContentBlocks(content);
  const section = findSection(blocks, HOWTO_SECTION_KEYWORDS, content.length);
  if (!section) return { steps: [] };

  const steps = section.inner
    .filter((b) => b.kind === 'li' && b.ordered)
    .map((b) => b.text)
    .filter(Boolean);

  return { name: section.heading.text, steps };
}
