/**
 * 文章內容的結構抽取（供文章頁模板使用）。建立在 contentBlocks 的共用解析上，
 * 因此 HTML（TipTap 編輯器輸出）與 Markdown 兩種格式都支援。
 * - extractToc：產生目錄，id 與 rehype-slug 對齊（同樣用 github-slugger）。
 * - extractKeyTakeaways：抽出「重點整理」區塊條列，並把該區塊從內文移除（避免重複）。
 */
import GithubSlugger from 'github-slugger';
import { parseContentBlocks, findSection } from './contentBlocks';

export interface TocItem {
  level: number; // 2 或 3
  text: string;
  id: string;
}

/**
 * 從文章內容產生目錄（只收 H2/H3）。
 * 為了讓錨點 id 與 rehype-slug 完全一致：用同一個 github-slugger，
 * 並對「每一個」標題依文件順序呼叫 slug() 推進計數器（去重行為一致），僅在輸出時篩選 H2/H3。
 */
export function extractToc(content?: string): TocItem[] {
  if (!content) return [];
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  for (const b of parseContentBlocks(content)) {
    if (b.kind !== 'heading') continue;
    const id = slugger.slug(b.text); // 每個標題都推進，對齊 rehype-slug
    if (b.level >= 2 && b.level <= 3) items.push({ level: b.level, text: b.text, id });
  }
  return items;
}

export interface KeyTakeaways {
  takeaways: string[];
  body: string; // 已移除「重點整理」區塊的內文
}

// 「重點整理」區塊標題關鍵字（多語言）
const TAKEAWAYS_KEYWORDS =
  /(重點整理|重點摘要|本文重點|快速重點|要點整理|懶人包|Key\s*Takeaways|TL;?DR|まとめ|핵심\s*정리)/i;

/**
 * 抽出「重點整理」區塊的條列項，並把該區塊從內文移除（改由模板在頂部以強調框呈現，避免重複）。
 * 找不到區塊、或區塊內沒有條列項時，原樣回傳內文、takeaways 為空。
 */
export function extractKeyTakeaways(content?: string): KeyTakeaways {
  if (!content) return { takeaways: [], body: content || '' };
  const blocks = parseContentBlocks(content);
  const section = findSection(blocks, TAKEAWAYS_KEYWORDS, content.length);
  if (!section) return { takeaways: [], body: content };

  const takeaways = section.inner
    .filter((b) => b.kind === 'li')
    .map((b) => b.text)
    .filter(Boolean);

  // 沒有條列項就不視為重點整理區塊，避免誤刪
  if (takeaways.length === 0) return { takeaways: [], body: content };

  const body = (content.slice(0, section.removeStart) + content.slice(section.removeEnd))
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { takeaways, body };
}
