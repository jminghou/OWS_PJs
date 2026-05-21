/**
 * 內容區塊解析（共用，isomorphic、無外部依賴）。
 *
 * 文章內容可能是 HTML（TipTap 編輯器以 getHTML() 儲存）或 Markdown（匯入內容）。
 * 這裡把兩種格式都正規化成同一組「區塊」(標題 / 清單項 / 段落)，
 * 供 TOC、重點整理、FAQ、HowTo 等抽取器共用，避免各自重寫解析邏輯。
 *
 * 每個區塊都帶有在原始字串中的 start/end offset，讓「移除某區塊」(重點整理) 能對兩種格式通用。
 */

export interface ContentBlock {
  kind: 'heading' | 'li' | 'p';
  level: number; // 標題層級 (1-6)；非標題為 0
  ordered: boolean; // 清單項是否為有序 (ol / 1.)
  text: string; // 已去標籤/去 markdown 標記的純文字
  start: number; // 在原始字串中的起始 offset
  end: number; // 結束 offset（不含）
}

/** HTML → 純文字：去標籤、解常見實體、收斂空白。與 rehype-slug 取用的標題文字一致。 */
function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&') // 放最後，避免 &amp;lt; 被二次解碼
    .replace(/\s+/g, ' ')
    .trim();
}

/** Markdown 行內標記 → 純文字。 */
function mdInlineToText(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 看起來是不是 HTML（含區塊級標籤）。 */
function looksLikeHtml(content: string): boolean {
  return /<(h[1-6]|p|ul|ol|div|br|table|blockquote)\b/i.test(content);
}

/** 解析 TipTap 風格的（扁平、乾淨的）HTML 為區塊，依文件順序。 */
function parseHtmlBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  // 單次掃描：標題 | 清單(ul/ol) | 段落
  const re =
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<(ul|ol)\b[^>]*>([\s\S]*?)<\/\3>|<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (m[1]) {
      const level = parseInt(m[1].slice(1), 10);
      blocks.push({ kind: 'heading', level, ordered: false, text: htmlToText(m[2]), start, end });
    } else if (m[3]) {
      const ordered = m[3].toLowerCase() === 'ol';
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      while ((li = liRe.exec(m[4])) !== null) {
        const t = htmlToText(li[1]);
        if (t) blocks.push({ kind: 'li', level: 0, ordered, text: t, start, end });
      }
    } else if (m[5] !== undefined) {
      const t = htmlToText(m[5]);
      if (t) blocks.push({ kind: 'p', level: 0, ordered: false, text: t, start, end });
    }
  }
  return blocks;
}

/** 解析 Markdown 為區塊，依文件順序。 */
function parseMarkdownBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split(/\r?\n/);
  let offset = 0;
  let inFence = false;
  for (const line of lines) {
    const start = offset;
    const end = offset + line.length;
    offset = end + 1; // 補回換行
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,6})\s+(.*\S)\s*$/))) {
      blocks.push({ kind: 'heading', level: m[1].length, ordered: false, text: mdInlineToText(m[2]), start, end });
    } else if ((m = line.match(/^\s*\d+\.\s+(.*\S)\s*$/))) {
      blocks.push({ kind: 'li', level: 0, ordered: true, text: mdInlineToText(m[1]), start, end });
    } else if ((m = line.match(/^\s*[-*+]\s+(.*\S)\s*$/))) {
      blocks.push({ kind: 'li', level: 0, ordered: false, text: mdInlineToText(m[1]), start, end });
    } else if (trimmed) {
      blocks.push({ kind: 'p', level: 0, ordered: false, text: mdInlineToText(trimmed), start, end });
    }
  }
  return blocks;
}

/** 把文章內容（HTML 或 Markdown）解析成正規化區塊。 */
export function parseContentBlocks(content?: string): ContentBlock[] {
  if (!content) return [];
  return looksLikeHtml(content) ? parseHtmlBlocks(content) : parseMarkdownBlocks(content);
}

export interface Section {
  heading: ContentBlock;
  level: number;
  inner: ContentBlock[]; // 區塊內、標題之後的區塊
  removeStart: number; // 用於把整個區塊（含標題）從原始字串移除
  removeEnd: number;
}

/**
 * 找出「標題文字符合 keyword」的區塊；區塊結束於下一個「同級或更高層」標題（或內容結尾）。
 */
export function findSection(
  blocks: ContentBlock[],
  keyword: RegExp,
  contentLength: number,
): Section | null {
  const idx = blocks.findIndex((b) => b.kind === 'heading' && keyword.test(b.text));
  if (idx === -1) return null;

  const heading = blocks[idx];
  const level = heading.level;
  let endIdx = blocks.length;
  for (let i = idx + 1; i < blocks.length; i++) {
    if (blocks[i].kind === 'heading' && blocks[i].level <= level) {
      endIdx = i;
      break;
    }
  }
  return {
    heading,
    level,
    inner: blocks.slice(idx + 1, endIdx),
    removeStart: heading.start,
    removeEnd: endIdx < blocks.length ? blocks[endIdx].start : contentLength,
  };
}
